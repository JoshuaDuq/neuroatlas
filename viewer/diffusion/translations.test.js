import assert from 'node:assert/strict';
import test from 'node:test';
import { AssetError } from '../model/published-assets.js';
import { diffusionError, diffusionErrorCode, mriReadout } from './translations.js';
import { DiffusionInputError } from './validation.js';

test('a diffusion failure is worded from its code, in both languages, never from its English message', () => {
  const failures = [
    [new AssetError('asset-fetch', 'Asset request failed: HTTP 503', { status: 503 }), 'asset-fetch'],
    [new AssetError('asset-updated', 'Published file changed'), 'asset-updated'],
    [new DiffusionInputError('units', 'The NIfTI spatial units must explicitly be millimeters.'), 'invalid-data'],
    [new RangeError('Brain opacity must be between 0 and 1.'), 'failed'],
  ];
  for (const [error, code] of failures) {
    assert.equal(diffusionErrorCode(error), code);
    for (const lang of ['en', 'fr']) {
      const text = diffusionError(lang, error);
      assert.ok(text && !text.includes(error.message), `${lang} ${code}`);
    }
  }
  assert.notEqual(diffusionError('en', failures[0][0]), diffusionError('fr', failures[0][0]));
});

test('the tract MRI readout writes its point as the linked MRI does: signed, one decimal, a true minus', () => {
  assert.equal(mriReadout([7.446, -23.539, 46.64], 340.552, 0.5123, 'en'),
    'RAS:\u00a0+7.4, \u221223.5, +46.6\u202fmm · T1:\u00a0341 · FA:\u00a00.51');
  assert.equal(mriReadout([7.446, -23.539, 46.64], 340.552, 0.5123, 'fr'),
    'RAS\u202f:\u00a0+7,4\u202f; \u221223,5\u202f; +46,6\u202fmm · T1\u202f:\u00a0341 · FA\u202f:\u00a00,51');
  assert.match(mriReadout([0, 0, 0], Number.NaN, 0, 'en'), /T1:\u00a0—/);
});
