import assert from 'node:assert/strict';
import test from 'node:test';
import { Raycaster, Vector3 } from 'three';
import { centeredFrame, rasToWorld } from '../slices/coordinates.js';
import { Volume } from '../slices/volume.js';
import { TissueSections } from './gpu-sections.js';

function fixture() {
  const region = { id: 'destrieux:left:1' };
  const labels = [
    {
      source_label_id: 0,
      region_id: null,
      kind: 'tissue',
      hemisphere: 'midline',
      color: [0, 0, 0],
    },
    {
      source_label_id: 11101,
      region_id: region.id,
      kind: 'cortex',
      hemisphere: 'left',
      color: [23, 220, 60],
    },
  ];
  const metadata = {
    shape: [2, 2, 2],
    order: 'F',
    labels,
    voxel_to_surface_ras_mm: [
      [-1, 0, 0, 1],
      [0, 0, 1, -1],
      [0, -1, 0, 1],
      [0, 0, 0, 1],
    ],
  };
  const volume = new Volume(metadata, new Uint16Array(8).fill(1));
  const model = {
    state: {
      atlas: 'destrieux',
      hemisphere: 'both',
      cortexVisible: true,
      cortexOpacity: 1,
      atlasColors: true,
      isolatedRegion: null,
    },
    regions: new Map([[region.id, region]]),
  };
  const sections = new TissueSections(model, new URL('https://example.invalid/'));
  const layer = sections.createLayer(metadata, volume);
  sections.layers.set('destrieux', layer);
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  return { sections, model, layer, region };
}

test('moving every cut orientation reuses geometry, volume and palette without uploads', () => {
  const { sections, layer } = fixture();
  const geometry = layer.mesh.geometry;
  const palette = layer.palette.image.data;
  const volume = layer.texture.image.data;
  const versions = [layer.palette.version, layer.texture.version];
  for (const mode of ['coronal', 'sagittal', 'axial', 'oblique']) {
    for (let offset = -50; offset <= 50; offset += 0.5) {
      sections.update(centeredFrame(mode, [offset, offset, offset], { tilt: 30, azimuth: 45 }), 'destrieux');
    }
  }
  assert.equal(layer.mesh.geometry, geometry);
  assert.equal(layer.palette.image.data, palette);
  assert.equal(layer.texture.image.data, volume);
  assert.deepEqual([layer.palette.version, layer.texture.version], versions);
  assert.equal(geometry.index.count, 6);
  sections.dispose();
});

test('GPU world-to-voxel transform agrees with CPU sampling in every voxel', () => {
  const { sections, layer } = fixture();
  const matrix = layer.mesh.material.uniforms.worldToVoxel.value;
  for (let r = -0.25; r < 1.5; r += 0.25) {
    for (let a = -1.25; a < 0.5; a += 0.25) {
      for (let s = -0.25; s < 1.5; s += 0.25) {
        const gpu = rasToWorld([r, a, s]).applyMatrix4(matrix).toArray();
        const cpu = layer.volume.voxel([r, a, s]);
        gpu.forEach((value, axis) => assert.ok(Math.abs(value - cpu[axis]) < 1e-12));
      }
    }
  }
  sections.dispose();
});

test('cut picking returns the visible voxel label and respects hemisphere and isolation', () => {
  const { sections, model, region } = fixture();
  const ray = new Raycaster(new Vector3(0.0002, 0.0002, -0.1), new Vector3(0, 0, 1));
  assert.equal(sections.intersect(ray).region, region);
  model.state.hemisphere = 'right';
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  assert.equal(sections.intersect(ray), null);
  model.state.hemisphere = 'both';
  model.state.isolatedRegion = 'another-region';
  assert.equal(sections.intersect(ray), null);
  sections.dispose();
});
