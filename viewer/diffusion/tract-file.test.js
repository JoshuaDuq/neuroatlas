import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { decodeTractAsset } from './tract-file.js';

test('TRK decoding accepts original gzip files and HTTP-decompressed response bodies', async () => {
  const compressed = await readFile(new URL('../../public/diffusion/snail-subject-1/bundles_af.left.trk.gz', import.meta.url));
  const original = gunzipSync(compressed);
  const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gzip = await decodeTractAsset(buffer(compressed));
  const http = await decodeTractAsset(buffer(original));
  assert.deepEqual(gzip.offsetPt0, http.offsetPt0);
  assert.deepEqual(gzip.pts, http.pts);
  assert.equal(http.offsetPt0.length - 1, 721);
});
