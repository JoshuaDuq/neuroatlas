/// <reference types="node" />
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
