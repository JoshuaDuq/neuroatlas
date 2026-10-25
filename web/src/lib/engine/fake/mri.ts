import type { MriLocation, MriNavigator, MriPlaneChoice, Vec3 } from '../api.ts';

const PLANES: readonly MriPlaneChoice[] = ['MULTIPLANAR', 'AXIAL', 'CORONAL', 'SAGITTAL', 'RENDER'];

/** A small scan: 8 × 9 × 10 voxels of 2 mm, `dims`/`pixDims` laid out like a NIfTI header (index 0 is the rank). */
const HEADER = { dims: [3, 8, 9, 10], pixDims: [1, 2, 2, 2] } as const;
const SPACING_MM = 2;

export interface FakeMriNavigator extends MriNavigator {
  readonly disposed: boolean;
  /** The bundle ids last passed to `syncTracts`. */
  readonly synced: readonly string[];
  /** The plane layout the reader last chose. */
  readonly plane: MriPlaneChoice;
}

/**
 * In-memory stand-in for the NiiVue navigator (diffusion/navigation-viewer.js): the voxel, plane and window
 * are real state with the real validation and every move reports a location; nothing is drawn.
 * `values` are two synthetic maps, mean diffusivity and FA, as the published catalog has.
 */
export function createFakeMriNavigator(
  onLocation: (location: MriLocation) => void,
  loadTract: (id: string) => Promise<void>,
): FakeMriNavigator {
  let disposed = false;
  let plane: MriPlaneChoice = 'MULTIPLANAR';
  let voxel: Vec3 = [0, 0, 0];
  let synced: readonly string[] = [];

  const inside = (point: readonly number[]) =>
    point.every(
      (value, axis) => Number.isInteger(value) && value >= 0 && value < HEADER.dims[axis + 1]!,
    );

  function report() {
    onLocation({
      mm: voxel.map((value) => value * SPACING_MM) as unknown as Vec3,
      vox: voxel,
      values: [
        { name: 'md.nii.gz', value: voxel[0] + voxel[1] + voxel[2] },
        { name: 'fa.nii.gz', value: voxel[0] / HEADER.dims[1]! },
      ],
    });
  }

  function setVoxel(next: Vec3) {
    if (next.length !== 3 || !inside(next)) {
      throw new RangeError('Choose a zero-based source voxel inside the MRI grid.');
    }
    voxel = [...next];
    report();
  }

  return {
    get disposed() {
      return disposed;
    },
    get synced() {
      return synced;
    },
    get plane() {
      return plane;
    },
    header: HEADER,
    setPlane(next) {
      if (!PLANES.includes(next)) throw new RangeError(`Unknown MRI plane: ${next}`);
      plane = next;
    },
    setVoxel,
    moveVoxel(delta) {
      const next = voxel.map((value, axis) =>
        Math.min(HEADER.dims[axis + 1]! - 1, Math.max(0, value + delta[axis]!)),
      ) as unknown as Vec3;
      setVoxel(next);
    },
    setScannerPoint(point) {
      if (point.length !== 3 || !point.every(Number.isFinite)) {
        throw new RangeError('A scanner point needs three finite RAS values.');
      }
      const next = point.map((value) => Math.round(value / SPACING_MM)) as unknown as Vec3;
      if (!inside(next)) return false;
      setVoxel(next);
      return true;
    },
    setWindow(center, width) {
      if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
        throw new RangeError('MRI contrast requires a finite center and positive width.');
      }
    },
    setFaOpacity() {},
    async syncTracts(enabled, minimum) {
      if (!Number.isFinite(minimum) || minimum < 1) {
        throw new RangeError('Minimum tract length must be at least 1 mm.');
      }
      for (const id of enabled) await loadTract(id);
      if (!disposed) synced = [...enabled];
    },
    resize() {},
    dispose() {
      disposed = true;
    },
  };
}
