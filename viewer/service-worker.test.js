import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The worker runs in a scope Node does not have, so it is loaded into a stub
 * of one. That is the only way to check the rules that matter — what it
 * stores, what it refuses to store, and which caches a new version deletes —
 * without a browser and a deploy.
 */
const SOURCE = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');

function bootWorker({ version = 'testversion', origin = 'https://example.org' } = {}) {
  const listeners = new Map();
  const storage = new Map();
  const fetched = [];

  const cacheFor = name => {
    if (!storage.has(name)) storage.set(name, new Map());
    const entries = storage.get(name);
    return {
      match: async key => entries.get(String(key)),
      put: async (key, value) => { entries.set(String(key), value); },
      keys: async () => [...entries.keys()],
    };
  };
  const caches = {
    open: async name => cacheFor(name),
    keys: async () => [...storage.keys()],
    delete: async name => storage.delete(name),
  };

  const self = {
    location: { origin },
    addEventListener: (type, handler) => listeners.set(type, handler),
    skipWaiting: () => { self.skipped = true; },
    clients: { claim: async () => { self.claimed = true; } },
  };

  const responses = new Map();
  const fetchOptions = [];
  const fetchStub = async (url, options) => {
    fetched.push(String(url));
    fetchOptions.push(options);
    const made = responses.get(String(url))
      ?? { ok: true, status: 200, body: `bytes:${url}` };
    return { ...made, clone: () => ({ ...made }) };
  };

  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', 'URL',
    SOURCE.replace('__MODEL_VERSION__', version))(self, caches, fetchStub, URL);

  const request = (url, method = 'GET', mode = 'cors') => {
    const handler = listeners.get('fetch');
    let answered;
    handler({ request: { method, url, mode }, respondWith: promise => { answered = promise; } });
    return answered;
  };

  return { self, listeners, storage, fetched, fetchOptions, responses, request, caches };
}

const modelUrl = (origin, file) => `${origin}/neuroatlas/models/bert/${file}`;

test('the anatomy is stored on first request and served from storage after', async () => {
  const worker = bootWorker();
  const url = modelUrl('https://example.org', 'cortex-destrieux.glb');
  await worker.request(url);
  assert.deepEqual(worker.fetched, ['/neuroatlas/models/bert/cortex-destrieux.glb']);

  const again = await worker.request(url);
  assert.equal(worker.fetched.length, 1, 'the second visit did not go to the network');
  assert.ok(again, 'and still got an answer');
});

test('only the large immutable anatomy is stored', async () => {
  const worker = bootWorker();
  const origin = 'https://example.org';
  // Metadata decides which binaries are valid, so it must never be pinned to
  // a version the rest of the site has moved past.
  for (const file of ['manifest.json', 'tissue-labels.json', 'volumes.json']) {
    assert.equal(worker.request(modelUrl(origin, file)), undefined, file);
  }
  for (const file of ['cortex-destrieux.glb', 'mri.volume', 'ribbon-destrieux.labels']) {
    assert.ok(worker.request(modelUrl(origin, file)), file);
  }
  assert.equal(worker.request(`${origin}/neuroatlas/assets/index-abc.js`), undefined);
  assert.equal(worker.request(`${origin}/neuroatlas/`), undefined);
});

test('another origin is left entirely alone', () => {
  const worker = bootWorker();
  assert.equal(worker.request(modelUrl('https://elsewhere.test', 'learning.glb')), undefined);
});

test('a write is never intercepted', () => {
  const worker = bootWorker();
  const url = modelUrl('https://example.org', 'learning.glb');
  assert.equal(worker.request(url, 'POST'), undefined);
});

test('a failed download never becomes the copy every later visit gets', async () => {
  const worker = bootWorker();
  const url = modelUrl('https://example.org', 'nextbrain.glb');
  worker.responses.set('/neuroatlas/models/bert/nextbrain.glb',
    { ok: false, status: 502, body: 'gateway' });
  await worker.request(url);
  const cache = await worker.caches.open('neuroatlas-models-testversion');
  assert.deepEqual(await cache.keys(), [], 'a 502 was not stored');

  worker.responses.delete('/neuroatlas/models/bert/nextbrain.glb');
  await worker.request(url);
  assert.equal((await cache.keys()).length, 1, 'the retry stored the real file');
});

test('a partial response is not stored either', async () => {
  const worker = bootWorker();
  const url = modelUrl('https://example.org', 'structures.glb');
  worker.responses.set('/neuroatlas/models/bert/structures.glb',
    { ok: true, status: 206, body: 'half' });
  await worker.request(url);
  const cache = await worker.caches.open('neuroatlas-models-testversion');
  assert.deepEqual(await cache.keys(), []);
});

test('publishing a new brain deletes the cache the old one filled', async () => {
  const worker = bootWorker({ version: 'second' });
  worker.storage.set('neuroatlas-models-first', new Map([['/old.glb', {}]]));
  worker.storage.set('neuroatlas-models-second', new Map());
  worker.storage.set('something-else', new Map([['/keep', {}]]));

  let finished;
  worker.listeners.get('activate')({ waitUntil: promise => { finished = promise; } });
  await finished;

  assert.deepEqual([...worker.storage.keys()].sort(),
    ['neuroatlas-models-second', 'something-else']);
  assert.ok(worker.self.claimed, 'and takes over the open pages');
});

test('it takes over immediately rather than waiting for every tab to close', () => {
  const worker = bootWorker();
  worker.listeners.get('install')({});
  assert.ok(worker.self.skipped);
});

test('a copy stored for one model version never answers a request for another', async () => {
  const worker = bootWorker();
  const url = modelUrl('https://example.org', 'cortex-destrieux.glb');
  await worker.request(`${url}?v=old`);
  await worker.request(`${url}?v=new`);
  assert.deepEqual(worker.fetched, [
    '/neuroatlas/models/bert/cortex-destrieux.glb?v=old',
    '/neuroatlas/models/bert/cortex-destrieux.glb?v=new',
  ]);
});

test('filling the cache revalidates instead of trusting the HTTP cache', async () => {
  const worker = bootWorker();
  await worker.request(modelUrl('https://example.org', 'learning.glb'));
  assert.equal(worker.fetchOptions[0].cache, 'no-cache');
});

test('the page itself is always revalidated, so its model version is current', async () => {
  const worker = bootWorker();
  const answered = worker.request('https://example.org/neuroatlas/', 'GET', 'navigate');
  assert.ok(answered, 'navigations are answered by the worker');
  await answered;
  assert.deepEqual(worker.fetched, ['https://example.org/neuroatlas/']);
  assert.equal(worker.fetchOptions[0].cache, 'no-cache');
});
