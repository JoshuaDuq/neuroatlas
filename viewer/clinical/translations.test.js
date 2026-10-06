import assert from 'node:assert/strict';
import test from 'node:test';
import { CLINICAL_TEXT } from './translations.js';
import { CIRCUIT_TEXT } from '../learning/translations.js';
import { DIFFUSION_TEXT } from '../diffusion/translations.js';

const TABLES = { CLINICAL_TEXT, CIRCUIT_TEXT, DIFFUSION_TEXT };

function strings(value) {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String(value(1, 4)), String(value(3, 4))];
  return Object.values(value).flatMap(strings);
}

test('deficit, lesson and tract copy exists in English and French alike', () => {
  for (const [name, table] of Object.entries(TABLES)) {
    assert.deepEqual(Object.keys(table.fr).sort(), Object.keys(table.en).sort(), name);
  }
});

test('panel copy names no tab the redesign removed', () => {
  const stale = /\bView →|\bVue →|\bSections\b|\bCoupes\b|\bRegion tab|in the explorer|dans l’explorateur/;
  for (const [name, table] of Object.entries(TABLES)) {
    for (const lang of ['en', 'fr']) {
      for (const text of strings(table[lang])) assert.doesNotMatch(text, stale, `${name}.${lang}: ${text}`);
    }
  }
});

test('an open deficit says how much of its mapping the stage outlines, or only shows while cut', () => {
  const { en, fr } = CLINICAL_TEXT;
  assert.equal(en.regionsMarked(7, 7, true), '7 mapped regions outlined');
  assert.equal(en.regionsMarked(5, 8, true), '5 of 8 mapped regions outlined');
  assert.equal(en.regionsMarked(1, 1, true), '1 mapped region outlined');
  assert.equal(en.regionsMarked(0, 1, true), '0 of 1 mapped region outlined');
  assert.equal(en.regionsMarked(7, 7, false), '7 mapped regions visible');
  assert.equal(fr.regionsMarked(7, 7, true), '7 régions associées entourées');
  assert.equal(fr.regionsMarked(5, 8, true), '5 sur 8 régions associées entourées');
  assert.equal(fr.regionsMarked(1, 1, true), '1 région associée entourée');
  assert.equal(fr.regionsMarked(2, 3, false), '2 sur 3 régions associées visibles');
  assert.equal(fr.regionsMarked(1, 1, false), '1 région associée visible');
});

test('a tract row counts streamlines, and what the length filter keeps of them', () => {
  assert.equal(DIFFUSION_TEXT.en.streamlines(721, 721), '721 streamlines');
  assert.equal(DIFFUSION_TEXT.en.streamlines(640, 721), '640 of 721 streamlines');
  assert.equal(DIFFUSION_TEXT.en.streamlines(1, 1), '1 streamline');
  assert.equal(DIFFUSION_TEXT.fr.streamlines(2140, 2140), '2140 trajectoires');
  assert.equal(DIFFUSION_TEXT.en.streamlines(12345, 12345), '12\u2009345 streamlines');
  assert.equal(DIFFUSION_TEXT.fr.streamlines(640, 721), '640 sur 721 trajectoires');
});
