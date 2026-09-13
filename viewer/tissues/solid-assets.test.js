import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Color, MeshBasicMaterial } from 'three';
import { indexLabels, paintSolids } from './solid-assets.js';

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
