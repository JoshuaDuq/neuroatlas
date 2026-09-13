import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import { createSession } from '../state/session.js';
import { decodeState, encodeState } from '../state/url-state.js';
import { count } from '../ui/format.js';
import { edgeLabels } from '../render/orientation.js';
import { TRANSLATIONS, t } from './translations.js';

test('session accepts and toggles language', () => {
  const session = createSession({ views: ['oblique', 'left'], lang: 'en' });
  const modelState = { atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1 };
  assert.equal(session.assemble(modelState).lang, 'en');

  session.setLang('fr');
  assert.equal(session.assemble(modelState).lang, 'fr');

  session.setLang('invalid');
  assert.equal(session.assemble(modelState).lang, 'en');
});

test('session notifies in French when in French mode', () => {
  const session = createSession({ views: ['oblique'], lang: 'fr' });
  const modelState = { atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1 };
  session.failSwitch('Destrieux', new Error('boom'));
  assert.match(session.assemble(modelState).notice, /Impossible de charger/);
});

test('url-state encodes and decodes lang', () => {
  const stateEn = {
    atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1,
    surfaceColor: 'tissue', view: 'oblique', selectedRegion: null, isolatedRegion: null,
    lang: 'en',
  };
  // Default lang is omitted to keep URLs clean
  assert.equal(encodeState(stateEn), 'atlas=destrieux');

  const stateFr = { ...stateEn, lang: 'fr' };
  assert.equal(encodeState(stateFr), 'atlas=destrieux&lang=fr');

  assert.equal(decodeState('#atlas=destrieux&lang=fr').lang, 'fr');
  assert.equal(decodeState('#atlas=destrieux&lang=en').lang, 'en');
  assert.equal(decodeState('#atlas=destrieux&lang=unknown').lang, undefined);
});

test('count formats plural nouns in French correctly', () => {
  assert.equal(count(0, 'region', 'fr'), '0 régions');
  assert.equal(count(1, 'region', 'fr'), '1 région');
  assert.equal(count(2, 'region', 'fr'), '2 régions');
  assert.equal(count(183, 'region', 'fr'), '183 régions');
  assert.equal(count(1, 'match', 'fr'), '1 correspondance');
  assert.equal(count(5, 'match', 'fr'), '5 correspondances');
});

test('edgeLabels returns French anatomical orientation letters', () => {
  const camera = new PerspectiveCamera(35, 1.6, 0.001, 10);
  camera.up.set(0, 1, 0);
  // Anterior view: facing the subject
  camera.position.set(0, 0, -0.5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  const enEdges = edgeLabels(camera, 'en');
  assert.equal(enEdges.right, 'L');
  assert.equal(enEdges.left, 'R');

  const frEdges = edgeLabels(camera, 'fr');
  assert.equal(frEdges.right, 'G'); // Gauche
  assert.equal(frEdges.left, 'D');  // Droite
  assert.equal(frEdges.top, 'S');   // Supérieur
  assert.equal(frEdges.bottom, 'I'); // Inférieur
});

test('translations dictionary returns valid sections and falls back safely', () => {
  assert.ok(t('fr', 'header').languageSwitch === 'Langue');
  assert.ok(t('en', 'header').languageSwitch === 'Language');
  assert.ok(t('unknown', 'header').languageSwitch === 'Language');
});

test('UI actions and shortcuts are fully translated in English and French', () => {
  for (const lang of ['en', 'fr']) {
    const header = t(lang, 'header');
    assert.ok(header.share);
    assert.ok(header.linkCopied);

    const nav = t(lang, 'navigator');
    assert.ok(nav.clearSearch);

    const insp = t(lang, 'inspector');
    assert.ok(insp.centroid);

    const vp = t(lang, 'viewport');
    assert.ok(vp.snapshot);

    const shortcuts = t(lang, 'shortcuts');
    const keys = shortcuts.items.map(([k]) => k);
    for (const expectedKey of ['F', 'I', 'M', 'C', 'S', 'H', '0', '1 – 6', '/', 'Esc']) {
      assert.ok(keys.includes(expectedKey), `Missing shortcut ${expectedKey} in ${lang}`);
    }
  }
});

test('the colophon and slice note name whichever brain was actually built', () => {
  // The viewer publishes one model at a time and must describe that one. A
  // sentence hardcoded to a subject outlives the build that made it true.
  const subject = { subject: 'bert', display_name: 'FreeSurfer “bert”', individual: true };
  const template = { subject: 'fsaverage', display_name: 'FreeSurfer fsaverage', individual: false };

  for (const lang of ['en', 'fr']) {
    const { colophon } = t(lang, 'footer');
    assert.match(colophon(subject), /bert/);
    assert.match(colophon(template), /fsaverage/);
    assert.notEqual(colophon(subject), colophon(template));
    // Neither description may survive into the other brain's colophon.
    assert.doesNotMatch(colophon(template), /bert/);

    const { note } = t(lang, 'mpr');
    assert.match(note(subject), /1 mm/);
    assert.notEqual(note(subject), note(template));
  }

  assert.notEqual(t('en', 'footer').colophon(subject), t('fr', 'footer').colophon(subject));
});

/**
 * A duplicate key in an object literal is not an error in JavaScript: the
 * later one simply wins. Adding a second `mpr` block beside the first silently
 * removed every string in it, and only an unrelated assertion caught it.
 */
test('no translation block is declared twice', async () => {
  const source = await readFile(new URL('./translations.js', import.meta.url), 'utf8');
  const offences = [];
  for (const lang of ['en', 'fr']) {
    // Blocks are declared at a fixed indent inside each language.
    const start = source.indexOf(`\n  ${lang}: {`);
    assert.ok(start > -1, `${lang} block not found`);
    const next = source.indexOf('\n  },', start);
    const block = source.slice(start, next);
    const seen = new Set();
    for (const [, key] of block.matchAll(/^ {4}(\w+): \{/gm)) {
      if (seen.has(key)) offences.push(`${lang}.${key} is declared more than once`);
      seen.add(key);
    }
  }
  assert.deepEqual(offences, []);
});

test('every English string has a French counterpart', () => {
  const paths = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? paths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]);

  const en = paths(TRANSLATIONS.en);
  const fr = paths(TRANSLATIONS.fr);
  assert.deepEqual(en.filter(key => !fr.includes(key)), [], 'missing French strings');
  assert.deepEqual(fr.filter(key => !en.includes(key)), [], 'French strings with no English');
});
