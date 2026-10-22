import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import PUBLISHED from '../model/published-files.js';
import { fetchDiffusionAsset } from './assets.js';

test('diffusion requests pin the file’s published version and revalidate', async t => {
  const bytes = new Uint8Array([10, 20, 30]);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  Object.assign(PUBLISHED, { base: '/neuroatlas/',
    files: { 'diffusion/brain.nii.gz': { version: sha256.slice(0, 16), sha256, size: 3 } } });
  t.after(() => Object.assign(PUBLISHED, { base: '/', files: null }));
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(bytes);
  });
  const url = 'https://example.test/neuroatlas/diffusion/brain.nii.gz';
  const asset = await fetchDiffusionAsset(url);
  assert.equal(calls[0].url, `${url}?v=${sha256.slice(0, 16)}`);
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.deepEqual(new Uint8Array(asset.buffer), bytes);
});

test('missing diffusion files report their HTTP error', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
  await assert.rejects(
    fetchDiffusionAsset('https://example.test/missing.trk.gz'),
    error => error.code === 'asset-fetch' && error.status === 404 && /missing\.trk\.gz/.test(error.message),
  );
});
