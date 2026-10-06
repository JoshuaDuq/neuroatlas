import assert from 'node:assert/strict';
import test from 'node:test';
import { sharedSide, sideStated, stageMessage, stageStatus } from './clinical.js';
import { CLINICAL_TEXT } from '../clinical/translations.js';

const idle = { opening: false, busy: 'loading', error: null, failure: null, restored: false, status: 'shown' };

test('an opened deficit says what the stage shows until the view is restored', () => {
  for (const lang of ['en', 'fr']) {
    const text = CLINICAL_TEXT[lang];
    assert.equal(stageMessage(text, idle), 'shown');
    assert.equal(stageMessage(text, { ...idle, restored: true }), text.stageRestored);
  }
});

test('work in progress names itself: opening anatomy, or restoring the view', () => {
  const text = CLINICAL_TEXT.en;
  assert.equal(stageMessage(text, { ...idle, opening: true }), text.loading);
  assert.equal(stageMessage(text, { ...idle, opening: true, busy: 'restoring', restored: true }), text.restoring);
});

test('a failed restore is said in the reader’s language; other failures keep their message', () => {
  const error = new Error('Unknown clinical region: x');
  assert.equal(stageMessage(CLINICAL_TEXT.fr, { ...idle, error, failure: 'restoreFailed' }),
    CLINICAL_TEXT.fr.restoreFailed);
  assert.equal(stageMessage(CLINICAL_TEXT.en, { ...idle, error }), error.message);
});

const read = said => said.replaceAll('\u00a0', ' ');

test('the stage status counts the outlined regions and names their atlases; what opening reset is its own line', () => {
  const view = { shown: 7, total: 7, atlases: ['Destrieux'], outlined: true, cleared: true };
  assert.equal(read(stageStatus(CLINICAL_TEXT.en, { ...view, lang: 'en' })),
    '7 mapped regions outlined · Destrieux\nCut and isolation cleared.');
  assert.equal(read(stageStatus(CLINICAL_TEXT.fr, { ...view, lang: 'fr' })),
    '7 régions associées entourées · Destrieux\nCoupe et isolement retirés.');
  assert.equal(read(stageStatus(CLINICAL_TEXT.en, { ...view, shown: 1, total: 1, atlases: ['FreeSurfer aseg'], lang: 'en' })),
    '1 mapped region outlined · FreeSurfer aseg\nCut and isolation cleared.');
});

test('a partly drawn mapping, two atlases, an isolation or a later cut are said as they are', () => {
  assert.equal(read(stageStatus(CLINICAL_TEXT.en,
    { shown: 6, total: 7, atlases: ['Destrieux'], outlined: true, cleared: false, lang: 'en' })),
  '6 of 7 mapped regions outlined · Destrieux');
  // A cut turns the outlines off, so the regions are only said to be visible.
  assert.equal(read(stageStatus(CLINICAL_TEXT.en,
    { shown: 5, total: 8, atlases: ['Destrieux', 'Teaching set'], outlined: false, cleared: false, lang: 'en' })),
  '5 of 8 mapped regions visible · Destrieux and Teaching set');
  assert.equal(read(stageStatus(CLINICAL_TEXT.fr,
    { shown: 5, total: 8, atlases: ['Destrieux', 'Ensemble pédagogique'], outlined: false, cleared: false, lang: 'fr' })),
  '5 sur 8 régions associées visibles · Destrieux et Ensemble pédagogique');
  assert.equal(read(stageStatus(CLINICAL_TEXT.en, { shown: 0, total: 3, atlases: [], outlined: true, cleared: true, lang: 'en' })),
    '0 of 3 mapped regions outlined\nCut and isolation cleared.');
});

test('a wrapped count line breaks only before a separator, never leaving one at a line end', () => {
  for (const lang of ['en', 'fr']) {
    const said = stageStatus(CLINICAL_TEXT[lang],
      { shown: 5, total: 8, atlases: ['Destrieux', 'Teaching set'], outlined: true, cleared: true, lang });
    const [count, cleared] = said.split('\n');
    assert.equal(count.split(' ').length, 2, count);
    for (const space of count.matchAll(/ /g)) assert.equal(count[space.index + 1], '·', count);
    assert.equal(cleared, CLINICAL_TEXT[lang].cleared);
  }
});

test('region links drop the side their association already states, and keep it when sides differ', () => {
  assert.equal(sideStated('left', ['left', 'left']), true);
  assert.equal(sideStated('right', ['right']), true);
  assert.equal(sideStated('bilateral', ['left', 'right']), false);
  assert.equal(sideStated('left', ['left', 'right']), false);
  assert.equal(sideStated('left', ['midline']), false);
  assert.equal(sideStated('left', []), false);
});

test('a profile whose findings all share one side states it once; mixed sides stay on each finding', () => {
  assert.equal(sharedSide(['left', 'left', 'left', 'left', 'left', 'left']), 'left');
  assert.equal(sharedSide(['right']), 'right');
  assert.equal(sharedSide(['bilateral', 'bilateral']), 'bilateral');
  assert.equal(sharedSide(['left', 'right']), null);
  assert.equal(sharedSide(['left', 'bilateral', 'left']), null);
  assert.equal(sharedSide([]), null);
});
