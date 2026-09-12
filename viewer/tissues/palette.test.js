import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, SRGBColorSpace } from 'three';
import { createPalette, labelVisible } from './palette.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { tissueColor } from '../render/materials.js';

const { appearance } = parse(readFileSync(new URL('../../config/model.yaml', import.meta.url), 'utf8'));

test('neutral cut and surface colours agree for gray matter, white matter and CSF', () => {
  const tissues = [
    { kind: 'cortex', source_name: 'G_front_sup', name: 'G_front_sup' },
    { kind: 'tissue', source_name: 'Left-Cerebral-White-Matter', name: 'Left-Cerebral-White-Matter' },
    { kind: 'tissue', source_name: 'Left-Lateral-Ventricle', name: 'Left-Lateral-Ventricle' },
  ].map(label => ({ ...label, region_id: 'region', source_label_id: 1,
    hemisphere: 'left', color: [1, 2, 3] }));
  const palette = createPalette(tissues, { ...state, surfaceColor: 'tissue' }, appearance.tissue);
  for (const [index, label] of tissues.entries()) {
    const expected = new Color(tissueColor(label, appearance.tissue));
    const actual = palette.slice(index * 4, index * 4 + 3);
    actual.forEach((value, channel) =>
      assert.ok(Math.abs(value - expected.toArray()[channel]) < 1e-7));
  }
  assert.notDeepEqual(palette.slice(0, 3), palette.slice(4, 7));
  assert.notDeepEqual(palette.slice(4, 7), palette.slice(8, 11));
});

const labels = [
  { source_label_id: 0, region_id: null, kind: 'tissue', hemisphere: 'midline', color: [0, 0, 0] },
  {
    source_label_id: 11101,
    region_id: 'destrieux:left:1',
    kind: 'cortex',
    hemisphere: 'left',
    color: [23, 220, 60],
  },
  {
    source_label_id: 2,
    region_id: null,
    kind: 'tissue',
    hemisphere: 'left',
    color: [245, 245, 245],
  },
];
const state = {
  atlas: 'destrieux',
  surfaceColor: 'atlas',
  cortexVisible: true,
  cortexOpacity: 1,
  hemisphere: 'both',
  isolatedRegion: null,
};

test('cut palette preserves atlas label colors in linear rendering space', () => {
  const palette = createPalette(labels, state);
  const expected = new Color().setRGB(23 / 255, 220 / 255, 60 / 255);
  assert.ok(Math.abs(palette[4] - expected.r) < 1e-7);
  assert.ok(Math.abs(palette[5] - expected.g) < 1e-7);
  assert.equal(palette[7], 1);
  assert.equal(palette[3], 0);
});

test('a cut carries the same network colour the surface carries', () => {
  const networks = { colors: { Default: [205, 62, 78], Vis: [120, 18, 134] } };
  const regions = new Map([['destrieux:left:1', {
    networks: [{ network: 'Default', fraction: 0.6 }, { network: 'Vis', fraction: 0.3 }],
  }]]);
  const palette = createPalette(labels, { ...state, surfaceColor: 'network' },
    appearance.tissue, { regions, networks });

  // The dominant share wins the parcel, in the surface's own conversion.
  const expected = new Color().setRGB(205 / 255, 62 / 255, 78 / 255, SRGBColorSpace);
  for (const [channel, value] of expected.toArray().entries()) {
    assert.ok(Math.abs(palette[4 + channel] - value) < 1e-7);
  }

  // White matter is in no network and keeps the tissue colour it always had.
  const white = new Color(tissueColor({ ...labels[2], source_name: labels[2].name },
    appearance.tissue));
  for (const [channel, value] of white.toArray().entries()) {
    assert.ok(Math.abs(palette[8 + channel] - value) < 1e-7);
  }
});

test('a region in no network is not given one on a cut', () => {
  const regions = new Map([['destrieux:left:1', { networks: [] }]]);
  const palette = createPalette(labels, { ...state, surfaceColor: 'network' },
    appearance.tissue, { regions, networks: { colors: { Default: [205, 62, 78] } } });
  const expected = new Color(tissueColor({ ...labels[1], source_name: labels[1].name },
    appearance.tissue));
  for (const [channel, value] of expected.toArray().entries()) {
    assert.ok(Math.abs(palette[4 + channel] - value) < 1e-7);
  }
});

test('hemisphere and isolation hide samples rather than relabeling them', () => {
  assert.equal(labelVisible(labels[1], { ...state, hemisphere: 'right' }), false);
  assert.equal(labelVisible(labels[1], { ...state, isolatedRegion: 'destrieux:left:1' }), true);
  assert.equal(labelVisible(labels[2], { ...state, isolatedRegion: 'destrieux:left:1' }), false);
});

test('periventricular and paraventricular nuclei remain gray matter, not CSF', () => {
  for (const name of ['Left-paraventricular_nucleus_of_hypothalamus',
    'Right-periventricular_nucleus__supraoptic_portion',
    'Left-juxtaparaventricular_lateral_hypothalamic_area']) {
    assert.equal(tissueColor({ kind: 'structure', source_name: name }, appearance.tissue),
      appearance.tissue.gray, name);
  }
  for (const name of ['Left-Lateral-Ventricle', 'Right-Inf-Lat-Vent', '3rd-Ventricle', 'CSF']) {
    assert.equal(tissueColor({ kind: 'structure', source_name: name }, appearance.tissue),
      appearance.tissue.fluid, name);
  }
});
