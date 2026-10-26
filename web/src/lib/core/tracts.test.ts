import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoYaml } from '../../../test/repo.ts';
import type { TractBundle as LoadedBundle } from '../engine/api.ts';
import { TRACT_CATALOGS } from './diffusion/catalogs.ts';
import type { TractCatalog } from './diffusion/catalogs.ts';
import { t } from './i18n/index.ts';
import {
  buildLengthsCsv,
  foldForSearch,
  lengthSummary,
  settingsReadout,
  tractRowName,
  tractRows,
  tractSearchText,
} from './tracts.ts';

const bundle = (id: string, en: string, fr = en) => ({ id, file: `${id}.trk`, name: { en, fr } });

// Ported from viewer/diffusion/controls.test.js.
test('a tract’s left and right files share one row, left first', () => {
  const rows = tractRows([
    bundle('af-right', 'Arcuate fasciculus · right'),
    bundle('af-left', 'Arcuate fasciculus · left'),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.sided, true);
  assert.deepEqual(
    rows[0]!.members.map((member) => member.part),
    ['left', 'right'],
  );
  assert.equal(tractRowName(rows[0]!, 'en'), 'Arcuate fasciculus');
});

test('numbered segments share a row named without the number', () => {
  const [row] = tractRows([
    bundle('cc-1', 'Corpus callosum · source segment 1', 'Corps calleux · segment source 1'),
    bundle('cc-2', 'Corpus callosum · source segment 2', 'Corps calleux · segment source 2'),
  ]);
  assert.equal(row!.sided, false);
  assert.deepEqual(
    row!.members.map((member) => member.part),
    ['1', '2'],
  );
  assert.equal(tractRowName(row!, 'en'), 'Corpus callosum · source segment');
  assert.equal(tractRowName(row!, 'fr'), 'Corps calleux · segment source');
});

test('a bundle with neither side nor segment, or members that disagree, is an error', () => {
  assert.throws(() => tractRows([bundle('fornix', 'Fornix')]), /neither a side nor a segment/);
  const [row] = tractRows([bundle('x-left', 'One · left'), bundle('x-right', 'Other · right')]);
  assert.throws(() => tractRowName(row!, 'en'), /disagree/);
  assert.throws(
    () => tractRows([bundle('x-left', 'One · left'), bundle('x-1', 'One 1')]),
    /mixes sides and segments/,
  );
});

test('each published collection reads as one row per tract in both languages', () => {
  const tracts: Record<string, number> = { 'cdmd-sub-013': 13 };
  const { tract_catalogs: paths } = readRepoYaml<{ tract_catalogs: string[] }>('config/model.yaml');
  for (const path of paths) {
    const catalog = readRepoYaml<TractCatalog>(path);
    const rows = tractRows(catalog.bundles);
    assert.equal(
      rows.reduce((total, row) => total + row.members.length, 0),
      catalog.bundles.length,
    );
    assert.equal(rows.length, tracts[catalog.id], catalog.id);
    for (const row of rows) {
      for (const lang of ['en', 'fr'] as const) assert.ok(tractRowName(row, lang));
    }
  }
  assert.equal(TRACT_CATALOGS[0]!.bundles.length, 30);
});

test('tract lengths read in the reader’s notation, and the settings readout names opacity and filter', () => {
  const metrics = { mean: 142.25, min: 75, max: 239.46 };
  assert.equal(
    lengthSummary(metrics, t('en', 'diffusion'), 'en'),
    'mean 142.3 mm (range 75.0–239.5)',
  );
  assert.equal(
    lengthSummary(metrics, t('fr', 'diffusion'), 'fr'),
    'moyenne 142,3 mm (étendue 75,0–239,5)',
  );
  assert.equal(settingsReadout(0.16, 1, 'en'), '16% · ≥1 mm');
  assert.equal(settingsReadout(1, 40, 'fr'), '100 % · ≥40 mm');
});

test('the search folds case and accents, and matches the row name or any member name', () => {
  const [row] = tractRows([
    bundle('arcuate-left', 'Arcuate · left', 'Arqué · gauche'),
    bundle('arcuate-right', 'Arcuate · right', 'Arqué · droit'),
  ]);
  assert.equal(foldForSearch('Arqué', 'fr'), 'arque');
  assert.ok(tractSearchText(row!, 'fr').includes(foldForSearch('arque', 'fr')));
  assert.ok(tractSearchText(row!, 'fr').includes('gauche'));
  assert.ok(!tractSearchText(row!, 'en').includes('gauche'));
});

const loaded = (over: Partial<LoadedBundle>): LoadedBundle => ({
  id: 'a',
  catalogId: 'a',
  name: 'Arcuate · left',
  label: { en: 'Arcuate · left' },
  file: 'a.trk',
  visible: true,
  total: 1234,
  shown: 1000,
  mean: 142.25,
  min: 75,
  max: 239.5,
  ...over,
});

test('the lengths CSV quotes names, guards formulas and blanks hidden bundles', () => {
  const csv = buildLengthsCsv(
    [
      loaded({}),
      loaded({ name: '=SUM(A1)' }),
      loaded({ name: '+x' }),
      loaded({ name: '-x' }),
      loaded({ name: '@x' }),
      loaded({ name: 'He said "hi", left', visible: false }),
    ],
    40,
  );
  assert.equal(
    csv,
    [
      'bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm',
      '"Arcuate · left",1234,1000,40,142.25,75,239.5',
      '"\'=SUM(A1)",1234,1000,40,142.25,75,239.5',
      '"\'+x",1234,1000,40,142.25,75,239.5',
      '"\'-x",1234,1000,40,142.25,75,239.5',
      '"\'@x",1234,1000,40,142.25,75,239.5',
      '"He said ""hi"", left",1234,0,40,,,',
      '',
    ].join('\n'),
  );
  assert.ok(!csv.includes('\r'));
  assert.ok(!csv.startsWith('﻿'));
});

test('a bundle with no length left after the filter exports blank metrics', () => {
  const csv = buildLengthsCsv([loaded({ shown: 0, mean: null, min: null, max: null })], 250);
  assert.equal(csv.split('\n')[1], '"Arcuate · left",1234,0,250,,,');
});
