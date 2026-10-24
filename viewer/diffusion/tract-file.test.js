import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createTractLoader, decodeTractAsset } from './tract-file.js';

test('TRK decoding accepts original gzip files and HTTP-decompressed response bodies', async () => {
  const compressed = await readFile(new URL('../../public/diffusion/cdmd-sub-013/af.left.trk.gz', import.meta.url));
  const original = gunzipSync(compressed);
  const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gzip = await decodeTractAsset(buffer(compressed));
  const http = await decodeTractAsset(buffer(original));
  assert.deepEqual(gzip.offsetPt0, http.offsetPt0);
  assert.deepEqual(gzip.pts, http.pts);
  assert.equal(http.offsetPt0.length - 1, 3639);
});

test('the 3D lines and the MRI navigator share one download and one decode per tract', async () => {
  const compressed = await readFile(new URL('../../public/diffusion/cdmd-sub-013/callosum_1.trk.gz', import.meta.url));
  let reads = 0;
  const loadTract = createTractLoader(async () => {
    reads += 1;
    return { buffer: compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) };
  });
  const bundle = { file: 'cdmd-sub-013/callosum_1.trk.gz' };
  const [lines, navigator] = await Promise.all([loadTract(bundle), loadTract(bundle)]);
  assert.equal(reads, 1);
  assert.equal(lines, navigator);
  assert.equal(await loadTract(bundle), lines, 'and later requests too');
  assert.equal(lines.lengths.length, lines.offsetPt0.length - 1);
});

test('a failed tract download is not kept, so a retry downloads it again', async () => {
  let reads = 0;
  const loadTract = createTractLoader(async () => {
    reads += 1;
    throw new Error('HTTP 503');
  });
  const bundle = { file: 'cdmd-sub-013/callosum_1.trk.gz' };
  await assert.rejects(loadTract(bundle), /503/);
  await assert.rejects(loadTract(bundle), /503/);
  assert.equal(reads, 2);
});
