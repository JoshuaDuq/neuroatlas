import type { NVMesh, NiftiHeader } from '@niivue/niivue';
import { Matrix4, Vector3 } from 'three';
import { streamlineLengths } from './streamlines.ts';

/** The part of a NIfTI header the navigation reads. */
export type NavigationHeader = Pick<NiftiHeader, 'dims' | 'affine'>;

export function sourceVoxelPoint(voxel: readonly number[], header: NavigationHeader): number[] {
  if (
    voxel.length !== 3 ||
    voxel.some(
      (value, axis) => !Number.isInteger(value) || value < 0 || value >= header.dims[axis + 1]!,
    )
  ) {
    throw new RangeError('Choose a zero-based source voxel inside the MRI grid.');
  }
  return header.affine
    .slice(0, 3)
    .map((row) => row[0]! * voxel[0]! + row[1]! * voxel[1]! + row[2]! * voxel[2]! + row[3]!);
}

/** The nearest source voxel to a scanner RAS point, or null when the point lies outside the grid. */
export function scannerVoxel(point: readonly number[], header: NavigationHeader): number[] | null {
  if (point.length !== 3 || !point.every(Number.isFinite)) {
    throw new RangeError('A scanner point needs three finite RAS values.');
  }
  const inverse = new Matrix4()
    .set(...(header.affine.flat() as Parameters<Matrix4['set']>))
    .invert();
  const voxel = new Vector3(point[0], point[1], point[2])
    .applyMatrix4(inverse)
    .toArray()
    .map(Math.round);
  return voxel.every((value, axis) => value >= 0 && value < header.dims[axis + 1]!) ? voxel : null;
}

/** The fields of NiiVue's tractography mesh that the navigator sets. */
export type NavigationTract = Pick<
  NVMesh,
  | 'pts'
  | 'offsetPt0'
  | 'fiberRadius'
  | 'fiberDither'
  | 'fiberColor'
  | 'fiberDecimationStride'
  | 'fiberLength'
> & { fiberLengths?: Uint32Array | Float64Array };

export function configureNavigationTract(
  mesh: NavigationTract,
  minimum: number,
  lengths: Float64Array = streamlineLengths(mesh.pts, mesh.offsetPt0!),
): void {
  // NiiVue skips rebuilding fibers at a zero minimum, which would leave the previous filter drawn.
  if (!Number.isFinite(minimum) || minimum < 1) {
    throw new RangeError('Minimum tract length must be at least 1 mm.');
  }
  mesh.fiberRadius = 0;
  mesh.fiberDither = 0;
  mesh.fiberColor = 'Local';
  mesh.fiberDecimationStride = 1;
  mesh.fiberLength = minimum;
  // NiiVue normally stores rounded Uint32 lengths; retain the source precision.
  mesh.fiberLengths = lengths;
}
