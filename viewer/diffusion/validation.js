const SCALAR_TYPES = new Set([2, 4, 8, 16, 64, 256, 512, 768]);

export class DiffusionInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DiffusionInputError';
    this.code = code;
  }
}

export function validateVolume(volume) {
  const header = volume?.hdr;
  if (!header || !volume.img?.length) {
    throw new DiffusionInputError('empty', 'The volume contains no readable image data.');
  }
  const dimensions = header.dims.slice(1, 4);
  if (header.dims[0] < 3 || header.dims.slice(4).some(size => size > 1)
    || dimensions.some(size => !Number.isInteger(size) || size < 1)) {
    throw new DiffusionInputError('dimensions', 'Use a three-dimensional map, not a raw 4D acquisition.');
  }
  if (!SCALAR_TYPES.has(header.datatypeCode)) {
    throw new DiffusionInputError('scalar', 'Use a scalar map rather than a vector or RGB image.');
  }
  if ((header.xyzt_units & 7) !== 2) {
    throw new DiffusionInputError('units', 'The NIfTI spatial units must explicitly be millimeters.');
  }
  const affine = header.affine;
  if (!(header.sform_code > 0 || header.qform_code > 0)
    || !Array.isArray(affine) || affine.length !== 4
    || affine.some(row => row.length !== 4 || row.some(value => !Number.isFinite(value)))) {
    throw new DiffusionInputError('transform', 'The NIfTI needs a valid spatial transform.');
  }
  const [a, b, c] = affine;
  const determinant = a[0] * (b[1] * c[2] - b[2] * c[1])
    - a[1] * (b[0] * c[2] - b[2] * c[0])
    + a[2] * (b[0] * c[1] - b[1] * c[0]);
  if (Math.abs(determinant) < 1e-12
    || affine[3].some((value, index) => value !== (index === 3 ? 1 : 0))
    || header.pixDims.slice(1, 4).some(size => !Number.isFinite(size) || size <= 0)) {
    throw new DiffusionInputError('transform', 'The NIfTI needs a valid spatial transform and voxel spacing.');
  }
}
