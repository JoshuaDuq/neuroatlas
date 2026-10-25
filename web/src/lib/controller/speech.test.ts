// The announcer's sentences for a scripted sequence, read off viewer/app.js:1658-1693.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../types/index.ts';
import { createSpeech } from './speech.ts';
import type { SpeechView } from './speech.ts';

const region = (hemisphere: 'left' | 'right') => ({ id: 'r', hemisphere }) as Region;
const base: SpeechView = {
  lang: 'en',
  selectedRegion: null,
  hiddenRegions: new Set(),
  notice: null,
  status: 'ready',
};
const speech = () => createSpeech(() => 'Precentral gyrus');

test('the first view says nothing; a selection says its name and side, once', () => {
  const next = speech().next;
  assert.deepEqual(next(base), []);
  const selected = { ...base, selectedRegion: region('left') };
  assert.deepEqual(next(selected), ['Selected: Precentral gyrus, left']);
  assert.deepEqual(next(selected), []);
});

test('clearing the selection says an empty sentence, as the legacy announcer did', () => {
  const { next } = speech();
  next({ ...base, selectedRegion: region('right') });
  assert.deepEqual(next(base), ['']);
});

test('a notice outranks the selection it accompanies, and is said once', () => {
  const { next } = speech();
  const notice = { text: 'Internal anatomy is hidden' };
  const view = { ...base, selectedRegion: region('left'), notice };
  assert.deepEqual(next(view), ['Internal anatomy is hidden']);
  assert.deepEqual(next(view), []);
  assert.deepEqual(next({ ...view, selectedRegion: region('right') }), [
    'Selected: Precentral gyrus, right',
  ]);
});

test('a changed count of hidden parts joins the sentence, and stands alone when nothing else is said', () => {
  const { next } = speech();
  next(base);
  const hidden = { ...base, hiddenRegions: new Set(['a', 'b']) };
  assert.deepEqual(next(hidden), ['2 parts hidden']);
  assert.deepEqual(next(hidden), []);
  assert.deepEqual(
    next({ ...hidden, selectedRegion: region('left'), hiddenRegions: new Set(['a']) }),
    ['Selected: Precentral gyrus, left. 1 part hidden'],
  );
  assert.deepEqual(next({ ...base, selectedRegion: region('left'), notice: { text: 'Done.' } }), [
    'Done. All parts shown',
  ]);
});

test('a lost context is said once after any other sentence, and the restore when it is ready again', () => {
  const { next } = speech();
  next(base);
  const lost = { ...base, status: 'context-lost' as const };
  assert.deepEqual(next(lost), ['The 3D view was interrupted by the graphics driver. Restoring…']);
  assert.deepEqual(next(lost), []);
  assert.deepEqual(next(base), ['Anatomy loaded.']);
  assert.deepEqual(next(base), []);
});

test('French sentences follow the view’s language', () => {
  const { next } = speech();
  next({ ...base, lang: 'fr' });
  assert.deepEqual(next({ ...base, lang: 'fr', selectedRegion: region('right') }), [
    'Sélectionné : Precentral gyrus, droite',
  ]);
});
