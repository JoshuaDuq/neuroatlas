import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { build, resolveConfig, type Plugin } from 'vite';
import legacyConfig from '../../vite.config.js';
import {
  prefetchScript,
  publishedAssets,
  serviceWorkerCode,
  type WorkerVersions,
} from '../build/published-files.ts';
import { ASSET_BASE } from '../build/site.ts';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const publicDirectory = resolve(webRoot, '../public');
const publishedModule = resolve(webRoot, 'src/lib/core/assets/published-files.ts');
mkdirSync(resolve(webRoot, 'dist'), { recursive: true });
const scratch = mkdtempSync(resolve(webRoot, 'dist', 'f3-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A plugin hook, whether written as a function or as `{ handler }`. */
function hook(plugin: Plugin, name: keyof Plugin): (...args: unknown[]) => unknown {
  const entry = plugin[name] as unknown;
  const fn = typeof entry === 'function' ? entry : (entry as { handler: unknown }).handler;
  return (fn as (...args: unknown[]) => unknown).bind({});
}

const readPublic = (name: string) => readFileSync(resolve(publicDirectory, name), 'utf8');

describe('worker and head version maps match the legacy build', () => {
  const legacy = (legacyConfig.plugins as Plugin[]).find(
    (plugin) => plugin.name === 'published-files',
  )!;
  const current = publishedAssets();
  const legacyOut = resolve(scratch, 'legacy');
  const currentOut = resolve(scratch, 'current');
  let legacyWorker: string;
  let currentWorker: string;
  let legacyHead: string;
  let currentHead: string;

  beforeAll(async () => {
    for (const [plugin, out] of [
      [legacy, legacyOut],
      [current, currentOut],
    ] as const) {
      mkdirSync(out, { recursive: true });
      hook(plugin, 'configResolved')({ root: out, command: 'build', build: { outDir: '.' } });
      await hook(plugin, 'closeBundle')();
    }
    const mapOf = (file: string) =>
      readFileSync(file, 'utf8').match(/^const PUBLISHED = (.*);$/m)![1];
    legacyWorker = mapOf(resolve(legacyOut, 'sw.js'));
    currentWorker = mapOf(resolve(currentOut, 'sw.js'));
    legacyHead = (hook(legacy, 'transformIndexHtml')('__PUBLISHED_VERSIONS__') as string).trim();
    const [tag] = hook(current, 'transformIndexHtml')('') as {
      children: string;
      injectTo: string;
    }[];
    expect(tag.injectTo).toBe('head');
    currentHead = tag.children.match(/var versions = (.*);$/m)![1];
  }, 60_000);

  it('gives the service worker a byte-identical map', () => {
    expect(Object.keys(JSON.parse(currentWorker))).toEqual(['base', 'files', 'gunzipped']);
    expect(currentWorker).toBe(legacyWorker);
  });

  it('gives the head script a byte-identical map of the models/ entries only', () => {
    expect(currentHead).toBe(legacyHead);
    const head = JSON.parse(currentHead) as Record<string, string>;
    expect(Object.keys(head).length).toBeGreaterThan(0);
    expect(Object.keys(head).every((path) => path.startsWith('models/'))).toBe(true);
  });
});

describe('the dev server watcher', () => {
  function startServer() {
    const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
    const module = {};
    const server = {
      watcher,
      ws: { send: vi.fn() },
      moduleGraph: { getModuleById: vi.fn(() => module), invalidateModule: vi.fn() },
    };
    const plugin = publishedAssets();
    hook(plugin, 'configureServer')(server);
    return { plugin, server, module };
  }
  const loadedFiles = (plugin: Plugin) =>
    JSON.parse(
      (hook(plugin, 'load')(publishedModule) as string).replace(/^export default |;$/g, ''),
    ).files as Record<string, unknown>;

  it('watches the published trees, which lie outside the app root', () => {
    const { server } = startServer();
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(publicDirectory, 'models'),
      resolve(publicDirectory, 'diffusion'),
    ]);
  });

  it('sends a full reload and invalidates the map on add, change and unlink', () => {
    const { plugin, server, module } = startServer();
    const file = resolve(publicDirectory, 'models/anatomies.json');
    server.watcher.emit('all', 'change', file);
    expect(server.ws.send).toHaveBeenLastCalledWith({ type: 'full-reload' });
    expect(server.moduleGraph.invalidateModule).toHaveBeenLastCalledWith(module);
    expect(loadedFiles(plugin)['models/anatomies.json']).toBeDefined();

    server.watcher.emit('all', 'unlink', file);
    expect(server.ws.send).toHaveBeenCalledTimes(2);
    expect(loadedFiles(plugin)['models/anatomies.json']).toBeUndefined();

    server.watcher.emit('all', 'add', file);
    expect(server.ws.send).toHaveBeenCalledTimes(3);
    expect(loadedFiles(plugin)['models/anatomies.json']).toBeDefined();
  });

  it('ignores other events and files outside the published trees', () => {
    const { server } = startServer();
    server.watcher.emit('all', 'addDir', resolve(publicDirectory, 'models'));
    server.watcher.emit('all', 'change', resolve(publicDirectory, 'robots.txt'));
    expect(server.ws.send).not.toHaveBeenCalled();
  });
});

describe('the build', () => {
  it('gives Three.js core its own three chunk, containing WebGLRenderer', async () => {
    const probe: Plugin = {
      name: 'three-probe',
      resolveId: (id) => (id === 'three-probe' ? '\0three-probe' : null),
      load: (id) =>
        id === '\0three-probe'
          ? "import { WebGLRenderer } from 'three'; import { MeshBVH } from 'three-mesh-bvh'; console.log(WebGLRenderer, MeshBVH);"
          : null,
    };
    const result = await build({
      root: webRoot,
      logLevel: 'silent',
      plugins: [probe],
      build: {
        outDir: resolve(scratch, 'build'),
        emptyOutDir: true,
        copyPublicDir: false,
        rolldownOptions: { input: 'three-probe' },
      },
    });
    const output = (Array.isArray(result) ? result[0] : result) as {
      output: { type: string; name: string; code: string }[];
    };
    const chunks = output.output.filter((item) => item.type === 'chunk');
    const three = chunks.find((chunk) => chunk.name === 'three');
    expect(three?.code).toContain('WebGLRenderer');
    expect(chunks.find((chunk) => chunk.name === 'bvh')?.code).toContain('MeshBVH');
    // The service worker is written beside the bundle.
    expect(readFileSync(resolve(scratch, 'build/sw.js'), 'utf8')).toContain('planum-models');
  }, 120_000);
});

describe('the built page', () => {
  it('declares its charset within the first 1024 bytes, ahead of the prefetch script and the stylesheet', async () => {
    const outDir = resolve(scratch, 'page');
    await build({
      root: webRoot,
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true, copyPublicDir: false },
    });
    const html = readFileSync(resolve(outDir, 'index.html'));
    const text = html.toString('utf8');
    expect(html.subarray(0, 1024).toString('utf8')).toContain('<meta charset="UTF-8"');
    expect(text.indexOf('window.__planumAssets')).toBeGreaterThan(-1);
    expect(text.indexOf('window.__planumAssets')).toBeLessThan(text.indexOf('rel="stylesheet"'));
  }, 120_000);

  it('keeps the published assets out of the preview build only', async () => {
    const copies = async (mode: string) =>
      (await resolveConfig({ root: webRoot, mode }, 'build')).build.copyPublicDir;
    expect(await copies('preview')).toBe(false);
    expect(await copies('production')).toBe(true);
  });
});

describe('the head prefetch script', () => {
  const versions = {
    'models/anatomies.json': 'index0000000000a',
    'models/bert/manifest.json': 'manifest00000000',
    'models/bert/cortex-hcp-mmp.glb': 'hcp0000000000000',
    'models/bert/nextbrain.glb': 'fine000000000000',
  };
  const source = readFileSync(resolve(webRoot, 'src/boot/prefetch.js'), 'utf8');
  const anatomies = JSON.parse(readPublic('models/anatomies.json'));
  const manifest = JSON.parse(readPublic(`models/${anatomies.default}/manifest.json`));

  /** Runs the script as the browser would, against a stub window, location and fetch. */
  function run(hash: string, versionMap: Record<string, string>, reply = '{}') {
    const requested: string[] = [];
    const window: { __planumAssets?: Record<string, Promise<Response>> } = {};
    const location = { hash, origin: 'https://example.org' };
    const fetch = async (url: string) => {
      requested.push(url);
      return new Response(reply);
    };
    new Function('window', 'location', 'fetch', prefetchScript(versionMap))(
      window,
      location,
      fetch,
    );
    return { requested, window };
  }

  it('fetches from the published root the build serves assets under', () => {
    expect(ASSET_BASE).toBe('/neuroatlas/');
    expect(legacyConfig.base).toBe(ASSET_BASE);
    const used = prefetchScript(versions).match(/var root = ("[^"]+");/);
    expect(used).not.toBeNull();
    expect(JSON.parse(used![1])).toBe(ASSET_BASE);
    for (const url of run('#anatomy=bert', versions).requested) {
      expect(new URL(url).pathname.startsWith(ASSET_BASE)).toBe(true);
    }
  });

  it('names only layers the manifest publishes', () => {
    const known = new Set([
      ...manifest.atlases.map((entry: { file: string }) => entry.file),
      ...manifest.detail_levels.map((entry: { file: string }) => entry.file),
      ...(manifest.supplemental_layers ?? []).map((entry: { file: string }) => entry.file),
    ]);
    const named = source.match(/'[\w-]+\.glb'/g) ?? [];
    expect(named.length).toBeGreaterThanOrEqual(2);
    for (const quoted of named) expect(known.has(quoted.slice(1, -1))).toBe(true);
  });

  it('offers every atlas and detail level a link can ask for', () => {
    for (const level of manifest.detail_levels) {
      expect(source.includes(`${level.id}:`) || source.includes(`'${level.file}'`)).toBe(true);
    }
    for (const atlas of manifest.atlases) expect(source).toContain(`'${atlas.file}'`);
  });

  it('reads the default brain from the index rather than assuming it', () => {
    expect(source).toMatch(/models\/anatomies\.json/);
    expect(source).toMatch(/published\.default/);
  });

  it('asks for each file at the version the build publishes for it', () => {
    const { requested, window } = run('#anatomy=bert&atlas=hcp-mmp&detail=nextbrain', versions);
    expect(requested.sort()).toEqual([
      'https://example.org/neuroatlas/models/anatomies.json?v=index0000000000a',
      'https://example.org/neuroatlas/models/bert/cortex-hcp-mmp.glb?v=hcp0000000000000',
      'https://example.org/neuroatlas/models/bert/manifest.json?v=manifest00000000',
      'https://example.org/neuroatlas/models/bert/nextbrain.glb?v=fine000000000000',
    ]);
    expect(Object.keys(window.__planumAssets!).sort()).toEqual(
      requested.map((url) => url.split('?')[0]).sort(),
    );
  });

  it('does not start the tissue envelopes or the cord for the first frame', () => {
    for (const file of [
      manifest.solid_envelopes.file,
      ...(manifest.supplemental_layers ?? []).map((layer: { file: string }) => layer.file),
    ]) {
      expect(source).not.toContain(file);
    }
  });

  it('reads the default brain from the index when the link names none', async () => {
    const { requested } = run(
      '',
      { ...versions, 'models/bert/learning.glb': 'x' },
      '{"default":"bert"}',
    );
    await vi.waitFor(() => expect(requested.length).toBe(4));
    expect(requested.map((url) => new URL(url).pathname)).toContain(
      `${ASSET_BASE}models/bert/manifest.json`,
    );
  });

  it('is injected inline into head by the build plugin', () => {
    const [tag] = hook(publishedAssets(), 'transformIndexHtml')('') as {
      tag: string;
      injectTo: string;
      children: string;
    }[];
    expect(tag.tag).toBe('script');
    expect(tag.injectTo).toBe('head');
    expect(tag.children).not.toMatch(/__PUBLISHED_VERSIONS__|__ASSET_BASE__/);
  });
});

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

  it('stores a published file on first request and serves it from storage after', async () => {
    const worker = await bootWorker();
    const url = urlOf(worker, 'models/bert/cortex-destrieux.glb');
    await worker.request(url);
    expect(worker.fetched).toHaveLength(1);
    const again = await worker.request(url);
    expect(worker.fetched).toHaveLength(1);
    expect(await again!.text()).toBe(bodyOf('models/bert/cortex-destrieux.glb'));
  });

  it('stores metadata and diffusion files, which are content-versioned too', async () => {
    const worker = await bootWorker();
    for (const path of [
      'models/bert/manifest.json',
      'diffusion/snail-subject-1/bundles_af.left.trk.gz',
    ]) {
      expect(await worker.request(urlOf(worker, path))).toBeTruthy();
    }
    expect(stored(worker)).toHaveLength(2);
  });

  it('intercepts only a request for this deploy’s version of a published file', async () => {
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

  it('never stores a failed, partial or mismatched download', async () => {
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

  it('deletes on a new deploy only the files it no longer publishes', async () => {
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

  it('takes over immediately rather than waiting for every tab to close', async () => {
    const worker = await bootWorker();
    worker.listeners.get('install')!({});
    expect(worker.self.skipped).toBe(true);
  });

  it('revalidates when filling the cache instead of trusting the HTTP cache', async () => {
    const worker = await bootWorker();
    await worker.request(urlOf(worker, 'models/bert/structures.glb'));
    expect(worker.fetchOptions[0]?.cache).toBe('no-cache');
  });

  it('always revalidates the page itself', async () => {
    const worker = await bootWorker();
    expect(await worker.request(`${ORIGIN}/neuroatlas/`, 'GET', 'navigate')).toBeTruthy();
    expect(worker.fetched).toEqual([`${ORIGIN}/neuroatlas/`]);
    expect(worker.fetchOptions[0]?.cache).toBe('no-cache');
  });

  it('stores a .gz file a server decodes on the way by the hash of its contents', async () => {
    const path = 'diffusion/snail-subject-1/bundles_af.left.trk.gz';
    const published = deploy(DEFAULT_FILES);
    published.gunzipped[path] = versionOf('decoded tract');
    const worker = await bootWorker(published);
    worker.responses.set(path, { status: 200, body: 'decoded tract' });
    await worker.request(urlOf(worker, path));
    expect(stored(worker)).toHaveLength(1);
  });
});
