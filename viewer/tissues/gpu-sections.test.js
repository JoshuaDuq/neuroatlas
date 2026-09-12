import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Raycaster, Vector3 } from 'three';
import { centeredFrame, rasToWorld } from '../slices/coordinates.js';
import { Volume } from '../slices/volume.js';
import { TissueSections } from './gpu-sections.js';

const { appearance } = parse(readFileSync(new URL('../../config/model.yaml', import.meta.url), 'utf8'));

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
    manifest: { appearance },
    state: {
      atlas: 'destrieux',
      hemisphere: 'both',
      cortexVisible: true,
      cortexOpacity: 1,
      surfaceColor: 'atlas',
      isolatedRegion: null,
    },
    regions: new Map([[region.id, region]]),
  };
  const sections = new TissueSections(model, new URL('https://example.invalid/'));
  sections.anatomy = sections.createAnatomy(new Volume(metadata, new Uint8Array(8).fill(100)));
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
  const matrix = layer.uniforms.worldToVoxel.value;
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

test('MRI texture uses its own affine and interpolation without changing labels', () => {
  const { sections, model, layer } = fixture();
  const mri = new Volume({ shape: [2, 2, 2], order: 'F',
    voxel_to_surface_ras_mm: [[2, 0, 0, -1], [0, 3, 0, 2],
      [0, 0, 4, -3], [0, 0, 0, 1]],
  }, new Uint8Array([0, 20, 40, 60, 80, 100, 120, 140]));
  const before = layer.volume.data.slice();
  const anatomy = sections.createAnatomy(mri);
  sections.anatomy.texture.dispose();
  sections.anatomy = anatomy;
  const next = sections.createLayer(layer.metadata, layer.volume);
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <color_fragment>' };
  next.mesh.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.mriVolume.value, anatomy.texture);
  const actual = rasToWorld([1, 5, 1]).applyMatrix4(shader.uniforms.worldToMri.value);
  actual.toArray().forEach(value => assert.ok(Math.abs(value - 1) < 1e-12));
  assert.equal(next.mesh.material.isMeshPhysicalMaterial, true);
  assert.deepEqual(layer.volume.data, before);
  sections.layers.set('second', next);
  model.state.surfaceColor = 'atlas';
  sections.update(centeredFrame('oblique', [0, 0, 0], { tilt: 30, azimuth: 45 }), 'second');
  assert.equal(shader.uniforms.tissueVariation.value, 0);
  model.state.surfaceColor = 'tissue';
  sections.update(centeredFrame('axial', [0, 0, 0]), 'second');
  assert.ok(shader.uniforms.tissueVariation.value > 0);
  let disposed = 0;
  anatomy.texture.addEventListener('dispose', () => disposed++);
  sections.dispose();
  assert.equal(disposed, 1);
});
