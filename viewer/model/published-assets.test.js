import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPublished } from './published-assets.js';
import PUBLISHED from './published-files.js';

function publish(t, files) {
  Object.assign(PUBLISHED, { base: '/neuroatlas/', files });
  t.after(() => Object.assign(PUBLISHED, { base: '/', files: null }));
}

function recordFetches(t) {
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { seen.push([url, options]); return new Response(''); });
  return seen;
}

test('each published request carries that file’s own version', async t => {
  publish(t, {
    'models/bert/learning.glb': { version: 'aaaa', sha256: 'a'.repeat(64), size: 1 },
    'models/bert/manifest.json': { version: 'bbbb', sha256: 'b'.repeat(64), size: 1 },
  });
  const seen = recordFetches(t);
  await fetchPublished('https://example.test/neuroatlas/models/bert/learning.glb');
  await fetchPublished('https://example.test/neuroatlas/models/bert/manifest.json');
  assert.equal(seen[0][0], 'https://example.test/neuroatlas/models/bert/learning.glb?v=aaaa');
  assert.equal(seen[1][0], 'https://example.test/neuroatlas/models/bert/manifest.json?v=bbbb');
  assert.equal(seen[0][1].cache, 'no-cache');
});

test('a file the build did not publish is refused before any request', async t => {
  publish(t, {});
  const seen = recordFetches(t);
  assert.throws(() => fetchPublished('https://example.test/neuroatlas/models/bert/missing.glb'),
    error => error.code === 'asset-fetch' && /missing\.glb/.test(error.message));
  assert.equal(seen.length, 0);
});

test('without a published map requests go out unversioned', async t => {
  const seen = recordFetches(t);
  await fetchPublished('https://example.test/neuroatlas/models/bert/learning.glb');
  assert.equal(seen[0][0], 'https://example.test/neuroatlas/models/bert/learning.glb');
});
