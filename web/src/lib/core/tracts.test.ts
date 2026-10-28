import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoYaml } from '../../../test/repo.ts';
import type { TractBundle as LoadedBundle } from '../engine/api.ts';
import { TRACT_CATALOGS } from './diffusion/catalogs.ts';
import type { TractCatalog, TractClass } from './diffusion/catalogs.ts';
import { t } from './i18n/index.ts';
import {
  buildLengthsCsv,
  LENGTHS_CSV_FILENAME,
  LENGTHS_CSV_TYPE,
  foldForSearch,
  lengthSummary,
  settingsReadout,
  bundleName,
  tractGroups,
  tractRowName,
  tractRows,
  tractSearchText,
} from './tracts.ts';

const bundle = (id: string, en: string, fr = en, fibreClass: TractClass = 'association') => ({
  id,
  file: `${id}.trk`,
  name: { en, fr },
  class: fibreClass,
});

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
  assert.throws(
    () =>
      tractRows([
        bundle('x-left', 'One · left'),
        bundle('x-right', 'One · right', 'One · right', 'projection'),
      ]),
    /mixes fibre classes/,
  );
  assert.throws(
    () => tractRows([bundle('x-left', 'One · left', 'One · left', 'limbic' as TractClass)]),
    /no known fibre class/,
  );
});

test('rows group by fibre class in anatomical order, keeping list order inside a class', () => {
  const rows = tractRows([
    bundle('cc-1', 'Corpus callosum · whole', 'Corps calleux · entier', 'commissural'),
    bundle('af-left', 'Arcuate · left'),
    bundle('cst-left', 'Corticospinal · left', 'Corticospinal · gauche', 'projection'),
    bundle('uf-left', 'Uncinate · left'),
  ]);
  assert.deepEqual(
    tractGroups(rows).map(({ fibreClass, rows }) => [fibreClass, rows.map((row) => row.key)]),
    [
      ['association', ['af', 'uf']],
      ['projection', ['cst']],
      ['commissural', ['cc']],
    ],
  );
  assert.deepEqual(
    tractGroups(rows.filter((row) => row.fibreClass !== 'projection')).map((g) => g.fibreClass),
    ['association', 'commissural'],
  );
});

test('a lone numbered bundle is a whole tract named without its qualifier', () => {
  const [row] = tractRows([
    bundle('cc-1', 'Corpus callosum · whole', 'Corps calleux · entier', 'commissural'),
  ]);
  assert.equal(tractRowName(row!, 'en'), 'Corpus callosum');
  assert.equal(tractRowName(row!, 'fr'), 'Corps calleux');
});

test('a segment’s name carries its anatomical part, and the search finds it', () => {
  const [row] = tractRows([
    {
      ...bundle(
        'callosum-7',
        'Corpus callosum · segment 7',
        'Corps calleux · segment 7',
        'commissural',
      ),
      segment: { en: 'splenium', fr: 'splénium' },
    },
    bundle('callosum-1', 'Corpus callosum · segment 1', 'Corps calleux · segment 1', 'commissural'),
  ]);
  assert.equal(bundleName(row!.members[0]!.bundle, 'en'), 'Corpus callosum · segment 7 · splenium');
  assert.equal(bundleName(row!.members[1]!.bundle, 'fr'), 'Corps calleux · segment 1');
  assert.ok(tractSearchText(row!, 'fr').includes(foldForSearch('splenium', 'fr')));
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

test('TRACT-02: the 30 catalog bundles read as 13 rows whose names include the known tracts', () => {
  const rows = tractRows(TRACT_CATALOGS[0]!.bundles);
  assert.equal(rows.length, 13);
  const names = rows.map((row) => tractRowName(row, 'en'));
  for (const name of [
    'Arcuate fasciculus',
    'Corticospinal tract',
    'Cingulum',
    'Corpus callosum',
    'Corpus callosum \u00b7 TractSeg segment',
  ])
    assert.ok(names.includes(name), name);
  assert.deepEqual(
    tractGroups(rows).map(({ fibreClass, rows }) => [fibreClass, rows.length]),
    [
      ['association', 10],
      ['projection', 1],
      ['commissural', 2],
    ],
  );
  const segments = TRACT_CATALOGS[0]!.bundles.filter((bundle) => bundle.id.startsWith('callosum-'));
  assert.deepEqual(
    segments.map((bundle) => bundle.segment?.en),
    [
      'rostrum',
      'genu',
      'rostral body',
      'anterior midbody',
      'posterior midbody',
      'isthmus',
      'splenium',
    ],
  );
});

test('TRACT-06: tiny and zero-based lengths keep one decimal in both languages', () => {
  const metrics = { mean: 0.05, min: 0, max: 1000 };
  assert.equal(
    lengthSummary(metrics, t('en', 'diffusion'), 'en'),
    'mean 0.1\u202fmm (range 0.0\u20131000.0)',
  );
  assert.equal(
    lengthSummary(metrics, t('fr', 'diffusion'), 'fr'),
    'moyenne 0,1\u202fmm (\u00e9tendue 0,0\u20131000,0)',
  );
});

test('TRACT-15: a zero opacity and a 250 mm filter read in both languages', () => {
  assert.equal(settingsReadout(0, 250, 'en'), '0% \u00b7 \u2265250\u202fmm');
  assert.equal(settingsReadout(0, 250, 'fr'), '0\u202f% \u00b7 \u2265250\u202fmm');
});

test('TRACT-19: the download is named planum-streamline-lengths.csv and typed text/csv', () => {
  assert.equal(LENGTHS_CSV_FILENAME, 'planum-streamline-lengths.csv');
  assert.equal(LENGTHS_CSV_TYPE, 'text/csv;charset=utf-8');
});

test('TRACT-19: a CSV of the 30 catalog bundles has a header, 30 rows in catalog order and a final newline', () => {
  const bundles = TRACT_CATALOGS[0]!.bundles;
  const lines = buildLengthsCsv(
    bundles.map((b) => loaded({ id: b.id, name: b.name.en })),
    1,
  ).split('\n');
  assert.equal(lines.length, 32);
  assert.equal(lines[31], '');
  assert.deepEqual(
    lines.slice(1, 31).map((line) => line.split(',')[0]),
    bundles.map((b) => `"${b.name.en}"`),
  );
});
