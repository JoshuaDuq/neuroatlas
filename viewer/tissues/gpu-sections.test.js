import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { centeredFrame, rasToWorld } from '../slices/coordinates.js';
import { Volume } from '../slices/volume.js';
import { HIGHLIGHT_LIFT } from './highlight.js';
import { BANDS, addSolidSources } from './solid-assets.js';
import { TissueSections } from './gpu-sections.js';
import { createWhiteMatter } from './white-matter.js';

const { appearance } = parse(readFileSync(new URL('../../config/model.yaml', import.meta.url), 'utf8'));

test('MRI uses smooth solids for every atlas and keeps cap picking and highlights', () => {
  const { sections, model, layer, region } = fixture();
  const source = new Mesh(new BoxGeometry(.01, .01, .01),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.userData = { hemisphere: 'left', region_id: region.id };
  addSolidSources(sections.solids, [source], sections.anatomy, appearance, BANDS.structure);
  const texture = sections.anatomy.texture;
  const positions = source.geometry.attributes.position.array.slice();
  model.state.surfaceColor = 'mri';
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  assert.equal(sections.solids.group.visible, true);
  assert.equal(layer.mesh.visible, false);
  const ray = new Raycaster(new Vector3(0, 0, -.1), new Vector3(0, 0, 1));
  assert.equal(sections.intersect(ray)?.region.id, region.id);
  sections.setHighlight({ hovered: region.id });
  assert.equal(sections.solids.solids[0].cap.material.userData.highlightLift.value,
    HIGHLIGHT_LIFT.hovered);
  sections.setHighlight({});
  assert.equal(sections.solids.solids[0].cap.material.userData.highlightLift.value, 0);
  assert.equal(sections.anatomy.texture, texture);
  assert.deepEqual(source.geometry.attributes.position.array, positions);
  sections.dispose();
});

test('MRI cut-only labels highlight and isolate inside smooth envelopes', () => {
  const { sections, model, layer, region } = fixture();
  const source = new Mesh(new BoxGeometry(.01, .01, .01),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.userData = { hemisphere: 'left', boundary: 'pial' };
  addSolidSources(sections.solids, [source], sections.anatomy, appearance, BANDS.envelope);
  model.state.surfaceColor = 'mri';
  model.state.isolatedRegion = region.id;
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  assert.equal(sections.solids.solids[0].group.visible, true);
  assert.equal(layer.mesh.visible, false);
  sections.setHighlight({ hovered: region.id });
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <color_fragment>\n#include <opaque_fragment>' };
  sections.solids.solids[0].cap.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.capLabelsEnabled.value, true);
  assert.equal(shader.uniforms.capLabelVolume.value, layer.texture);
  assert.equal(shader.uniforms.capHighlightCodes.value, layer.uniforms.highlightCodes.value);
  const ray = new Raycaster(new Vector3(.0002, .0002, -.1), new Vector3(0, 0, 1));
  assert.equal(sections.intersect(ray)?.region.id, region.id);
  model.state.isolatedRegion = 'another-region';
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  assert.equal(sections.intersect(ray), null);
  sections.dispose();
});

test('a cut-only MRI atlas retains the displayed structure identity and isolation', () => {
  const { sections, model, region } = fixture();
  const nucleus = { id: 'learning:left:nucleus', kind: 'structure', atlas: 'learning',
    hemisphere: 'left', source_name: 'Nucleus' };
  model.regions.set(nucleus.id, nucleus);
  model.state.detail = 'learning';
  const source = new Mesh(new BoxGeometry(.01, .01, .01),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.userData = { ...nucleus, region_id: nucleus.id, detail: 'learning' };
  addSolidSources(sections.solids, [source], sections.anatomy, appearance, BANDS.structure);
  model.state.surfaceColor = 'mri';
  model.state.isolatedRegion = nucleus.id;
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  const cap = sections.solids.solids[0];
  assert.equal(cap.group.visible, true);
  const ray = new Raycaster(new Vector3(.0002, .0002, -.1), new Vector3(0, 0, 1));
  assert.equal(sections.intersect(ray)?.region.id, nucleus.id);
  assert.equal(cap.cap.material.userData.sampledLabels.value, false);
  model.state.isolatedRegion = region.id;
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  assert.equal(cap.cap.material.userData.sampledLabels.value, true);
  assert.equal(sections.intersect(ray)?.region.id, region.id);
  sections.dispose();
});

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

test('a surfaceless atlas keeps the label volume for published colours', () => {
  const { sections, model, layer } = fixture();
  const labels = layer.volume.data.slice();
  for (const color of ['tissue', 'atlas', 'network']) {
    model.state.surfaceColor = color;
    sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
    // Without parcel solids only tissue colour can be capped from geometry.
    assert.equal(sections.solids.group.visible, color === 'tissue');
    assert.equal(layer.mesh.visible, color !== 'tissue');
    assert.deepEqual(layer.volume.data, labels);
  }
  sections.dispose();
});

test('a surfaceless cut atlas still caps and picks supplemental anatomy outside its volume', () => {
  const { sections, model, layer } = fixture();
  const cord = { id: 'zanatomy:midline:cord', atlas: 'zanatomy', kind: 'structure',
    supplemental: true, hemisphere: 'midline', source_name: 'White matter of spinal cord' };
  model.regions.set(cord.id, cord);
  const source = new Mesh(new BoxGeometry(.012, .48, .01),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.position.set(0, -.3, .04);
  source.userData = { ...cord, region_id: cord.id, mri_registered: false };
  addSolidSources(sections.solids, [source], sections.anatomy, appearance, BANDS.structure);
  for (const surfaceColor of ['tissue', 'atlas', 'network']) {
    model.state.surfaceColor = surfaceColor;
    model.state.isolatedRegion = cord.id;
    sections.update(centeredFrame('coronal', [0, -40, -500]), 'destrieux');
    assert.equal(sections.solids.group.visible, true);
    assert.equal(sections.solids.solids[0].group.visible, true);
    const ray = new Raycaster(new Vector3(0, -.5, .2), new Vector3(0, 0, -1));
    assert.equal(sections.intersect(ray)?.region.id, cord.id);
    assert.equal(layer.mesh.visible, surfaceColor !== 'tissue');
  }
  model.state.surfaceColor = 'atlas';
  model.state.isolatedRegion = null;
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  const brainRay = new Raycaster(new Vector3(0, 0, .1), new Vector3(0, 0, -1));
  assert.equal(sections.intersect(brainRay)?.region.id, 'destrieux:left:1');
  sections.dispose();
});

test('an atlas with parcel solids caps every colour mode, isolation included', () => {
  const { sections, model, layer, region } = fixture();
  layer.wedged = true;
  for (const color of ['tissue', 'atlas', 'network']) {
    model.state.surfaceColor = color;
    sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
    assert.equal(sections.solids.group.visible, true);
    assert.equal(layer.mesh.visible, false);
  }
  model.state.isolatedRegion = region.id;
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  assert.equal(sections.solids.group.visible, true);
  assert.equal(layer.mesh.visible, false);
  sections.dispose();
});

test('a sampled cut face lifts the code its pointed-at region is painted from', () => {
  const { sections, layer, region } = fixture();
  sections.setHighlight({ hovered: region.id });
  assert.deepEqual(layer.uniforms.highlightCodes.value.toArray(), [1, -1]);
  assert.deepEqual(layer.uniforms.highlightLifts.value.toArray(), [HIGHLIGHT_LIFT.hovered, 0]);
  sections.dispose();
});

test('a sampled cut face goes back when the pointer leaves it', () => {
  const { sections, layer, region } = fixture();
  sections.setHighlight({ hovered: region.id });
  sections.setHighlight({});
  assert.deepEqual(layer.uniforms.highlightCodes.value.toArray(), [-1, -1]);
  assert.equal(layer.uniforms.highlightLifts.value.x, 0);
  sections.dispose();
});

test('a repaint leaves the highlight where the pointer left it', () => {
  const { sections, layer, region } = fixture();
  sections.setHighlight({ selected: region.id });
  sections.update(centeredFrame('coronal', [0, 0, 4]), 'destrieux');
  assert.deepEqual(layer.uniforms.highlightCodes.value.toArray(), [-1, 1]);
  assert.equal(layer.uniforms.highlightLifts.value.y, HIGHLIGHT_LIFT.selected);
  sections.dispose();
});

test('a cap answers for the anatomy it was drawn from, not the voxel under it', () => {
  const { sections, model, layer } = fixture();
  layer.wedged = true;
  const drawn = { id: 'nextbrain:right:10119' };
  model.regions.set(drawn.id, drawn);
  model.state.detail = 'nextbrain';
  const source = new Mesh(new BoxGeometry(0.1, 0.1, 0.1),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.userData = { hemisphere: 'right', detail: 'nextbrain', region_id: drawn.id };
  addSolidSources(sections.solids, [source], sections.anatomy, appearance, BANDS.structure);
  sections.update(centeredFrame('coronal', [0, 0, 0]), 'destrieux');
  const ray = new Raycaster(new Vector3(0.0002, 0.0002, -0.1), new Vector3(0, 0, 1));
  // The voxel grid under that point carries a Destrieux parcel; the solid the
  // viewer actually drew there is a NextBrain nucleus, and it is what was hit.
  assert.equal(sections.intersect(ray).region, drawn);
  sections.dispose();
});

function whiteMatterFixture() {
  const { sections, model, layer } = fixture();
  const parcels = { precentral: 'wmparc:left:3024', insula: 'wmparc:left:3035' };
  for (const id of Object.values(parcels)) model.regions.set(id, { id, hemisphere: 'left' });
  const record = {
    ...layer.metadata,
    applies_to: ['destrieux'],
    labels: [
      { source_label_id: 0, region_id: null },
      { source_label_id: 3024, region_id: parcels.precentral },
      { source_label_id: 3035, region_id: parcels.insula },
    ],
  };
  // The ray every test casts meets voxel (1, 1, 1), the last one: insula.
  const codes = new Uint8Array(8);
  codes[7] = 2;
  sections.whiteMatter = createWhiteMatter(record, new Volume(record, codes));
  const white = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshBasicMaterial({ side: DoubleSide }));
  white.userData = { hemisphere: 'left', boundary: 'white' };
  addSolidSources(sections.solids, [white], sections.anatomy, appearance, BANDS.envelope,
    sections.whiteMatter);
  model.state.surfaceColor = 'tissue';
  const ray = new Raycaster(new Vector3(0.0002, 0.0002, -0.1), new Vector3(0, 0, 1));
  return { sections, model, layer, parcels, ray, frame: centeredFrame('coronal', [0, 0, 0]) };
}

test('a cut through gyral white matter answers with the parcel under the pointer', () => {
  const { sections, parcels, ray, frame } = whiteMatterFixture();
  sections.update(frame, 'destrieux');
  assert.equal(sections.intersect(ray).region.id, parcels.insula);
  sections.dispose();
});

test('white matter stays plain on the cut of an atlas it does not serve', () => {
  const { sections, layer, ray, frame } = whiteMatterFixture();
  sections.layers.set('nextbrain', layer);
  sections.update(frame, 'nextbrain');
  assert.equal(sections.intersect(ray).region.id, 'destrieux:left:1');
  sections.dispose();
});

test('an isolated white-matter parcel is the only white matter left to pick', () => {
  const { sections, model, parcels, ray, frame } = whiteMatterFixture();
  model.state.isolatedRegion = parcels.precentral;
  sections.update(frame, 'destrieux');
  assert.equal(sections.intersect(ray), null);
  model.state.isolatedRegion = parcels.insula;
  sections.update(frame, 'destrieux');
  assert.equal(sections.intersect(ray).region.id, parcels.insula);
  sections.dispose();
});

test('pointing at white matter lifts its parcel code on the cap', () => {
  const { sections, parcels } = whiteMatterFixture();
  sections.setHighlight({ selected: parcels.insula });
  assert.deepEqual(sections.whiteMatter.uniforms.whiteMatterCodes.value.toArray(), [-1, 2]);
  sections.dispose();
});
