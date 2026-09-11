import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
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
  const palette = createPalette(tissues, { ...state, atlasColors: false }, appearance.tissue);
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
  atlasColors: true,
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

test('hemisphere and isolation hide samples rather than relabeling them', () => {
  assert.equal(labelVisible(labels[1], { ...state, hemisphere: 'right' }), false);
  assert.equal(labelVisible(labels[1], { ...state, isolatedRegion: 'destrieux:left:1' }), true);
  assert.equal(labelVisible(labels[2], { ...state, isolatedRegion: 'destrieux:left:1' }), false);
});
