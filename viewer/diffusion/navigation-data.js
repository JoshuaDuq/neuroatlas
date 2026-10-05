import { streamlineLengths } from './streamlines.js';

export function sourceVoxelPoint(voxel, header) {
  if (voxel.length !== 3 || voxel.some((value, axis) => !Number.isInteger(value)
    || value < 0 || value >= header.dims[axis + 1])) {
    throw new RangeError('Choose a zero-based source voxel inside the MRI grid.');
  }
  return header.affine.slice(0, 3).map(row =>
    row[0] * voxel[0] + row[1] * voxel[1] + row[2] * voxel[2] + row[3]);
}

export function configureNavigationTract(mesh, minimum) {
  if (!Number.isFinite(minimum) || minimum < 0) throw new RangeError('Invalid minimum tract length.');
  mesh.fiberRadius = 0;
  mesh.fiberDither = 0;
  mesh.fiberColor = 'Local';
  mesh.fiberDecimationStride = 1;
  mesh.fiberLength = minimum;
  // NiiVue normally stores rounded Uint32 lengths; retain the source precision.
  mesh.fiberLengths = streamlineLengths(mesh.pts, mesh.offsetPt0);
}
