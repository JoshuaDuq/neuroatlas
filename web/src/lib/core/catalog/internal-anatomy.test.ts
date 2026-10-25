/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Language } from '../../types/index.ts';
import { labelOf as labelOfRegion } from './labels.ts';
import { asDisplaySettings, asRegion } from './test-support.ts';
import { visibilityOf as visibilityOfRegion } from './visibility.ts';

const labelOf = (fields: object, lang?: Language) => labelOfRegion(asRegion(fields), lang)!;
const visibilityOf = (region: object, settings: object) =>
  visibilityOfRegion(asRegion(region), asDisplaySettings(settings));

const region = {
  id: 'learning:left:caudate',
  kind: 'structure',
  atlas: 'learning',
  hemisphere: 'left',
  source_name: 'Caudate nucleus',
  display_names: { en: 'Caudate nucleus', fr: 'Noyau caudé' },
  system_names: { en: 'Basal ganglia', fr: 'Ganglions de la base' },
};
const state = { detail: 'learning', hemisphere: 'both' };

test('learning structures use their explicit bilingual anatomical names', () => {
  assert.equal(labelOf(region).name, 'Caudate nucleus');
  assert.equal(labelOf(region, 'fr').group, 'Ganglions de la base');
});

test('system exploration excludes unrelated structures without changing laterality', () => {
  assert.equal(visibilityOf(region, { ...state, internalSystem: 'Basal ganglia' }).visible, true);
  assert.equal(
    visibilityOf(region, { ...state, internalSystem: 'Brainstem' }).reason,
    'other-system',
  );
  assert.equal(
    visibilityOf(region, { ...state, internalSystem: 'Basal ganglia', hemisphere: 'right' })
      .visible,
    false,
  );
});

test('NextBrain nuclei are grouped anatomically in either language', () => {
  const thalamic = {
    atlas: 'nextbrain',
    source_label_id: 10219,
    source_name: 'anterodorsal_nucleus_of_thalamus',
    kind: 'structure',
  };
  assert.equal(labelOf(thalamic).group, 'Thalamus');
  assert.equal(
    labelOf({ ...thalamic, source_label_id: 595, source_name: 'molecular_layer_of_pva' }).group,
    'Cerebellum',
  );
  assert.equal(
    labelOf({ ...thalamic, source_label_id: 595, source_name: 'molecular_layer_of_pva' }, 'fr')
      .group,
    'Cervelet',
  );
});

// The legacy test 'learning systems filter detailed cut labels through source membership' also
// asserted `labelVisible` from tissues/palette.js, which an engine chunk ports; this half is the
// catalog's own: the system filter follows source membership for the overview's constituents.
test('learning systems filter detailed cut labels through source membership', () => {
  const nucleus = {
    id: 'nextbrain:left:219',
    atlas: 'nextbrain',
    kind: 'structure',
    hemisphere: 'left',
    source_label_id: 219,
    source_name: 'anterodorsal_nucleus_of_thalamus',
  };
  const unrelated = {
    id: 'nextbrain:left:108',
    atlas: 'nextbrain',
    kind: 'tissue-region',
    hemisphere: 'left',
    source_label_id: 108,
    source_name: 'basal_nucleus_of_meynert',
  };
  const settings = {
    ...state,
    cutAtlas: 'nextbrain',
    cutActive: true,
    internalSystem: 'Diencephalon',
    internalConstituents: new Set([nucleus.id]),
  };
  for (const [item, expected] of [
    [nucleus, true],
    [unrelated, false],
  ] as const) {
    assert.equal(visibilityOf(item, settings).visible, expected);
  }
});
