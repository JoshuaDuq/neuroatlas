import assert from 'node:assert/strict';
import { test } from 'vitest';
import { diffusionError, mriReadout } from './diffusion.ts';

test('a diffusion failure is worded from its code, in both languages', () => {
  for (const code of ['asset-fetch', 'asset-updated', 'invalid-data', 'failed'] as const) {
    for (const lang of ['en', 'fr']) assert.ok(diffusionError(lang, code), `${lang} ${code}`);
    assert.notEqual(diffusionError('en', code), diffusionError('fr', code));
  }
});

test('the tract MRI readout writes its point as the linked MRI does: signed, one decimal, a true minus', () => {
  assert.equal(
    mriReadout([7.446, -23.539, 46.64], 340.552, 0.5123, 'en'),
    'RAS:\u00a0+7.4, \u221223.5, +46.6\u202fmm · T1:\u00a0341 · FA:\u00a00.51',
  );
  assert.equal(
    mriReadout([7.446, -23.539, 46.64], 340.552, 0.5123, 'fr'),
    'RAS\u202f:\u00a0+7,4\u202f; \u221223,5\u202f; +46,6\u202fmm · T1\u202f:\u00a0341 · FA\u202f:\u00a00,51',
  );
  assert.match(mriReadout([0, 0, 0], Number.NaN, 0, 'en'), /T1:\u00a0—/);
  assert.doesNotMatch(mriReadout([0, 0, 0], 1, undefined, 'en'), /FA/);
});

test('I18N-21 · a diffusion failure is worded from its code and never with the error message', () => {
  const words = {
    en: {
      'asset-fetch':
        'The reference data could not be downloaded. Check the connection, then try again.',
      'asset-updated':
        'Planum was updated while this page was open. Reload the page to load the new data.',
      'invalid-data': 'The reference data could not be read.',
      failed: 'The reference data could not be displayed.',
    },
    fr: {
      'asset-fetch':
        'Les données de référence n’ont pas pu être téléchargées. Vérifiez la connexion, puis réessayez.',
      'asset-updated':
        'Planum a été mis à jour pendant que cette page était ouverte. Rechargez la page pour charger les nouvelles données.',
      'invalid-data': 'Les données de référence n’ont pas pu être lues.',
      failed: 'Les données de référence n’ont pas pu être affichées.',
    },
  } as const;
  for (const lang of ['en', 'fr'] as const) {
    for (const [code, text] of Object.entries(words[lang])) {
      assert.equal(diffusionError(lang, code as keyof (typeof words)['en']), text);
    }
  }
});

test('I18N-22 · the tract MRI readout holds each label to its value', () => {
  assert.equal(
    mriReadout([-1, 2, 3], 10, 0.5, 'en'),
    'RAS: −1.0, +2.0, +3.0 mm · T1: 10 · FA: 0.50',
  );
});
