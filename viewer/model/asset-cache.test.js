import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAsset, resetAssetCache } from './asset-cache.js';

function responseFor(bytes, { length = true } = {}) {
  const body = new Uint8Array(bytes).map((_, i) => i + 1);
  const headers = length ? { 'Content-Length': String(body.byteLength) } : {};
  return new Response(body, { status: 200, headers });
}

test('fetchAsset reuses an in-flight request and fans progress out to every listener', async () => {
  resetAssetCache();
  let fetches = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    fetches += 1;
    return responseFor(8);
  };
  try {
    const seenA = [];
    const seenB = [];
    const a = fetchAsset('https://example.test/a.glb', {
      onProgress: event => seenA.push({ ...event }),
    });
    const b = fetchAsset('https://example.test/a.glb', {
      onProgress: event => seenB.push({ ...event }),
    });
    const [left, right] = await Promise.all([a, b]);
    assert.equal(fetches, 1);
    assert.equal(left.byteLength, 8);
    assert.equal(right.byteLength, 8);
    assert.deepEqual(seenA.at(-1), { loaded: 8, total: 8 });
    assert.deepEqual(seenB.at(-1), { loaded: 8, total: 8 });
  } finally {
    globalThis.fetch = original;
    resetAssetCache();
  }
});

test('fetchAsset consumes a head-started response instead of opening a second download', async () => {
  resetAssetCache();
  let fetches = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    fetches += 1;
    throw new Error('network fetch should not run');
  };
  globalThis.__neuroatlasAssets = {
    'https://example.test/b.glb': Promise.resolve(responseFor(4)),
  };
  try {
    const buffer = await fetchAsset('https://example.test/b.glb');
    assert.equal(fetches, 0);
    assert.equal(buffer.byteLength, 4);
    assert.equal(globalThis.__neuroatlasAssets['https://example.test/b.glb'], undefined);
  } finally {
    globalThis.fetch = original;
    delete globalThis.__neuroatlasAssets;
    resetAssetCache();
  }
});
