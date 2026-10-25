import assert from 'node:assert/strict';
import { test } from 'vitest';
import { AssetError } from '../assets/published-assets.ts';
import { diffusionError } from '../i18n/diffusion.ts';
import { isIndependentTractReference } from './presentation.ts';
import { DiffusionInputError, diffusionErrorCode, validateVolume } from './validation.ts';

const volume = () => ({
  hdr: {
    dims: [3, 2, 2, 2, 1, 1, 1, 1],
    pixDims: [1, 1, 1, 1, 0, 0, 0, 0],
    datatypeCode: 16,
    xyzt_units: 2,
    sform_code: 1,
    qform_code: 0,
    affine: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  img: new Float32Array(8),
});

test('accepts spatially defined scalar maps and rejects raw diffusion acquisitions', () => {
  assert.doesNotThrow(() => validateVolume(volume()));
  const raw = volume();
  raw.hdr.dims[0] = 4;
  raw.hdr.dims[4] = 64;
  assert.throws(() => validateVolume(raw), /three-dimensional/);
  const vector = volume();
  vector.hdr.datatypeCode = 128;
  assert.throws(() => validateVolume(vector), /scalar/);
});

test('requires explicit usable spatial metadata rather than guessing coordinates', () => {
  const changes: ((hdr: ReturnType<typeof volume>['hdr']) => void)[] = [
    (hdr) => {
      hdr.xyzt_units = 0;
    },
    (hdr) => {
      hdr.sform_code = 0;
    },
    (hdr) => {
      hdr.affine[0][0] = NaN;
    },
    (hdr) => {
      hdr.affine[0][0] = 0;
    },
    (hdr) => {
      hdr.pixDims[2] = 0;
    },
    (hdr) => {
      hdr.dims[2] = -1;
    },
  ];
  for (const change of changes) {
    const invalid = volume();
    change(invalid.hdr);
    assert.throws(() => validateVolume(invalid), DiffusionInputError);
  }
  assert.throws(
    () => validateVolume({ hdr: volume().hdr, img: new Float32Array(0) }),
    /no readable/,
  );
});

// diffusion/translations.test.js:15, with the wording assertions on C1's `diffusionError`.
test('a diffusion failure is worded from its code, in both languages, never from its English message', () => {
  const failures: [Error, string][] = [
    [
      new AssetError('asset-fetch', 'Asset request failed: HTTP 503', { status: 503 }),
      'asset-fetch',
    ],
    [new AssetError('asset-updated', 'Published file changed'), 'asset-updated'],
    [
      new DiffusionInputError('units', 'The NIfTI spatial units must explicitly be millimeters.'),
      'invalid-data',
    ],
    [new RangeError('Brain opacity must be between 0 and 1.'), 'failed'],
  ];
  for (const [error, code] of failures) {
    assert.equal(diffusionErrorCode(error), code);
    for (const lang of ['en', 'fr']) {
      const text = diffusionError(lang, diffusionErrorCode(error));
      assert.ok(text && !text.includes(error.message), `${lang} ${code}`);
    }
  }
  assert.notEqual(
    diffusionError('en', diffusionErrorCode(failures[0][0])),
    diffusionError('fr', diffusionErrorCode(failures[0][0])),
  );
});

test('only a tract exploration of another subject than the anatomy’s is independent', () => {
  assert.equal(isIndependentTractReference({ explorer: 'anatomy' }), false);
  assert.equal(
    isIndependentTractReference({
      explorer: 'diffusion',
      anatomy: 'cdmd',
      referenceAnatomy: 'cdmd',
    }),
    false,
  );
  assert.equal(
    isIndependentTractReference({
      explorer: 'diffusion',
      anatomy: 'aomic',
      referenceAnatomy: 'cdmd',
    }),
    true,
  );
  assert.throws(
    () => isIndependentTractReference({ explorer: 'diffusion', anatomy: 'cdmd' }),
    /identify the anatomy/,
  );
});
