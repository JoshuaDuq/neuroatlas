import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'vitest';
import { repoRoot } from '../../../../test/repo.ts';
import { createTractLoader, decodeTractAsset } from './tract-file.ts';

const tract = (name: string) => readFile(resolve(repoRoot, 'public/diffusion/cdmd-sub-013', name));
const arrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

test('TRK decoding accepts original gzip files and HTTP-decompressed response bodies', async () => {
  const compressed = await tract('af.left.trk.gz');
  const original = gunzipSync(compressed);
  const gzip = await decodeTractAsset(arrayBuffer(compressed));
  const http = await decodeTractAsset(arrayBuffer(original));
  assert.deepEqual(gzip.offsetPt0, http.offsetPt0);
  assert.deepEqual(gzip.pts, http.pts);
  assert.equal(http.offsetPt0.length - 1, 3639);
  assert.equal(http.pts.length / 3, 850570);
});

test('the 3D lines and the MRI navigator share one download and one decode per tract', async () => {
  const compressed = await tract('callosum_1.trk.gz');
  let reads = 0;
  const loadTract = createTractLoader(async () => {
    reads += 1;
    return { buffer: arrayBuffer(compressed) };
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
