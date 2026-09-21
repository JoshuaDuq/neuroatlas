import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BoxGeometry, Color, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { Volume } from '../slices/volume.js';
import { BANDS, addSolidSources, enclosingFirst, indexLabels, paintSolids } from './solid-assets.js';
import { SolidSections } from './solid-sections.js';
import { createWhiteMatter } from './white-matter.js';

const { appearance } = parse(
  readFileSync(new URL('../../config/model.yaml', import.meta.url), 'utf8'),
);

const PARCEL = 'destrieux:left:1';
const LABELS = indexLabels([
  { source_label_id: 2, name: 'Left-Cerebral-White-Matter', color: [245, 245, 245], hemisphere: 'left', kind: 'tissue', region_id: null },
  { source_label_id: 11101, name: 'ctx_lh_G_and_S_frontomargin', color: [23, 220, 60], hemisphere: 'left', kind: 'cortex', region_id: PARCEL },
  { source_label_id: 11, name: 'Left-Caudate', color: [122, 186, 220], hemisphere: 'left', kind: 'tissue', region_id: 'aseg:left:11' },
]);

const LOOKUP = {
  regions: new Map([[PARCEL, { networks: [{ network: 'Default', fraction: 0.7 }] }]]),
  networks: { colors: { Default: [205, 62, 78] } },
};

const STATE = {
  hemisphere: 'both', cortexVisible: true, cortexOpacity: 1,
  surfaceColor: 'tissue', isolatedRegion: null,
};

function solid(userData) {
  const material = new MeshBasicMaterial();
  material.userData.tissueVariation = { value: 0 };
  material.userData.sampledLabels = { value: false };
  return { source: { userData }, cap: { material }, visible: true };
}

function paint(solids, { detail = 'aseg', ...state } = {}, wedged = true) {
  paintSolids({ solids }, {
    labels: LABELS, state: { ...STATE, ...state }, atlas: 'destrieux', detail, wedged,
    appearance, lookup: LOOKUP,
  });
  return solids;
}

const wedge = () => solid({ hemisphere: 'left', atlas: 'destrieux', kind: 'ribbon', region_id: PARCEL });
const linear = (r, g, b) => new Color().setRGB(r / 255, g / 255, b / 255);

test('a parcel solid takes the published atlas colour, unconverted', () => {
  const [painted] = paint([wedge()], { surfaceColor: 'atlas' });
  assert.ok(painted.visible);
  assert.ok(painted.cap.material.color.equals(linear(23, 220, 60)));
});

test('a parcel solid takes its dominant network colour', () => {
  const [painted] = paint([wedge()], { surfaceColor: 'network' });
  assert.ok(painted.cap.material.color.equals(new Color().setRGB(205 / 255, 62 / 255, 78 / 255, 'srgb')));
});

test('tissue colour ignores the parcellation entirely', () => {
  const [painted] = paint([wedge()], { surfaceColor: 'tissue' });
  assert.equal(painted.cap.material.color.getHexString(), appearance.tissue.cortex.slice(1));
});

test('a published palette drops the T1 modulation the tissue cut carries', () => {
  for (const [surfaceColor, expected] of [
    ['tissue', appearance.intensity.cut_strength], ['atlas', 0], ['network', 0],
  ]) {
    const [painted] = paint([wedge()], { surfaceColor });
    assert.equal(painted.cap.material.userData.tissueVariation.value, expected);
  }
});

test('a parcel the segmentation never labelled still gets the unlabelled colour', () => {
  const medial = solid({
    hemisphere: 'left', atlas: 'destrieux', kind: 'ribbon', region_id: 'destrieux:left:-1',
  });
  const [painted] = paint([medial], { surfaceColor: 'atlas' });
  assert.ok(painted.visible);
  assert.equal(painted.cap.material.color.getHexString(), appearance.tissue.unlabelled.slice(1));
});

test('hemisphere and cortex controls hide the solids they describe', () => {
  assert.equal(paint([wedge()], { hemisphere: 'right' })[0].visible, false);
  assert.equal(paint([wedge()], { cortexVisible: false })[0].visible, false);
  assert.equal(paint([wedge()], { cortexOpacity: 0 })[0].visible, false);
  assert.equal(paint([wedge()], { hemisphere: 'left' })[0].visible, true);
});

test('isolation leaves only the isolated parcel standing', () => {
  const caudate = solid({ hemisphere: 'left', region_id: 'aseg:left:11' });
  const [parcel, nucleus] = paint([wedge(), caudate], { isolatedRegion: PARCEL });
  assert.equal(parcel.visible, true);
  assert.equal(nucleus.visible, false);
});

test('the white envelope is painted by the white matter label, not a guess', () => {
  const white = solid({ hemisphere: 'left', boundary: 'white' });
  const [painted] = paint([white], { surfaceColor: 'atlas' });
  assert.ok(painted.cap.material.color.equals(linear(245, 245, 245)));
});

test('the pial envelope stands in only where an atlas has no parcel solids', () => {
  const pial = () => solid({ hemisphere: 'left', boundary: 'pial' });
  assert.equal(paint([pial()], {}, true)[0].visible, false);
  const [standIn] = paint([pial()], {}, false);
  assert.equal(standIn.visible, true);
  assert.equal(standIn.cap.material.color.getHexString(), appearance.tissue.cortex.slice(1));
});

test('another atlas’s parcel solids stay out of this cut', () => {
  const other = solid({ hemisphere: 'left', atlas: 'hcp-mmp', kind: 'ribbon', region_id: 'hcp-mmp:left:1' });
  assert.equal(paint([other], { surfaceColor: 'atlas' })[0].visible, false);
});

test('the cut caps the detail level the viewer is showing, and only that one', () => {
  const nucleus = level => solid({ hemisphere: 'left', region_id: 'aseg:left:11', detail: level });
  const [shown] = paint([nucleus('aseg')], { detail: 'aseg' });
  assert.equal(shown.visible, true);
  const [hidden] = paint([nucleus('aseg')], { detail: 'nextbrain' });
  assert.equal(hidden.visible, false);
});

test('a nucleus the cut atlas never labelled keeps its own published colour', () => {
  const nucleus = () => {
    const entry = solid({ hemisphere: 'left', region_id: 'nextbrain:left:7', detail: 'nextbrain' });
    entry.source.material = { color: linear(60, 180, 90) };
    return entry;
  };
  const [atlas] = paint([nucleus()], { detail: 'nextbrain', surfaceColor: 'atlas' });
  assert.ok(atlas.cap.material.color.equals(linear(60, 180, 90)));
  const [tissue] = paint([nucleus()], { detail: 'nextbrain', surfaceColor: 'tissue' });
  assert.equal(tissue.cap.material.color.getHexString(), appearance.tissue.gray.slice(1));
});

test('a painted solid answers for the region its colour came from', () => {
  const white = solid({ hemisphere: 'left', boundary: 'white' });
  const [parcel, envelope] = paint([wedge(), white]);
  assert.equal(parcel.region, PARCEL);
  // The white matter label carries no region, so neither does its envelope:
  // nothing can point at it, so nothing may light it.
  assert.equal(envelope.region, null);
});

test('a wedge the cut atlas never labelled answers for no region', () => {
  const medial = solid({
    hemisphere: 'left', atlas: 'destrieux', kind: 'ribbon', region_id: 'destrieux:left:99',
  });
  assert.equal(paint([medial])[0].region, null);
});

test('a nucleus the cut atlas never labelled still answers for itself', () => {
  const nucleus = solid({ hemisphere: 'left', detail: 'aseg', region_id: 'aseg:left:17' });
  assert.equal(paint([nucleus])[0].region, 'aseg:left:17');
});

const WHITE_MATTER_PARCEL = 'wmparc:left:3024';

function whiteMatter() {
  const record = {
    shape: [1, 1, 1], order: 'F', applies_to: ['destrieux'],
    voxel_to_surface_ras_mm: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
    labels: [
      { source_label_id: 0, region_id: null },
      { source_label_id: 3024, region_id: WHITE_MATTER_PARCEL },
    ],
  };
  return createWhiteMatter(record, new Volume(record, new Uint8Array([1])));
}

test('isolating a white-matter parcel keeps its own hemisphere’s white envelope standing', () => {
  const lookup = { ...LOOKUP, regions: new Map([[WHITE_MATTER_PARCEL, { hemisphere: 'left' }]]) };
  const left = solid({ hemisphere: 'left', boundary: 'white' });
  const right = solid({ hemisphere: 'right', boundary: 'white' });
  paintSolids({ solids: [left, right] }, {
    labels: LABELS, state: { ...STATE, isolatedRegion: WHITE_MATTER_PARCEL },
    atlas: 'destrieux', detail: 'aseg', wedged: true, appearance, lookup,
    whiteMatter: whiteMatter(),
  });
  assert.equal(left.visible, true);
  assert.equal(right.visible, false);
});

test('only the white envelope cap samples gyral white matter', () => {
  const solids = new SolidSections();
  const envelope = boundary => {
    const mesh = new Mesh(new BoxGeometry(0.1, 0.1, 0.1));
    mesh.userData = { hemisphere: 'left', boundary };
    return mesh;
  };
  const anatomy = { texture: null, worldToVoxel: new Matrix4(), volume: { shape: [1, 1, 1] } };
  addSolidSources(solids, [envelope('pial'), envelope('white')], anatomy, appearance,
    BANDS.envelope, whiteMatter());
  const [pial, white] = solids.solids.map(({ cap }) => {
    const shader = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <color_fragment>',
    };
    cap.material.onBeforeCompile(shader);
    return shader.uniforms;
  });
  assert.equal(pial.whiteMatterVolume, undefined);
  assert.equal(white.whiteMatterVolume.value.isData3DTexture, true);
  solids.dispose();
});

test('learning caps obey system filtering and remain visible during isolation', () => {
  const id = 'learning:left:caudate';
  const record = { id, atlas: 'learning', kind: 'structure', hemisphere: 'left',
    source_name: 'Caudate', display_names: { en: 'Caudate' },
    system_names: { en: 'Basal ganglia' } };
  const cap = solid({ ...record, region_id: id, detail: 'learning' });
  const options = { labels: LABELS, atlas: 'destrieux', detail: 'learning', wedged: true,
    appearance, lookup: { regions: new Map([[id, record]]) } };
  paintSolids({ solids: [cap] }, { ...options,
    state: { ...STATE, detail: 'learning', internalSystem: 'Brainstem' } });
  assert.equal(cap.visible, false);
  paintSolids({ solids: [cap] }, { ...options,
    state: { ...STATE, detail: 'learning', internalSystem: 'Basal ganglia', isolatedRegion: id } });
  assert.equal(cap.visible, true);
  assert.equal(cap.region, id);
});

test('a reference cord cap is painted as the tissue its region declares, not by its name', () => {
  const cap = (id, source_name, tissue) => solid({ hemisphere: 'left', supplemental: true,
    mri_registered: false, region_id: `zanatomy:left:${id}`, source_name, tissue });
  const [tract, nucleus, canal] = paint([
    cap('lateral-corticospinal-tract', 'Lateral corticospinal tract', 'white'),
    cap('nucleus-proprius', 'Nucleus proprius', 'gray'),
    cap('central-canal', 'Central canal', 'fluid'),
  ]);
  assert.equal(tract.cap.material.color.getHexString(), appearance.tissue.white.slice(1));
  assert.equal(nucleus.cap.material.color.getHexString(), appearance.tissue.gray.slice(1));
  assert.equal(canal.cap.material.color.getHexString(), appearance.tissue.fluid.slice(1));
});

test('nested reference solids reach the cut after the solids that enclose them', () => {
  const source = (id, volume) => ({ userData: { region_id: id, segmentation_volume_mm3: volume } });
  const sources = [source('nucleus proprius', 73), source('cord', 45710), source('posterior horn', 1180)];
  assert.deepEqual(enclosingFirst(sources).map(entry => entry.userData.region_id),
    ['cord', 'posterior horn', 'nucleus proprius']);
});
