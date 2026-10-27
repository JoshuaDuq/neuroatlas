import { Matrix4, Vector3 } from 'three';
import type { LesionSphere as Sphere, LesionTissue } from '../api.ts';
import type { Volume } from '../slices/volume.ts';

export type TissueClass = keyof LesionTissue;

/** A label as `tissue-labels.json` publishes it, as far as the measurement reads it. */
export interface MeasuredLabel {
  name?: string;
  kind: string;
  region_id: string | null;
}

export type RegionShares = Map<string, { inside: number; whole: number }>;

function requireRadius(radius: number): void {
  if (!(Number.isFinite(radius) && radius > 0)) {
    throw new RangeError(
      `A lesion radius must be a positive number of millimetres, not ${radius}.`,
    );
  }
}

/** The stored values of the voxels whose centres lie within the sphere, with how many of each. */
export function voxelsInSphere(volume: Volume, { centre, radius }: Sphere): Map<number, number> {
  requireRadius(radius);
  const toRas = new Matrix4().fromArray(volume.inverse).invert();
  const [nx, ny] = volume.shape;
  // The sphere's bounding box in voxel indices: its eight corners through the inverse affine.
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 8; corner++) {
    const voxel = volume.voxel(
      centre.map((value, axis) => value + ((corner >> axis) & 1 ? radius : -radius)),
    );
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis]!, voxel[axis]!);
      high[axis] = Math.max(high[axis]!, voxel[axis]!);
    }
  }
  const from = low.map((value) => Math.max(0, Math.ceil(value)));
  const to = high.map((value, axis) => Math.min(volume.shape[axis]! - 1, Math.floor(value)));
  const counts = new Map<number, number>();
  const point = new Vector3();
  const r2 = radius * radius;
  for (let z = from[2]!; z <= to[2]!; z++)
    for (let y = from[1]!; y <= to[1]!; y++)
      for (let x = from[0]!; x <= to[0]!; x++) {
        point.set(x, y, z).applyMatrix4(toRas);
        const dx = point.x - centre[0],
          dy = point.y - centre[1],
          dz = point.z - centre[2];
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        const value = volume.data[x + nx * (y + ny * z)]!;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
  return counts;
}

/** How many voxels hold each stored value. */
export function labelTotals(volume: Volume): Map<number, number> {
  const totals = new Map<number, number>();
  for (const value of volume.data) totals.set(value, (totals.get(value) ?? 0) + 1);
  return totals;
}

/** FreeSurfer's aseg names, by tissue: the cortex is known by its `kind`. */
const WHITE = /White-Matter|^WM-hypointensities$|^CC_/;
const FLUID = /Ventricle|-Vent$|^CSF$/;

export function tissueClass({ kind, name = '', region_id }: MeasuredLabel): TissueClass {
  if (kind === 'cortex') return 'cortex';
  if (name === 'Unknown') return 'outside';
  if (WHITE.test(name)) return 'white';
  if (FLUID.test(name)) return 'fluid';
  if (region_id) return 'deep';
  throw new Error(`No tissue class for the label ${name || '(unnamed)'}.`);
}

const voxelMm3 = (volume: Volume): number =>
  Math.abs(new Matrix4().fromArray(volume.inverse).invert().determinant());

function labelOf(labels: readonly MeasuredLabel[], value: number): MeasuredLabel {
  const label = labels[value];
  if (!label) throw new Error(`The volume stores ${value}, which its label table lacks.`);
  return label;
}

/**
 * Each region the sphere reaches, in mm³: how much lies inside and how large the whole region is.
 * `totals` is the volume's `labelTotals`, kept by the caller so a volume is counted once.
 */
export function regionsInSphere(
  volume: Volume,
  labels: readonly MeasuredLabel[],
  sphere: Sphere,
  totals: Map<number, number>,
): RegionShares {
  const voxel = voxelMm3(volume);
  const regions: RegionShares = new Map();
  for (const [value, count] of voxelsInSphere(volume, sphere)) {
    const { region_id: id } = labelOf(labels, value);
    if (!id) continue;
    const region = regions.get(id) ?? { inside: 0, whole: 0 };
    region.inside += count * voxel;
    region.whole += totals.get(value)! * voxel;
    regions.set(id, region);
  }
  return regions;
}

/** The mm³ of each tissue inside the sphere, on a volume of FreeSurfer labels. */
export function tissueInSphere(
  volume: Volume,
  labels: readonly MeasuredLabel[],
  sphere: Sphere,
): LesionTissue {
  const voxel = voxelMm3(volume);
  const tissue: LesionTissue = { cortex: 0, white: 0, deep: 0, fluid: 0, outside: 0 };
  for (const [value, count] of voxelsInSphere(volume, sphere)) {
    tissue[tissueClass(labelOf(labels, value))] += count * voxel;
  }
  return tissue;
}

/** The streamlines with at least one point within the sphere; `offsets` start each one, then end the last. */
export function streamlinesCrossing(
  points: Float32Array,
  offsets: Uint32Array,
  { centre, radius }: Sphere,
): number {
  requireRadius(radius);
  const r2 = radius * radius;
  const [cx, cy, cz] = centre;
  let crossing = 0;
  for (let line = 0; line + 1 < offsets.length; line++) {
    for (let p = offsets[line]! * 3; p < offsets[line + 1]! * 3; p += 3) {
      const dx = points[p]! - cx,
        dy = points[p + 1]! - cy,
        dz = points[p + 2]! - cz;
      if (dx * dx + dy * dy + dz * dz <= r2) {
        crossing++;
        break;
      }
    }
  }
  return crossing;
}
