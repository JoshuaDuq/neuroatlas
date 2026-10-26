import assert from 'node:assert/strict';
import { test } from 'vitest';
import { count } from '../format.ts';
import { TRANSLATIONS, atlasSwitchLabel, t } from './index.ts';

const both = <A extends keyof typeof TRANSLATIONS.en>(area: A) => ({
  en: TRANSLATIONS.en[area],
  fr: TRANSLATIONS.fr[area],
});
const CLINICAL_TEXT = both('clinical');
const CIRCUIT_TEXT = both('circuits');
const DIFFUSION_TEXT = both('diffusion');

test('count formats plural nouns in French correctly', () => {
  assert.equal(count(0, 'region', 'fr'), '0 régions');
  assert.equal(count(1, 'region', 'fr'), '1 région');
  assert.equal(count(2, 'region', 'fr'), '2 régions');
  assert.equal(count(183, 'region', 'fr'), '183 régions');
  assert.equal(count(1, 'match', 'fr'), '1 correspondance');
  assert.equal(count(5, 'match', 'fr'), '5 correspondances');
});

test('translations dictionary returns valid sections and falls back safely', () => {
  assert.ok(t('fr', 'header').languageSwitch === 'Langue');
  assert.ok(t('en', 'header').languageSwitch === 'Language');
  assert.ok(t('unknown', 'header').languageSwitch === 'Language');
  assert.equal(t('constructor', 'header'), TRANSLATIONS.en.header);
});

test('atlas switch labels are short names, not the full atlas title', () => {
  assert.equal(atlasSwitchLabel('destrieux', 'en'), 'Destrieux');
  assert.equal(atlasSwitchLabel('hcp-mmp', 'en'), 'HCP-MMP');
  assert.equal(atlasSwitchLabel('hcp-mmp', 'fr'), 'HCP-MMP');
  assert.equal(atlasSwitchLabel('destrieux', 'fr'), 'Destrieux');
  assert.equal(atlasSwitchLabel('nextbrain', 'en'), 'NextBrain');
  assert.equal(atlasSwitchLabel('learning', 'en'), 'Teaching set');
  assert.equal(atlasSwitchLabel('learning', 'fr'), 'Ensemble pédagogique');
  assert.equal(atlasSwitchLabel('unheard-of'), 'unheard-of');
});

test('UI actions and shortcuts are fully translated in English and French', () => {
  for (const lang of ['en', 'fr']) {
    assert.ok(t(lang, 'header').atlas);
    assert.ok(t(lang, 'navigator').clearSearch);
    assert.ok(t(lang, 'inspector').centroid);
    assert.ok(t(lang, 'viewport').snapshot);

    const keys = t(lang, 'shortcuts')
      .groups.flatMap(([, items]) => items)
      .map(([key]) => key);
    const escape = lang === 'fr' ? 'Échap' : 'Esc';
    for (const expectedKey of ['F', 'I', 'M', 'C', 'S', 'H', '0', '1 – 6', '/', escape]) {
      assert.ok(keys.includes(expectedKey), `Missing shortcut ${expectedKey} in ${lang}`);
    }
  }
});

test('the colophon and slice note name whichever brain was actually built', () => {
  // The viewer publishes one model at a time and must describe that one. A
  // sentence hardcoded to a subject outlives the build that made it true.
  const subject = { display_name: 'FreeSurfer “bert”', individual: true };
  const template = { display_name: 'FreeSurfer fsaverage', individual: false };

  for (const lang of ['en', 'fr']) {
    const colophon = (entry: typeof subject) =>
      t(lang, 'footer').colophon(entry.display_name, entry.individual);
    assert.match(colophon(subject), /bert/);
    assert.match(colophon(template), /fsaverage/);
    assert.notEqual(colophon(subject), colophon(template));
    // Neither description may survive into the other brain's colophon.
    assert.doesNotMatch(colophon(template), /bert/);

    const { note } = t(lang, 'mpr');
    assert.match(note(subject), /1 mm/);
    assert.notEqual(note(subject), note(template));
  }

  assert.notEqual(
    t('en', 'footer').colophon('bert', true),
    t('fr', 'footer').colophon('bert', true),
  );
});

/**
 * Legacy guarded against a second `mpr: {` block in one object literal silently replacing
 * the first (translations.js declared every area twice, once per language). Areas are now
 * one module each, so the invariant is that every area file is composed exactly once into
 * each language and nothing else is.
 */
test('every area file is composed into both languages, once', () => {
  const files = Object.keys(import.meta.glob('./areas/*.ts'))
    .map((path) => path.replace(/^\.\/areas\/(.*)\.ts$/, '$1'))
    .sort();
  assert.deepEqual(Object.keys(TRANSLATIONS.en).sort(), files);
  assert.deepEqual(Object.keys(TRANSLATIONS.fr).sort(), files);
  assert.equal(new Set(files).size, files.length);
});

/** Every leaf of a table by path; a function or an array is one leaf. */
const paths = (object: object, prefix = ''): string[] =>
  Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? paths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

test('every English string has a French counterpart', () => {
  const en = paths(TRANSLATIONS.en);
  const fr = paths(TRANSLATIONS.fr);
  assert.deepEqual(
    en.filter((key) => !fr.includes(key)),
    [],
    'missing French strings',
  );
  assert.deepEqual(
    fr.filter((key) => !en.includes(key)),
    [],
    'French strings with no English',
  );
});

const strings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String(value(1, 4)), String(value(3, 4))];
  return Object.values(value as object).flatMap(strings);
};

test('deficit, lesson and tract copy exists in English and French alike', () => {
  for (const table of [CLINICAL_TEXT, CIRCUIT_TEXT, DIFFUSION_TEXT]) {
    assert.deepEqual(Object.keys(table.fr).sort(), Object.keys(table.en).sort());
  }
});

test('panel copy names no tab the redesign removed', () => {
  const stale =
    /\bView →|\bVue →|\bSections\b|\bCoupes\b|\bRegion tab|in the explorer|dans l’explorateur/;
  const tables = { CLINICAL_TEXT, CIRCUIT_TEXT, DIFFUSION_TEXT };
  for (const [name, table] of Object.entries(tables)) {
    for (const lang of ['en', 'fr'] as const) {
      for (const text of strings(table[lang])) {
        assert.doesNotMatch(text, stale, `${name}.${lang}: ${text}`);
      }
    }
  }
});

test('an open deficit says how much of its mapping the stage outlines, or only shows while cut', () => {
  const { en, fr } = CLINICAL_TEXT;
  assert.equal(en.regionsMarked(7, 7, true), '7 regions coloured');
  assert.equal(en.regionsMarked(10, 11, true), '10 of 11 regions coloured');
  assert.equal(en.regionsMarked(1, 1, true), '1 region coloured');
  assert.equal(en.regionsMarked(0, 1, true), '0 of 1 region coloured');
  assert.equal(en.regionsMarked(7, 7, false), '7 regions visible');
  assert.equal(fr.regionsMarked(7, 7, true), '7 régions colorées');
  assert.equal(fr.regionsMarked(10, 11, true), '10 régions sur 11 colorées');
  assert.equal(fr.regionsMarked(1, 1, true), '1 région colorée');
  assert.equal(fr.regionsMarked(1, 3, true), '1 région sur 3 colorée');
  assert.equal(fr.regionsMarked(2, 3, false), '2 régions sur 3 visibles');
  assert.equal(fr.regionsMarked(1, 1, false), '1 région visible');
});

test('a tract row counts streamlines, and what the length filter keeps of them', () => {
  assert.equal(DIFFUSION_TEXT.en.streamlines(721, 721), '721 streamlines');
  assert.equal(DIFFUSION_TEXT.en.streamlines(640, 721), '640 of 721 streamlines');
  assert.equal(DIFFUSION_TEXT.en.streamlines(1, 1), '1 streamline');
  assert.equal(DIFFUSION_TEXT.fr.streamlines(2140, 2140), '2140 trajectoires');
  assert.equal(DIFFUSION_TEXT.en.streamlines(12345, 12345), '12 345 streamlines');
  assert.equal(DIFFUSION_TEXT.fr.streamlines(640, 721), '640 sur 721 trajectoires');
});

test('the circuits list counts its lessons and their landmarks in both languages', () => {
  assert.equal(CIRCUIT_TEXT.en.coverage(8, 33), '8 guided circuits · 33 landmarks');
  assert.equal(CIRCUIT_TEXT.fr.coverage(8, 33), '8 parcours guidés · 33 repères');
  assert.deepEqual([1, 4].map(CIRCUIT_TEXT.en.landmarkCount), ['1 landmark', '4 landmarks']);
  assert.deepEqual([1, 4].map(CIRCUIT_TEXT.fr.landmarkCount), ['1 repère', '4 repères']);
});

test('the MRI area names every tissue label in both languages, and its dialog is translated', () => {
  const { dialog, tissueNames } = TRANSLATIONS.fr.mri;
  assert.deepEqual(Object.keys(tissueNames), Object.keys(TRANSLATIONS.en.mri.tissueNames));
  assert.equal(tissueNames['Left-Cerebral-Cortex'], 'Cortex cérébral gauche');
  assert.equal(TRANSLATIONS.en.mri.tissueNames['Left-Cerebral-Cortex'], 'Left cerebral cortex');
  assert.equal(
    dialog.grid([182, 218, 182], '1 mm'),
    '182 × 218 × 182 voxels source · espacement de 1 mm',
  );
  assert.equal(
    TRANSLATIONS.en.mri.dialog.grid([2, 3], '1 mm'),
    '2 × 3 source voxels · 1 mm spacing',
  );
});

test('both languages explain the actual denominator and the display threshold', () => {
  const english = t('en', 'networks');
  const french = t('fr', 'networks');
  assert.match(english.notes.vertices, /vertices/);
  assert.match(english.notes.voxels, /voxels/);
  assert.match(french.notes.vertices, /sommets/);
  assert.match(french.notes.voxels, /voxels/);
  for (const notes of [english.notes, french.notes]) {
    for (const note of Object.values(notes)) assert.match(note, /5\s?%/);
  }
});

test('the spoken tract filter result counts bundles in the reader’s grammar', () => {
  assert.equal(t('en', 'diffusion').matches(1), '1 tract bundle');
  assert.equal(t('en', 'diffusion').matches(12), '12 tract bundles');
  assert.equal(t('fr', 'diffusion').matches(1), '1 faisceau');
  assert.equal(t('fr', 'diffusion').matches(12), '12 faisceaux');
});

test('the French Escape row names the function and the deficit, as the English row does', () => {
  const row = (lang: string) =>
    t(lang, 'shortcuts')
      .groups.flatMap(([, items]) => items)
      .find(([key]) => key === (lang === 'fr' ? 'Échap' : 'Esc'))![1];
  assert.match(row('en'), /function or deficit$/);
  assert.match(row('fr'), /la fonction ou le déficit$/);
});
