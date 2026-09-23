import assert from 'node:assert/strict';
import test from 'node:test';

test('every published request carries the model version the build stamped', async () => {
  globalThis.__MODEL_VERSION__ = 'abc123';
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => { seen.push([url, options]); return new Response(''); };
  try {
    const { fetchPublished } = await import(`./published-assets.js?case=${Date.now()}`);
    await fetchPublished('https://example.test/neuroatlas/models/bert/learning.glb');
    assert.equal(seen[0][0], 'https://example.test/neuroatlas/models/bert/learning.glb?v=abc123');
    assert.equal(seen[0][1].cache, 'no-cache');
  } finally {
    globalThis.fetch = original;
    delete globalThis.__MODEL_VERSION__;
  }
});
