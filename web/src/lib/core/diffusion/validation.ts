import type { DiffusionErrorCode } from '../i18n/diffusion.ts';

const SCALAR_TYPES = new Set([2, 4, 8, 16, 64, 256, 512, 768]);

export type DiffusionInputCode = 'empty' | 'dimensions' | 'scalar' | 'units' | 'transform';

export class DiffusionInputError extends Error {
  code: DiffusionInputCode;

  constructor(code: DiffusionInputCode, message: string) {
    super(message);
    this.name = 'DiffusionInputError';
    this.code = code;
  }
}

/** The NIfTI header and voxels of a volume as Niivue reads them. */
export interface DiffusionVolume {
  hdr?: {
    dims: readonly number[];
    datatypeCode: number;
    xyzt_units: number;
    sform_code: number;
    qform_code: number;
    affine: readonly (readonly number[])[];
    pixDims: readonly number[];
  };
  img?: ArrayLike<number>;
}

export function validateVolume(volume: DiffusionVolume | null | undefined): void {
  const header = volume?.hdr;
  if (!header || !volume.img?.length) {
    throw new DiffusionInputError('empty', 'The volume contains no readable image data.');
  }
  const dimensions = header.dims.slice(1, 4);
  if (
    header.dims[0] < 3 ||
    header.dims.slice(4).some((size) => size > 1) ||
    dimensions.some((size) => !Number.isInteger(size) || size < 1)
  ) {
    throw new DiffusionInputError(
      'dimensions',
      'Use a three-dimensional map, not a raw 4D acquisition.',
    );
  }
  if (!SCALAR_TYPES.has(header.datatypeCode)) {
    throw new DiffusionInputError('scalar', 'Use a scalar map rather than a vector or RGB image.');
  }
  if ((header.xyzt_units & 7) !== 2) {
    throw new DiffusionInputError(
      'units',
      'The NIfTI spatial units must explicitly be millimeters.',
    );
  }
  const affine = header.affine;
  if (
    !(header.sform_code > 0 || header.qform_code > 0) ||
    !Array.isArray(affine as unknown) ||
    affine.length !== 4 ||
    affine.some((row) => row.length !== 4 || row.some((value) => !Number.isFinite(value)))
  ) {
    throw new DiffusionInputError('transform', 'The NIfTI needs a valid spatial transform.');
  }
  const [a, b, c] = affine;
  const determinant =
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);
  if (
    Math.abs(determinant) < 1e-12 ||
    affine[3].some((value, index) => value !== (index === 3 ? 1 : 0)) ||
    header.pixDims.slice(1, 4).some((size) => !Number.isFinite(size) || size <= 0)
  ) {
    throw new DiffusionInputError(
      'transform',
      'The NIfTI needs a valid spatial transform and voxel spacing.',
    );
  }
}

/** The stable code a diffusion-panel failure is shown by; the English detail stays in the console. */
export function diffusionErrorCode(error: unknown): DiffusionErrorCode {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (code === 'asset-fetch' || code === 'asset-updated') return code;
  return error instanceof DiffusionInputError ? 'invalid-data' : 'failed';
}
