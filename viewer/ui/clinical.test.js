import assert from 'node:assert/strict';
import test from 'node:test';
import { stageMessage } from './clinical.js';
import { CLINICAL_TEXT } from '../clinical/translations.js';

const idle = { opening: false, busy: 'loading', error: null, failure: null, restored: false };

test('an opened deficit says what it did to the scene until the view is restored', () => {
  for (const lang of ['en', 'fr']) {
    const text = CLINICAL_TEXT[lang];
    assert.equal(stageMessage(text, idle), text.stageShown);
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
