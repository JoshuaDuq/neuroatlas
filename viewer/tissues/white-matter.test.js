import assert from 'node:assert/strict';
import test from 'node:test';
import { rasToWorld } from '../slices/coordinates.js';
import { Volume } from '../slices/volume.js';
import { HIGHLIGHT_LIFT } from './highlight.js';
import { createWhiteMatter } from './white-matter.js';

const PRECENTRAL = 'wmparc:left:3024';
const INSULA = 'wmparc:right:4035';

// A 3x2x2 crop of a 1 mm grid, its corner 10 mm to the right of the origin.
const record = {
  shape: [3, 2, 2],
  order: 'F',
  voxel_to_surface_ras_mm: [[-1, 0, 0, 10], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]],
  applies_to: ['destrieux', 'hcp-mmp'],
  labels: [
    { source_label_id: 0, region_id: null },
    { source_label_id: 3024, region_id: PRECENTRAL },
    { source_label_id: 4035, region_id: INSULA },
  ],
};

function whiteMatter() {
  const codes = new Uint8Array(12);
  codes[2] = 1; // voxel (2, 0, 0), at RAS (8, 0, 0)
  codes[9] = 2; // voxel (0, 1, 1), at RAS (10, 1, -1)
  return createWhiteMatter(record, new Volume(record, codes));
}

test('a point on the cut names the parcel whose voxel holds it', () => {
  const matter = whiteMatter();
  assert.equal(matter.regionAt([8, 0, 0]), PRECENTRAL);
  assert.equal(matter.regionAt([10, 1, -1]), INSULA);
  assert.equal(matter.regionAt([9, 0, 0]), null);
  assert.equal(matter.regionAt([40, 0, 0]), null);
  matter.dispose();
});

test('the shader addresses the cropped grid exactly as the pick does', () => {
  const matter = whiteMatter();
  const toVoxel = matter.uniforms.whiteMatterToVoxel.value;
  for (const [point, voxel] of [
    [[8, 0, 0], [2, 0, 0]],
    [[10, 1, -1], [0, 1, 1]],
    [[8.4, 0.3, -0.2], [1.6, 0.2, 0.3]],
  ]) {
    const gpu = rasToWorld(point).applyMatrix4(toVoxel).toArray();
    gpu.forEach((value, axis) => assert.ok(Math.abs(value - voxel[axis]) < 1e-9, `${point}`));
  }
  matter.dispose();
});

test('white matter samples only the cuts of the atlases it was published for', () => {
  const matter = whiteMatter();
  matter.update({ atlas: 'hcp-mmp', isolatedRegion: null });
  assert.equal(matter.uniforms.whiteMatterActive.value, true);
  matter.update({ atlas: 'nextbrain', isolatedRegion: null });
  assert.equal(matter.uniforms.whiteMatterActive.value, false);
  matter.dispose();
});

test('isolating a white-matter parcel keeps only its code on the cap', () => {
  const matter = whiteMatter();
  matter.update({ atlas: 'destrieux', isolatedRegion: INSULA });
  assert.equal(matter.uniforms.whiteMatterIsolated.value, 2);
  matter.update({ atlas: 'destrieux', isolatedRegion: 'destrieux:left:1' });
  assert.equal(matter.uniforms.whiteMatterIsolated.value, -1);
  matter.dispose();
});

test('the pointed-at and chosen white-matter parcels are lifted by code', () => {
  const matter = whiteMatter();
  matter.setHighlight({ hovered: PRECENTRAL, selected: INSULA });
  assert.deepEqual(matter.uniforms.whiteMatterCodes.value.toArray(), [1, 2]);
  assert.deepEqual(matter.uniforms.whiteMatterLifts.value.toArray(),
    [HIGHLIGHT_LIFT.hovered, HIGHLIGHT_LIFT.selected]);
  matter.setHighlight({});
  assert.deepEqual(matter.uniforms.whiteMatterCodes.value.toArray(), [-1, -1]);
  matter.dispose();
});
