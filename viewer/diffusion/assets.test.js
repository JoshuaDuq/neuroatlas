import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.__MODEL_VERSION__ = 'diffusion-test-version';
const { fetchDiffusionAsset } = await import('./assets.js');
delete globalThis.__MODEL_VERSION__;

test('diffusion requests pin the published version and revalidate stable filenames', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(new Uint8Array([10, 20, 30]));
  });
  const url = 'https://example.test/neuroatlas/diffusion/brain.nii.gz';
  const asset = await fetchDiffusionAsset(url);
  assert.equal(calls[0].url, `${url}?v=diffusion-test-version`);
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.deepEqual(new Uint8Array(asset.buffer), new Uint8Array([10, 20, 30]));
});

test('missing diffusion files report their HTTP error', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
  await assert.rejects(
    fetchDiffusionAsset('https://example.test/missing.trk.gz'),
    /missing\.trk\.gz \(HTTP 404\)/,
  );
});
