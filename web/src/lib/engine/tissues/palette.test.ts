import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { Color, SRGBColorSpace } from 'three';
import { parse } from 'yaml';
import type { Region } from '../../types/index.ts';
import type { FunctionalRegions } from '../../core/catalog/functional-regions.ts';
import type { CabNpPartition } from '../../core/catalog/networks.ts';
import {
  anatomies,
  asDisplaySettings,
  asRegion,
  readModel,
} from '../../core/catalog/test-support.ts';
import { tissueColor } from '../render/materials.ts';
import type { TissueAppearance } from '../render/materials.ts';
import { createPalette, labelVisible } from './palette.ts';
import type { Label, PaletteLookup } from './palette.ts';

const published = anatomies.default;

const { appearance } = parse(
  readFileSync(new URL('../../../../../config/model.yaml', import.meta.url), 'utf8'),
) as { appearance: { tissue: TissueAppearance } };

/** Test fixtures carry only the fields the code under test reads. */
const asLabel = (fields: object) => fields as Label;
const asLookup = (fields: object) => fields as PaletteLookup;

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
].map(asLabel);
const state = asDisplaySettings({
  atlas: 'destrieux',
  surfaceColor: 'atlas',
  cortexVisible: true,
  cortexOpacity: 1,
  hemisphere: 'both',
  isolatedRegion: null,
});

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7);
const channelsOf = (palette: Float32Array, code: number) =>
  Array.from(palette.slice(code * 4, code * 4 + 3));
const assertColor = (palette: Float32Array, code: number, expected: Color) =>
  expected.toArray().forEach((value, channel) => near(channelsOf(palette, code)[channel]!, value));

test('neutral cut and surface colours agree for gray matter, white matter and CSF', () => {
  const tissues = [
    { kind: 'cortex', source_name: 'G_front_sup', name: 'G_front_sup' },
    {
      kind: 'tissue',
      source_name: 'Left-Cerebral-White-Matter',
      name: 'Left-Cerebral-White-Matter',
    },
    { kind: 'tissue', source_name: 'Left-Lateral-Ventricle', name: 'Left-Lateral-Ventricle' },
  ].map((label) =>
    asLabel({
      ...label,
      region_id: 'region',
      source_label_id: 1,
      hemisphere: 'left',
      color: [1, 2, 3],
    }),
  );
  const palette = createPalette(
    tissues,
    asDisplaySettings({ ...state, surfaceColor: 'tissue' }),
    appearance.tissue,
  );
  for (const [index, label] of tissues.entries()) {
    assertColor(
      palette,
      index,
      new Color(tissueColor({ ...label, source_name: label.name }, appearance.tissue)),
    );
  }
  assert.notDeepEqual(palette.slice(0, 3), palette.slice(4, 7));
  assert.notDeepEqual(palette.slice(4, 7), palette.slice(8, 11));
});

test('removed cut labels have zero alpha and cannot be picked', () => {
  const hidden = asDisplaySettings({ ...state, hiddenRegions: new Set([labels[1]!.region_id]) });
  assert.equal(labelVisible(labels[1]!, hidden), false);
  const palette = createPalette(labels, hidden, appearance.tissue);
  assert.equal(palette[7], 0);
  assert.equal(palette[11], 1);
});

test('a cut paints a label in the colour its published sRGB value names', () => {
  const palette = createPalette(labels, state, undefined as never);
  // Published colours are sRGB, as the surfaces' decoded glTF factors are now.
  const expected = new Color().setRGB(23 / 255, 220 / 255, 60 / 255, SRGBColorSpace);
  near(palette[4]!, expected.r);
  near(palette[5]!, expected.g);
  assert.equal(palette[7], 1);
  assert.equal(palette[3], 0);
});

test('a cut carries the same network colour the surface carries', () => {
  const networks = { colors: { Default: [205, 62, 78], Vis: [120, 18, 134] } };
  const regions = new Map([
    [
      'destrieux:left:1',
      asRegion({
        networks: [
          { network: 'Default', fraction: 0.6 },
          { network: 'Vis', fraction: 0.3 },
        ],
      }),
    ],
  ]);
  const palette = createPalette(
    labels,
    asDisplaySettings({ ...state, surfaceColor: 'network' }),
    appearance.tissue,
    asLookup({ regions, networks }),
  );

  // The dominant share wins the parcel, in the surface's own conversion.
  assertColor(palette, 1, new Color().setRGB(205 / 255, 62 / 255, 78 / 255, SRGBColorSpace));

  // White matter is in no network and keeps the tissue colour it always had.
  assertColor(
    palette,
    2,
    new Color(tissueColor({ ...labels[2]!, source_name: undefined }, appearance.tissue)),
  );
});

test('a cut carries CAB-NP colours for the areas it assigns and tissue colour elsewhere', () => {
  const cabNp = { colors: { Default: [255, 0, 0] }, regions: { 'destrieux:left:1': 'Default' } };
  const palette = createPalette(
    labels,
    asDisplaySettings({ ...state, surfaceColor: 'cab-np' }),
    appearance.tissue,
    asLookup({ regions: new Map(), cabNp: cabNp as unknown as CabNpPartition }),
  );
  assertColor(palette, 1, new Color().setRGB(1, 0, 0, SRGBColorSpace));
  assertColor(
    palette,
    2,
    new Color(tissueColor({ ...labels[2]!, source_name: undefined }, appearance.tissue)),
  );
});

test('a cut carries the functional division of the level on show, and glass keeps tissue colour', () => {
  const functional = {
    levels: {
      named: [],
      sections: [{ id: 'section-22', color: [0, 0, 255] }],
    },
    regions: { named: {}, sections: { 'destrieux:left:1': 'section-22' } },
  } as unknown as FunctionalRegions;
  const cortex = new Color(
    tissueColor({ ...labels[1]!, source_name: undefined }, appearance.tissue),
  );
  const at = (level: string) =>
    createPalette(
      labels,
      asDisplaySettings({ ...state, surfaceColor: 'functional', functionalLevel: level }),
      appearance.tissue,
      asLookup({ regions: new Map(), functional }),
    );
  assertColor(at('sections'), 1, new Color().setRGB(0, 0, 1, SRGBColorSpace));
  assertColor(at('named'), 1, cortex);
});

test('a paint colours a cut as it colours the surface, over the atlas colours, and tissue elsewhere', () => {
  const paint = { id: 'deficit:aphasia', colors: new Map([['destrieux:left:1', [0, 0, 255]]]) };
  const palette = createPalette(
    labels,
    asDisplaySettings({ ...state, paint }),
    appearance.tissue,
    asLookup({ regions: new Map() }),
  );
  assertColor(palette, 1, new Color().setRGB(0, 0, 1, SRGBColorSpace));
  assertColor(
    palette,
    2,
    new Color(tissueColor({ ...labels[2]!, source_name: undefined }, appearance.tissue)),
  );
});

test('a NextBrain cortical cut parcel carries the network colour of its region', () => {
  // NextBrain cut labels are kind `tissue` — they have no surface — but its
  // cortical parcels still have a region record, and that record can carry
  // the same network shares the Destrieux/HCP surfaces publish.
  const nextbrainLabels = [
    {
      source_label_id: 0,
      region_id: null,
      kind: 'tissue',
      hemisphere: 'midline',
      color: [0, 0, 0],
      name: 'Unknown',
    },
    {
      source_label_id: 2001,
      region_id: 'nextbrain:left:2001',
      kind: 'tissue',
      hemisphere: 'left',
      color: [25, 100, 40],
      name: 'Left-ctx-rh-bankssts',
    },
    {
      source_label_id: 48,
      region_id: 'nextbrain:left:48',
      kind: 'tissue',
      hemisphere: 'left',
      color: [10, 20, 30],
      name: 'Left-head_of_caudate',
    },
  ].map(asLabel);
  const networks = { colors: { Default: [205, 62, 78] } };
  const regions = new Map<string, Region>([
    [
      'nextbrain:left:2001',
      asRegion({
        kind: 'tissue-region',
        networks: [
          { network: 'Default', fraction: 0.8 },
          { network: 'Vis', fraction: 0.15 },
        ],
      }),
    ],
    ['nextbrain:left:48', asRegion({ kind: 'tissue-region' })],
  ]);
  const palette = createPalette(
    nextbrainLabels,
    asDisplaySettings({ ...state, surfaceColor: 'network' }),
    appearance.tissue,
    asLookup({ regions, networks }),
  );
  assertColor(palette, 1, new Color().setRGB(205 / 255, 62 / 255, 78 / 255, SRGBColorSpace));
  assertColor(
    palette,
    2,
    new Color(
      tissueColor({ kind: 'tissue', source_name: 'Left-head_of_caudate' }, appearance.tissue),
    ),
  );
});

test('published NextBrain cortical cut labels take network colour', () => {
  const metadata = readModel<{ atlases: Record<string, { labels: Label[] }> }>(
    `${published}/tissue-labels.json`,
  );
  const manifest = readModel<{
    regions: Region[];
    networks?: PaletteLookup['networks'];
    appearance: { tissue: TissueAppearance };
  }>(`${published}/manifest.json`);
  const record = metadata.atlases.nextbrain;
  if (!record || !manifest.networks) return;
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const palette = createPalette(
    record.labels,
    asDisplaySettings({ ...state, surfaceColor: 'network' }),
    manifest.appearance.tissue,
    asLookup({ regions, networks: manifest.networks }),
  );
  const cortical = record.labels
    .map((label, code) => ({ label, code }))
    .filter(({ label }) => label.name?.includes('ctx-'));
  assert.ok(cortical.length > 0);
  let painted = 0;
  for (const { label, code } of cortical) {
    const tissue = new Color(
      tissueColor({ ...label, source_name: label.name }, manifest.appearance.tissue),
    );
    const rgb = channelsOf(palette, code);
    if (rgb.some((value, channel) => Math.abs(value - tissue.toArray()[channel]!) > 1e-5)) {
      painted += 1;
    }
  }
  assert.ok(painted > 0, 'NextBrain cortical parcels should not all stay tissue-coloured');
});

test('a region in no network is not given one on a cut', () => {
  const regions = new Map([['destrieux:left:1', asRegion({ networks: [] })]]);
  const palette = createPalette(
    labels,
    asDisplaySettings({ ...state, surfaceColor: 'network' }),
    appearance.tissue,
    asLookup({ regions, networks: { colors: { Default: [205, 62, 78] } } }),
  );
  assertColor(
    palette,
    1,
    new Color(tissueColor({ ...labels[1]!, source_name: undefined }, appearance.tissue)),
  );
});

test('hemisphere and isolation hide samples rather than relabeling them', () => {
  const settings = (fields: object) => asDisplaySettings({ ...state, ...fields });
  assert.equal(labelVisible(labels[1]!, settings({ hemisphere: 'right' })), false);
  assert.equal(labelVisible(labels[1]!, settings({ isolatedRegion: 'destrieux:left:1' })), true);
  assert.equal(labelVisible(labels[2]!, settings({ isolatedRegion: 'destrieux:left:1' })), false);
});

test('periventricular and paraventricular nuclei remain gray matter, not CSF', () => {
  for (const name of [
    'Left-paraventricular_nucleus_of_hypothalamus',
    'Right-periventricular_nucleus__supraoptic_portion',
    'Left-juxtaparaventricular_lateral_hypothalamic_area',
  ]) {
    assert.equal(
      tissueColor({ kind: 'structure', source_name: name }, appearance.tissue),
      appearance.tissue.gray,
      name,
    );
  }
  for (const name of ['Left-Lateral-Ventricle', 'Right-Inf-Lat-Vent', '3rd-Ventricle', 'CSF']) {
    assert.equal(
      tissueColor({ kind: 'structure', source_name: name }, appearance.tissue),
      appearance.tissue.fluid,
      name,
    );
  }
});

// The other half of the catalog's 'learning systems filter detailed cut labels' test
// (core/catalog/internal-anatomy.test.ts): a cut label follows the same system filter.
test('learning systems filter detailed cut labels through source membership', () => {
  const nucleus = asRegion({
    id: 'nextbrain:left:219',
    atlas: 'nextbrain',
    kind: 'structure',
    hemisphere: 'left',
    source_label_id: 219,
    source_name: 'anterodorsal_nucleus_of_thalamus',
  });
  const unrelated = asRegion({
    id: 'nextbrain:left:108',
    atlas: 'nextbrain',
    kind: 'tissue-region',
    hemisphere: 'left',
    source_label_id: 108,
    source_name: 'basal_nucleus_of_meynert',
  });
  const settings = asDisplaySettings({
    detail: 'learning',
    hemisphere: 'both',
    cutAtlas: 'nextbrain',
    cutActive: true,
    internalSystem: 'Diencephalon',
    internalConstituents: new Set([nucleus.id]),
  });
  const lookup = asLookup({
    regions: new Map([nucleus, unrelated].map((item) => [item.id, item])),
  });
  for (const [item, expected] of [
    [nucleus, true],
    [unrelated, false],
  ] as const) {
    const label = asLabel({
      source_label_id: item.source_label_id,
      kind: 'tissue',
      hemisphere: 'left',
      region_id: item.id,
    });
    assert.equal(labelVisible(label, settings, lookup), expected);
  }
});
