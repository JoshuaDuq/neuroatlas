import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The worker runs in a scope Node does not have, so it is loaded into a stub
 * of one. That is the only way to check the rules that matter — what it
 * stores, what it refuses to store, and what a new deploy deletes — without a
 * browser and a deploy.
 */
const SOURCE = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');

const ORIGIN = 'https://example.org';
const versionOf = body => createHash('sha256').update(body).digest('hex').slice(0, 16);
const bodyOf = path => `bytes:${path}`;

/** The deploy's files, each published with the hash of the body the stub server returns for it. */
function deploy(paths) {
  return { base: '/neuroatlas/', files: Object.fromEntries(paths.map(path => [path, versionOf(bodyOf(path))])),
    gunzipped: {} };
}

const DEFAULT_FILES = ['models/bert/cortex-destrieux.glb', 'models/bert/manifest.json',
  'models/bert/nextbrain.glb', 'models/bert/structures.glb', 'diffusion/snail-subject-1/bundles_af.left.trk.gz'];

function bootWorker({ published = deploy(DEFAULT_FILES) } = {}) {
  const listeners = new Map();
  const storage = new Map();
  const fetched = [];

  const cacheFor = name => {
    if (!storage.has(name)) storage.set(name, new Map());
    const entries = storage.get(name);
    return {
      match: async key => entries.get(String(key))?.clone(),
      put: async (key, value) => { entries.set(String(key), value); },
      keys: async () => [...entries.keys()].map(key => ({ url: new URL(key, ORIGIN).href, key })),
      delete: async request => entries.delete(request.key),
    };
  };
  const caches = {
    open: async name => cacheFor(name),
    keys: async () => [...storage.keys()],
    delete: async name => storage.delete(name),
  };

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, handler) => listeners.set(type, handler),
    skipWaiting: () => { self.skipped = true; },
    clients: { claim: async () => { self.claimed = true; } },
  };

  const responses = new Map();
  const fetchOptions = [];
  const fetchStub = async (url, options) => {
    fetched.push(String(url));
    fetchOptions.push(options);
    const path = new URL(url, ORIGIN).pathname.replace('/neuroatlas/', '');
    const made = responses.get(path) ?? { status: 200, body: bodyOf(path) };
    return new Response(made.body, { status: made.status });
  };

  new Function('self', 'caches', 'fetch', 'URL',
    SOURCE.replace('__PUBLISHED_VERSIONS__', JSON.stringify(published)))(self, caches, fetchStub, URL);

  /** The answer the page gets, after anything the worker kept alive to store has finished. */
  const request = async (url, method = 'GET', mode = 'cors') => {
    const handler = listeners.get('fetch');
    let answered;
    const lifetime = [];
    handler({
      request: { method, url, mode },
      respondWith: promise => { answered = promise; },
      waitUntil: promise => { lifetime.push(promise); },
    });
    if (!answered) return undefined;
    const response = await answered;
    await Promise.all(lifetime);
    return response;
  };

  const activate = async () => {
    let finished;
    listeners.get('activate')({ waitUntil: promise => { finished = promise; } });
    await finished;
  };

  return { self, listeners, storage, fetched, fetchOptions, responses, request, activate, published };
}

const urlOf = (worker, path, version = worker.published.files[path]) =>
  `${ORIGIN}/neuroatlas/${path}${version === null ? '' : `?v=${version}`}`;
const stored = worker => [...(worker.storage.get('planum-models')?.keys() ?? [])];

test('a published file is stored on first request and served from storage after', async () => {
  const worker = bootWorker();
  const url = urlOf(worker, 'models/bert/cortex-destrieux.glb');
  await worker.request(url);
  assert.equal(worker.fetched.length, 1);
  const again = await worker.request(url);
  assert.equal(worker.fetched.length, 1, 'the second visit did not go to the network');
  assert.equal(await again.text(), bodyOf('models/bert/cortex-destrieux.glb'));
});

test('metadata and diffusion files are content-versioned too, so they are stored', async () => {
  const worker = bootWorker();
  for (const path of ['models/bert/manifest.json', 'diffusion/snail-subject-1/bundles_af.left.trk.gz']) {
    assert.ok(await worker.request(urlOf(worker, path)), path);
  }
  assert.equal(stored(worker).length, 2);
});

test('only a request for this deploy’s version of a published file is intercepted', async () => {
  const worker = bootWorker();
  const path = 'models/bert/cortex-destrieux.glb';
  assert.equal(await worker.request(urlOf(worker, path, null)), undefined, 'unversioned');
  assert.equal(await worker.request(urlOf(worker, path, 'previousdeploy00')), undefined, 'another version');
  assert.equal(await worker.request(`${ORIGIN}/neuroatlas/models/bert/unpublished.glb?v=1`), undefined);
  assert.equal(await worker.request(`${ORIGIN}/neuroatlas/assets/index-abc.js`), undefined);
  assert.equal(await worker.request(`https://elsewhere.test/neuroatlas/${path}?v=${worker.published.files[path]}`), undefined);
  assert.equal(await worker.request(urlOf(worker, path), 'POST'), undefined);
  assert.deepEqual(worker.fetched, []);
});

test('a failed, partial or mismatched download never becomes the copy every later visit gets', async () => {
  const worker = bootWorker();
  const path = 'models/bert/nextbrain.glb';
  for (const made of [{ status: 502, body: 'gateway' }, { status: 206, body: 'half' },
    { status: 200, body: 'bytes from another deploy' }]) {
    worker.responses.set(path, made);
    await worker.request(urlOf(worker, path));
    assert.deepEqual(stored(worker), [], `${made.status} ${made.body} was stored`);
  }
  worker.responses.delete(path);
  await worker.request(urlOf(worker, path));
  assert.equal(stored(worker).length, 1, 'the retry stored the real file');
});

test('a new deploy deletes only the files it no longer publishes', async () => {
  const first = bootWorker();
  for (const path of ['models/bert/cortex-destrieux.glb', 'models/bert/structures.glb']) {
    await first.request(urlOf(first, path));
  }
  const second = bootWorker({ published: { ...first.published, files: {
    ...first.published.files, 'models/bert/structures.glb': 'changedstructure' } } });
  second.storage.set('planum-models', first.storage.get('planum-models'));
  second.storage.set('neuroatlas-models', new Map([['/old.glb', new Response('')]]));
  second.storage.set('neuroatlas-models-oldglobal', new Map([['/old.glb', new Response('')]]));
  second.storage.set('something-else', new Map([['/keep', new Response('')]]));
  await second.activate();
  assert.deepEqual([...second.storage.keys()].sort(), ['planum-models', 'something-else']);
  assert.deepEqual(stored(second), [`/neuroatlas/models/bert/cortex-destrieux.glb?v=${first.published.files['models/bert/cortex-destrieux.glb']}`]);
  assert.ok(second.self.claimed, 'and takes over the open pages');
});

test('it takes over immediately rather than waiting for every tab to close', () => {
  const worker = bootWorker();
  worker.listeners.get('install')({});
  assert.ok(worker.self.skipped);
});

test('filling the cache revalidates instead of trusting the HTTP cache', async () => {
  const worker = bootWorker();
  await worker.request(urlOf(worker, 'models/bert/structures.glb'));
  assert.equal(worker.fetchOptions[0].cache, 'no-cache');
});

test('the page itself is always revalidated, so the versions it asks for are current', async () => {
  const worker = bootWorker();
  const answered = await worker.request(`${ORIGIN}/neuroatlas/`, 'GET', 'navigate');
  assert.ok(answered, 'navigations are answered by the worker');
  assert.deepEqual(worker.fetched, [`${ORIGIN}/neuroatlas/`]);
  assert.equal(worker.fetchOptions[0].cache, 'no-cache');
});

test('a .gz file a server decodes on the way is stored by the hash of its contents', async () => {
  const path = 'diffusion/snail-subject-1/bundles_af.left.trk.gz';
  const published = deploy(DEFAULT_FILES);
  published.gunzipped[path] = versionOf('decoded tract');
  const worker = bootWorker({ published });
  worker.responses.set(path, { status: 200, body: 'decoded tract' });
  await worker.request(urlOf(worker, path));
  assert.equal(stored(worker).length, 1);
});
