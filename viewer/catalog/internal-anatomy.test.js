import assert from 'node:assert/strict';
import test from 'node:test';
import { labelOf } from './labels.js';
import { visibilityOf } from './visibility.js';

const region = { id: 'learning:left:caudate', kind: 'structure', atlas: 'learning',
  hemisphere: 'left', source_name: 'Caudate nucleus',
  display_names: { en: 'Caudate nucleus', fr: 'Noyau caudé' },
  system_names: { en: 'Basal ganglia', fr: 'Ganglions de la base' } };
const state = { detail: 'learning', hemisphere: 'both' };

test('learning structures use their explicit bilingual anatomical names', () => {
  assert.equal(labelOf(region).name, 'Caudate nucleus');
  assert.equal(labelOf(region, 'fr').group, 'Ganglions de la base');
});

test('system exploration excludes unrelated structures without changing laterality', () => {
  assert.equal(visibilityOf(region, { ...state, internalSystem: 'Basal ganglia' }).visible, true);
  assert.equal(visibilityOf(region, { ...state, internalSystem: 'Brainstem' }).reason, 'other-system');
  assert.equal(visibilityOf(region, { ...state, internalSystem: 'Basal ganglia', hemisphere: 'right' }).visible, false);
});

test('NextBrain nuclei are grouped anatomically in either language', () => {
  const thalamic = { atlas: 'nextbrain', source_label_id: 10219,
    source_name: 'anterodorsal_nucleus_of_thalamus', kind: 'structure' };
  assert.equal(labelOf(thalamic).group, 'Thalamus');
  assert.equal(labelOf({ ...thalamic, source_label_id: 595, source_name: 'molecular_layer_of_pva' }).group, 'Cerebellum');
  assert.equal(labelOf({ ...thalamic, source_label_id: 595, source_name: 'molecular_layer_of_pva' }, 'fr').group, 'Cervelet');
});

test('learning systems filter detailed cut labels through source membership', async () => {
  const { labelVisible } = await import('../tissues/palette.js');
  const nucleus = { id: 'nextbrain:left:219', atlas: 'nextbrain', kind: 'structure',
    hemisphere: 'left', source_label_id: 219, source_name: 'anterodorsal_nucleus_of_thalamus' };
  const unrelated = { id: 'nextbrain:left:108', atlas: 'nextbrain', kind: 'tissue-region',
    hemisphere: 'left', source_label_id: 108, source_name: 'basal_nucleus_of_meynert' };
  const settings = { ...state, cutAtlas: 'nextbrain', cutActive: true,
    internalSystem: 'Diencephalon', internalConstituents: new Set([nucleus.id]) };
  const lookup = { regions: new Map([nucleus, unrelated].map(item => [item.id, item])) };
  for (const [item, expected] of [[nucleus, true], [unrelated, false]]) {
    const label = { source_label_id: item.source_label_id, kind: 'tissue',
      hemisphere: 'left', region_id: item.id };
    assert.equal(visibilityOf(item, settings).visible, expected);
    assert.equal(labelVisible(label, settings, lookup), expected);
  }
});
