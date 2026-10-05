import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NVImage, NVMeshLoaders } from '@niivue/niivue';
import { parse } from 'yaml';
import { validateVolume } from './validation.js';
import { streamlineLengths, summarizeLengths } from './streamlines.js';
import { createTractGeometry } from './native-geometry.js';

const directory = new URL('../../public/diffusion/', import.meta.url);
const catalog = parse(await readFile(new URL('../../data/diffusion.yaml', import.meta.url), 'utf8'));
const provenance = JSON.parse(await readFile(new URL(catalog.provenance, directory), 'utf8'));
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const arrayBuffer = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

function near(actual, expected, tolerance = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('bundled scalar maps retain original NIfTI bytes and their declared grid', async () => {
  for (const map of catalog.maps) {
    const record = provenance.files.find(file => map.file.endsWith(`/${file.file}`));
    const data = await readFile(new URL(map.file, directory));
    assert.equal(digest(data), record.source_sha256);
    const image = await NVImage.new(arrayBuffer(data), map.file);
    validateVolume(image);
    assert.deepEqual(image.hdr.dims.slice(1, 4), record.shape);
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) near(image.hdr.affine[row][column], record.affine[row][column]);
    }
  }
});

test('all named bundles decode in the NiBabel RAS+ space with matching geometry', async () => {
  assert.equal(catalog.bundles.length, 27);
  assert.equal(new Set(catalog.bundles.map(bundle => bundle.id)).size, catalog.bundles.length);
  for (const bundle of catalog.bundles) {
    const record = provenance.files.find(file => bundle.file.endsWith(`/${file.file}`));
    assert.ok(record, `Missing provenance for ${bundle.id}`);
    const compressed = await readFile(new URL(bundle.file, directory));
    assert.equal(digest(compressed), record.published_sha256);
    const original = gunzipSync(compressed);
    assert.equal(digest(original), record.source_sha256);
    const mesh = await NVMeshLoaders.readTRK(arrayBuffer(original));
    assert.equal(mesh.pts.length / 3, record.points);
    assert.equal(mesh.offsetPt0.length - 1, record.streamlines);
    for (const sample of record.rasmm_samples) {
      for (let axis = 0; axis < 3; axis++) near(mesh.pts[sample.index * 3 + axis], sample.position[axis]);
    }
    const lengths = streamlineLengths(mesh.pts, mesh.offsetPt0);
    const native = createTractGeometry(mesh.pts, mesh.offsetPt0);
    const position = native.geometry.getAttribute('position');
    assert.equal(position.count, record.points);
    for (const sample of record.rasmm_samples) {
      near(position.getX(sample.index) * 1000, sample.position[0], 0.001);
      near(-position.getZ(sample.index) * 1000, sample.position[1], 0.001);
      near(position.getY(sample.index) * 1000, sample.position[2], 0.001);
    }
    native.geometry.dispose();
    for (const expected of record.length_summaries) {
      const actual = summarizeLengths(lengths, expected.minimum_mm);
      assert.equal(actual.shown, expected.shown, bundle.id);
      for (const statistic of ['mean', 'min', 'max']) {
        if (expected[`${statistic}_mm`] === null) assert.equal(actual[statistic], null);
        else near(actual[statistic], expected[`${statistic}_mm`], 0.001);
      }
    }
  }
});
