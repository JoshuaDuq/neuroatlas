import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const { tract_catalogs: paths } = parse(await readFile(new URL('config/model.yaml', root), 'utf8'));
const catalogs = await Promise.all(paths.map(async path => parse(await readFile(new URL(path, root), 'utf8'))));
const directory = new URL('public/diffusion/', root);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

for (const catalog of catalogs) test(`${catalog.id}: the MRI outline belongs to the tract reference and has explicit processing provenance`, async () => {
  const settings = catalog.brain_outline;
  const provenance = JSON.parse(await readFile(new URL(settings.provenance, directory), 'utf8'));
  const original = JSON.parse(await readFile(new URL(catalog.provenance, directory), 'utf8'));
  // A skull-stripped map is outlined on its own grid; otherwise the catalog names
  // a skull-stripped volume in the same scanner frame.
  const source = await readFile(settings.source_map ? new URL(provenance.source, directory) : new URL(settings.source, root));
  const published = await readFile(new URL(settings.file, directory));
  assert.equal(digest(source), provenance.source_sha256);
  assert.equal(digest(published), provenance.published_sha256);
  if (settings.source_map) assert.deepEqual(provenance.source_affine, original.files[0].affine);
  else assert.equal(provenance.source, settings.source);
  assert.equal(provenance.intensity_threshold, settings.intensity_threshold);
  assert.equal(provenance.step_size_voxels, settings.step_size);
  assert.match(provenance.limitations, /not a pial or labeled/);
  assert.equal(published.readUInt32LE(0), 0x46546c67);
  assert.equal(published.readUInt32LE(4), 2);
  assert.equal(published.readUInt32LE(8), published.length);
  const length = published.readUInt32LE(12);
  const gltf = JSON.parse(published.subarray(20, 20 + length).toString());
  const primitive = gltf.meshes[0].primitives[0];
  const position = gltf.accessors[primitive.attributes.POSITION];
  assert.equal(position.count, provenance.vertices);
  assert.equal(gltf.accessors[primitive.indices].count, provenance.triangles * 3);
  const [minimum, maximum] = provenance.ras_bounds_mm;
  const expectedMinimum = [minimum[0], minimum[2], -maximum[1]].map(value => value / 1000);
  const expectedMaximum = [maximum[0], maximum[2], -minimum[1]].map(value => value / 1000);
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(position.min[axis] - expectedMinimum[axis]) < 1e-7);
    assert.ok(Math.abs(position.max[axis] - expectedMaximum[axis]) < 1e-7);
  }
});
