import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { serviceWorkerCode } from '../build/published-files.ts';
import type { WorkerVersions } from '../build/published-files.ts';

describe('the service worker', () => {
  const ORIGIN = 'https://example.org';
  const versionOf = (body: string) => createHash('sha256').update(body).digest('hex').slice(0, 16);
  const bodyOf = (path: string) => `bytes:${path}`;

  /** The deploy's files, each published with the hash of the body the stub server returns for it. */
  function deploy(paths: string[]): WorkerVersions {
    return {
      base: '/neuroatlas/',
      files: Object.fromEntries(paths.map((path) => [path, versionOf(bodyOf(path))])),
      gunzipped: {},
    };
  }

  const DEFAULT_FILES = [
    'models/bert/cortex-destrieux.glb',
    'models/bert/manifest.json',
    'models/bert/nextbrain.glb',
    'models/bert/structures.glb',
    'diffusion/snail-subject-1/bundles_af.left.trk.gz',
  ];

  type Handler = (event: unknown) => void;

  /** Loads the type-stripped worker the build writes into a stub of a worker scope. */
  async function bootWorker(published = deploy(DEFAULT_FILES)) {
    const listeners = new Map<string, Handler>();
    const storage = new Map<string, Map<string, Response>>();
    const fetched: string[] = [];
    const fetchOptions: (RequestInit | undefined)[] = [];
    const responses = new Map<string, { status: number; body: string }>();

    const cacheFor = (name: string) => {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name)!;
      return {
        match: async (key: string) => entries.get(String(key))?.clone(),
        put: async (key: string, value: Response) => {
          entries.set(String(key), value);
        },
        keys: async () =>
          [...entries.keys()].map((key) => ({ url: new URL(key, ORIGIN).href, key })),
        delete: async (request: { key: string }) => entries.delete(request.key),
      };
    };
    const caches = {
      open: async (name: string) => cacheFor(name),
      keys: async () => [...storage.keys()],
      delete: async (name: string) => storage.delete(name),
    };
    const self = {
      location: { origin: ORIGIN },
      addEventListener: (type: string, handler: Handler) => listeners.set(type, handler),
      skipped: false,
      claimed: false,
      skipWaiting: () => {
        self.skipped = true;
      },
      clients: {
        claim: async () => {
          self.claimed = true;
        },
      },
    };
    const fetchStub = async (url: string | { url: string }, options?: RequestInit) => {
      const address = typeof url === 'string' ? url : url.url;
      fetched.push(address);
      fetchOptions.push(options);
      const path = new URL(address, ORIGIN).pathname.replace('/neuroatlas/', '');
      const made = responses.get(path) ?? { status: 200, body: bodyOf(path) };
      return new Response(made.body, { status: made.status });
    };

    new Function('self', 'caches', 'fetch', await serviceWorkerCode(published))(
      self,
      caches,
      fetchStub,
    );

    /** The answer the page gets, after anything the worker kept alive to store has finished. */
    const request = async (url: string, method = 'GET', mode = 'cors') => {
      let answered: Promise<Response> | undefined;
      const lifetime: Promise<unknown>[] = [];
      listeners.get('fetch')!({
        request: { method, url, mode },
        respondWith: (promise: Promise<Response>) => {
          answered = promise;
        },
        waitUntil: (promise: Promise<unknown>) => {
          lifetime.push(promise);
        },
      });
      if (!answered) return undefined;
      const response = await answered;
      await Promise.all(lifetime);
      return response;
    };
    const activate = async () => {
      let finished: Promise<unknown> | undefined;
      listeners.get('activate')!({
        waitUntil: (promise: Promise<unknown>) => (finished = promise),
      });
      await finished;
    };
    return {
      self,
      listeners,
      storage,
      fetched,
      fetchOptions,
      responses,
      request,
      activate,
      published,
    };
  }
  type Worker = Awaited<ReturnType<typeof bootWorker>>;

  const urlOf = (
    worker: Worker,
    path: string,
    version: string | null = worker.published.files[path],
  ) => `${ORIGIN}/neuroatlas/${path}${version === null ? '' : `?v=${version}`}`;
  const stored = (worker: Worker) => [...(worker.storage.get('planum-models')?.keys() ?? [])];

  it('SW-02 stores a published file on first request and serves it from storage after', async () => {
    const worker = await bootWorker();
    const url = urlOf(worker, 'models/bert/cortex-destrieux.glb');
    await worker.request(url);
    expect(worker.fetched).toHaveLength(1);
    const again = await worker.request(url);
    expect(worker.fetched).toHaveLength(1);
    expect(await again!.text()).toBe(bodyOf('models/bert/cortex-destrieux.glb'));
  });

  it('SW-02 stores metadata and diffusion files, which are content-versioned too', async () => {
    const worker = await bootWorker();
    for (const path of [
      'models/bert/manifest.json',
      'diffusion/snail-subject-1/bundles_af.left.trk.gz',
    ]) {
      expect(await worker.request(urlOf(worker, path))).toBeTruthy();
    }
    expect(stored(worker)).toHaveLength(2);
  });

  it('SW-03 intercepts only a request for this deploy’s version of a published file', async () => {
    const worker = await bootWorker();
    const path = 'models/bert/cortex-destrieux.glb';
    expect(await worker.request(urlOf(worker, path, null))).toBeUndefined();
    expect(await worker.request(urlOf(worker, path, 'previousdeploy00'))).toBeUndefined();
    expect(
      await worker.request(`${ORIGIN}/neuroatlas/models/bert/unpublished.glb?v=1`),
    ).toBeUndefined();
    expect(await worker.request(`${ORIGIN}/neuroatlas/assets/index-abc.js`)).toBeUndefined();
    expect(
      await worker.request(
        `https://elsewhere.test/neuroatlas/${path}?v=${worker.published.files[path]}`,
      ),
    ).toBeUndefined();
    expect(await worker.request(urlOf(worker, path), 'POST')).toBeUndefined();
    expect(worker.fetched).toEqual([]);
  });

  it('SW-04 never stores a failed, partial or mismatched download', async () => {
    const worker = await bootWorker();
    const path = 'models/bert/nextbrain.glb';
    for (const made of [
      { status: 502, body: 'gateway' },
      { status: 206, body: 'half' },
      { status: 200, body: 'bytes from another deploy' },
    ]) {
      worker.responses.set(path, made);
      await worker.request(urlOf(worker, path));
      expect(stored(worker)).toEqual([]);
    }
    worker.responses.delete(path);
    await worker.request(urlOf(worker, path));
    expect(stored(worker)).toHaveLength(1);
  });

  it('SW-06 deletes on a new deploy only the files it no longer publishes', async () => {
    const first = await bootWorker();
    for (const path of ['models/bert/cortex-destrieux.glb', 'models/bert/structures.glb']) {
      await first.request(urlOf(first, path));
    }
    const second = await bootWorker({
      ...first.published,
      files: { ...first.published.files, 'models/bert/structures.glb': 'changedstructure' },
    });
    second.storage.set('planum-models', first.storage.get('planum-models')!);
    second.storage.set('neuroatlas-models', new Map([['/old.glb', new Response('')]]));
    second.storage.set('neuroatlas-models-oldglobal', new Map([['/old.glb', new Response('')]]));
    second.storage.set('something-else', new Map([['/keep', new Response('')]]));
    await second.activate();
    expect([...second.storage.keys()].sort()).toEqual(['planum-models', 'something-else']);
    expect(stored(second)).toEqual([
      `/neuroatlas/models/bert/cortex-destrieux.glb?v=${first.published.files['models/bert/cortex-destrieux.glb']}`,
    ]);
    expect(second.self.claimed).toBe(true);
  });

  it('SW-07 takes over immediately rather than waiting for every tab to close', async () => {
    const worker = await bootWorker();
    worker.listeners.get('install')!({});
    expect(worker.self.skipped).toBe(true);
  });

  it('SW-08 revalidates when filling the cache instead of trusting the HTTP cache', async () => {
    const worker = await bootWorker();
    await worker.request(urlOf(worker, 'models/bert/structures.glb'));
    expect(worker.fetchOptions[0]?.cache).toBe('no-cache');
  });

  it('SW-09 always revalidates the page itself', async () => {
    const worker = await bootWorker();
    expect(await worker.request(`${ORIGIN}/neuroatlas/`, 'GET', 'navigate')).toBeTruthy();
    expect(worker.fetched).toEqual([`${ORIGIN}/neuroatlas/`]);
    expect(worker.fetchOptions[0]?.cache).toBe('no-cache');
  });

  it('SW-05 stores a .gz file a server decodes on the way by the hash of its contents', async () => {
    const path = 'diffusion/snail-subject-1/bundles_af.left.trk.gz';
    const published = deploy(DEFAULT_FILES);
    published.gunzipped[path] = versionOf('decoded tract');
    const worker = await bootWorker(published);
    worker.responses.set(path, { status: 200, body: 'decoded tract' });
    await worker.request(urlOf(worker, path));
    expect(stored(worker)).toHaveLength(1);
  });
});
