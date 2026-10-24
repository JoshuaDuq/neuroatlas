import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fetchAsset } from './asset-cache.js';
import PUBLISHED from './published-files.js';

function bytesOf(count) {
  return new Uint8Array(count).map((_, i) => i + 1);
}

function responseFor(count, { length = true } = {}) {
  const body = bytesOf(count);
  const headers = length ? { 'Content-Length': String(body.byteLength) } : {};
  return new Response(body, { status: 200, headers });
}

function publish(t, path, bytes) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  Object.assign(PUBLISHED, { base: '/neuroatlas/', files: { [path]: { version: sha256.slice(0, 16), sha256, size: bytes.byteLength } } });
  t.after(() => Object.assign(PUBLISHED, { base: '/', files: null }));
}

test('fetchAsset reuses an in-flight request and fans progress out to every listener', async t => {
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetches += 1;
    return responseFor(8);
  });
  const seenA = [];
  const seenB = [];
  const a = fetchAsset('https://example.test/a.glb', { onProgress: event => seenA.push({ ...event }) });
  const b = fetchAsset('https://example.test/a.glb', { onProgress: event => seenB.push({ ...event }) });
  const [left, right] = await Promise.all([a, b]);
  assert.equal(fetches, 1);
  assert.equal(left.byteLength, 8);
  assert.equal(right.byteLength, 8);
  assert.deepEqual(seenA.at(-1), { loaded: 8, total: 8 });
  assert.deepEqual(seenB.at(-1), { loaded: 8, total: 8 });
});

test('fetchAsset consumes a head-started response instead of opening a second download', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network fetch should not run'); });
  globalThis.__planumAssets = { 'https://example.test/b.glb': Promise.resolve(responseFor(4)) };
  t.after(() => { delete globalThis.__planumAssets; });
  const buffer = await fetchAsset('https://example.test/b.glb');
  assert.equal(buffer.byteLength, 4);
  assert.equal(globalThis.__planumAssets['https://example.test/b.glb'], undefined);
});

test('bytes that are not the published file’s fail as an update, not as data', async t => {
  publish(t, 'models/bert/manifest.json', bytesOf(6));
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([9, 9, 9, 9, 9, 9])));
  await assert.rejects(fetchAsset('https://example.test/neuroatlas/models/bert/manifest.json'),
    error => error.code === 'asset-updated');
});

test('the published bytes pass and the request names their version', async t => {
  publish(t, 'models/bert/manifest.json', bytesOf(6));
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => { urls.push(url); return responseFor(6); });
  const buffer = await fetchAsset('https://example.test/neuroatlas/models/bert/manifest.json');
  assert.deepEqual(new Uint8Array(buffer), bytesOf(6));
  assert.match(urls[0], /manifest\.json\?v=[0-9a-f]{16}$/);
});

test('HTTP and network failures carry the asset-fetch code', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(fetchAsset('https://example.test/c.glb'),
    error => error.code === 'asset-fetch' && error.status === 503);
  const failure = new TypeError('Failed to fetch');
  t.mock.method(globalThis, 'fetch', async () => { throw failure; });
  await assert.rejects(fetchAsset('https://example.test/c.glb'),
    error => error.code === 'asset-fetch' && error.cause === failure && error.status === undefined);
});

test('a gzip-encoded response reports progress against the decoded size, never past it', async t => {
  publish(t, 'models/bert/learning.glb', bytesOf(40));
  // The server's Content-Length counts the gzip bytes; the stream yields decoded ones.
  t.mock.method(globalThis, 'fetch', async () => new Response(bytesOf(40),
    { headers: { 'Content-Encoding': 'gzip', 'Content-Length': '12' } }));
  const seen = [];
  await fetchAsset('https://example.test/neuroatlas/models/bert/learning.glb', { onProgress: event => seen.push(event) });
  assert.ok(seen.every(({ loaded, total }) => total === 40 && loaded <= total));
});

test('without a published size, an encoded Content-Length is not taken for the total', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(bytesOf(40),
    { headers: { 'Content-Encoding': 'gzip', 'Content-Length': '12' } }));
  const seen = [];
  await fetchAsset('https://example.test/d.glb', { onProgress: event => seen.push(event) });
  assert.deepEqual(seen, [{ loaded: 40, total: 40 }]);
});

test('a .gz file a server decodes on the way is checked against its contents', async t => {
  const { gzipSync } = await import('node:zlib');
  const contents = bytesOf(30);
  const file = gzipSync(contents);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  Object.assign(PUBLISHED, { base: '/neuroatlas/', files: { 'diffusion/a.trk.gz': {
    version: digest(file).slice(0, 16), sha256: digest(file), size: file.byteLength,
    gunzipped: { sha256: digest(contents), size: contents.byteLength } } } });
  t.after(() => Object.assign(PUBLISHED, { base: '/', files: null }));
  const url = 'https://example.test/neuroatlas/diffusion/a.trk.gz';
  t.mock.method(globalThis, 'fetch', async () => new Response(file));
  assert.deepEqual(new Uint8Array(await fetchAsset(url)), new Uint8Array(file));
  const seen = [];
  t.mock.method(globalThis, 'fetch', async () => new Response(contents, { headers: { 'Content-Encoding': 'gzip' } }));
  assert.deepEqual(new Uint8Array(await fetchAsset(url, { onProgress: event => seen.push(event) })), contents);
  assert.deepEqual(seen.at(-1), { loaded: 30, total: 30 });
  t.mock.method(globalThis, 'fetch', async () => new Response(bytesOf(29), { headers: { 'Content-Encoding': 'gzip' } }));
  await assert.rejects(fetchAsset(url), error => error.code === 'asset-updated');
});
