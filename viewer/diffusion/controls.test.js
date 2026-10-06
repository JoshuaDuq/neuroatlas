import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import { lengthSummary, settingsReadout, tractRowName, tractRows } from './controls.js';
import { DIFFUSION_TEXT } from './translations.js';

const catalog = parse(await readFile(new URL('../../data/diffusion.yaml', import.meta.url), 'utf8'));
const bundle = (id, en, fr = en) => ({ id, name: { en, fr } });

test('a tract’s left and right files share one row, left first', () => {
  const rows = tractRows([bundle('af-right', 'Arcuate fasciculus · right'), bundle('af-left', 'Arcuate fasciculus · left')]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sided, true);
  assert.deepEqual(rows[0].members.map(member => member.part), ['left', 'right']);
  assert.equal(tractRowName(rows[0], 'en'), 'Arcuate fasciculus');
});

test('numbered segments share a row named without the number', () => {
  const [row] = tractRows([bundle('cc-1', 'Corpus callosum · source segment 1', 'Corps calleux · segment source 1'),
    bundle('cc-2', 'Corpus callosum · source segment 2', 'Corps calleux · segment source 2')]);
  assert.equal(row.sided, false);
  assert.deepEqual(row.members.map(member => member.part), ['1', '2']);
  assert.equal(tractRowName(row, 'en'), 'Corpus callosum · source segment');
  assert.equal(tractRowName(row, 'fr'), 'Corps calleux · segment source');
});

test('a bundle with neither side nor segment, or members that disagree, is an error', () => {
  assert.throws(() => tractRows([bundle('fornix', 'Fornix')]), /neither a side nor a segment/);
  const [row] = tractRows([bundle('x-left', 'One · left'), bundle('x-right', 'Other · right')]);
  assert.throws(() => tractRowName(row, 'en'), /disagree/);
});

test('the published collection reads as one row per tract in both languages', () => {
  const rows = tractRows(catalog.bundles);
  assert.equal(rows.reduce((total, row) => total + row.members.length, 0), catalog.bundles.length);
  assert.equal(rows.length, 11);
  for (const row of rows) {
    for (const lang of ['en', 'fr']) assert.ok(tractRowName(row, lang));
  }
});

test('tract lengths read in the reader’s notation, and the settings readout names opacity and filter', () => {
  const metrics = { mean: 142.25, min: 75, max: 239.46 };
  assert.equal(lengthSummary(metrics, DIFFUSION_TEXT.en, 'en'), 'mean 142.3\u202fmm (range 75.0–239.5)');
  assert.equal(lengthSummary(metrics, DIFFUSION_TEXT.fr, 'fr'), 'moyenne 142,3\u202fmm (étendue 75,0–239,5)');
  assert.equal(settingsReadout(0.16, 1, 'en'), '16% · ≥1\u202fmm');
  assert.equal(settingsReadout(1, 40, 'fr'), '100% · ≥40\u202fmm');
});
