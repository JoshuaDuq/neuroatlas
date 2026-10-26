import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
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

describe('CAT-62 · a diffusion map must be a 3D scalar volume in millimetres', () => {
  const rejected: [string, (v: ReturnType<typeof volume>) => unknown, string, string][] = [];
  const add = (
    name: string,
    mutate: (v: ReturnType<typeof volume>) => unknown,
    code: string,
    message: string,
  ) => rejected.push([name, mutate, code, message]);
  const EMPTY = 'The volume contains no readable image data.';
  const DIMENSIONS = 'Use a three-dimensional map, not a raw 4D acquisition.';
  const SCALAR = 'Use a scalar map rather than a vector or RGB image.';
  const UNITS = 'The NIfTI spatial units must explicitly be millimeters.';
  const TRANSFORM = 'The NIfTI needs a valid spatial transform.';
  const SPACING = 'The NIfTI needs a valid spatial transform and voxel spacing.';

  add('no header', (v) => ((v as { hdr?: unknown }).hdr = undefined), 'empty', EMPTY);
  add('no image', (v) => ((v as { img?: unknown }).img = undefined), 'empty', EMPTY);
  add('an empty image', (v) => ((v as { img?: unknown }).img = []), 'empty', EMPTY);
  add('a header of only two dimensions', (v) => (v.hdr.dims[0] = 2), 'dimensions', DIMENSIONS);
  for (const slot of [4, 5, 6, 7]) {
    add(
      `a size of 2 in dimension ${slot}`,
      (v) => (v.hdr.dims[slot] = 2),
      'dimensions',
      DIMENSIONS,
    );
  }
  for (const size of [0, -1, 1.5, NaN]) {
    add(`a spatial size of ${size}`, (v) => (v.hdr.dims[2] = size), 'dimensions', DIMENSIONS);
  }
  for (const type of [128, 0, 32, 1024]) {
    add(`datatype ${type}`, (v) => (v.hdr.datatypeCode = type), 'scalar', SCALAR);
  }
  for (const units of [0, 1, 3, 4, 6, 7]) {
    add(`spatial units ${units}`, (v) => (v.hdr.xyzt_units = units), 'units', UNITS);
  }
  add('no transform code', (v) => (v.hdr.sform_code = 0), 'transform', TRANSFORM);
  add(
    'no affine',
    (v) => ((v.hdr as { affine?: unknown }).affine = undefined),
    'transform',
    TRANSFORM,
  );
  add('an affine of three rows', (v) => v.hdr.affine.pop(), 'transform', TRANSFORM);
  add(
    'an affine row of three values',
    (v) => ((v.hdr.affine as number[][])[1] = [0, 1, 0]),
    'transform',
    TRANSFORM,
  );
  for (const value of [NaN, Infinity]) {
    add(`an affine value of ${value}`, (v) => (v.hdr.affine[0][1] = value), 'transform', TRANSFORM);
  }
  add('a singular affine', (v) => (v.hdr.affine[0][0] = 0), 'transform', SPACING);
  add('a last row of 0 0 0 2', (v) => (v.hdr.affine[3][3] = 2), 'transform', SPACING);
  add('a last row of 1 0 0 1', (v) => (v.hdr.affine[3][0] = 1), 'transform', SPACING);
  for (const size of [0, -1, NaN, Infinity]) {
    add(`a voxel spacing of ${size}`, (v) => (v.hdr.pixDims[2] = size), 'transform', SPACING);
  }

  for (const [name, mutate, code, message] of rejected) {
    test(`CAT-62 · refuses ${name}`, () => {
      const invalid = volume();
      mutate(invalid);
      assert.throws(
        () => validateVolume(invalid),
        (error: DiffusionInputError) => {
          assert.equal(error.name, 'DiffusionInputError');
          assert.equal(error.code, code);
          assert.equal(error.message, message);
          assert.ok(error instanceof Error);
          return true;
        },
      );
    });
  }

  test('CAT-62 · accepts an oblique affine, either transform code and any spatial unit with millimetre bits', () => {
    const oblique = volume();
    oblique.hdr.affine = [
      [0.5, 0.1, 0, 3],
      [-0.1, 0.5, 0, 4],
      [0, 0, 2, 5],
      [0, 0, 0, 1],
    ];
    assert.doesNotThrow(() => validateVolume(oblique));
    const qform = volume();
    Object.assign(qform.hdr, { sform_code: 0, qform_code: 1 });
    assert.doesNotThrow(() => validateVolume(qform));
    for (const units of [10, 18, 34]) {
      const withTime = volume();
      withTime.hdr.xyzt_units = units;
      assert.doesNotThrow(() => validateVolume(withTime), String(units));
    }
    for (const type of [2, 4, 8, 16, 64, 256, 512, 768]) {
      const scalar = volume();
      scalar.hdr.datatypeCode = type;
      assert.doesNotThrow(() => validateVolume(scalar), String(type));
    }
  });
});

test('CAT-63 · a tracts failure is shown by one of four codes', () => {
  const withCode = (code: unknown) => ({ code });
  const cases: [unknown, string][] = [
    [withCode('asset-fetch'), 'asset-fetch'],
    [Object.assign(new Error('x'), { code: 'asset-fetch' }), 'asset-fetch'],
    [withCode('asset-updated'), 'asset-updated'],
    [new AssetError('asset-updated', 'x'), 'asset-updated'],
    [new DiffusionInputError('empty', 'x'), 'invalid-data'],
    [new RangeError('x'), 'failed'],
    [new Error('x'), 'failed'],
    [null, 'failed'],
    [undefined, 'failed'],
    ['asset-fetch', 'failed'],
    ...['empty', 'other', 3, null, undefined].map((code): [unknown, string] => [
      withCode(code),
      'failed',
    ]),
  ];
  for (const [error, expected] of cases) assert.equal(diffusionErrorCode(error), expected);
});

test('CAT-64 · an explorer other than diffusion is never an independent reference, whatever the subjects', () => {
  for (const explorer of ['anatomy', 'functions', 'deficits', 'circuits'] as const) {
    for (const anatomy of ['cdmd', 'aomic', '', null, undefined]) {
      assert.equal(
        isIndependentTractReference({ explorer, anatomy, referenceAnatomy: 'cdmd' }),
        false,
      );
    }
  }
});

test('CAT-64 · tract exploration with the anatomy or the reference missing or empty fails', () => {
  for (const missing of ['', null, undefined]) {
    for (const state of [
      { explorer: 'diffusion' as const, anatomy: missing, referenceAnatomy: 'cdmd' },
      { explorer: 'diffusion' as const, anatomy: 'cdmd', referenceAnatomy: missing },
    ]) {
      assert.throws(() => isIndependentTractReference(state), {
        message: 'Tract exploration must identify the anatomy and reference subject.',
      });
    }
  }
});
