import { Matrix4, Plane, Vector3 } from 'three';
import type { CutMode } from '../../types/index.ts';

export type Ras = readonly [number, number, number];
type SectionPlane = 'sagittal' | 'coronal' | 'axial';
type EdgeLetter = 'R' | 'L' | 'S' | 'I' | 'P' | 'A';

/** A cut's centre, orthonormal axes and edge letters, in source surface RAS millimetres. */
export interface Frame {
  center: Vector3;
  normal: Vector3;
  u: Vector3;
  v: Vector3;
  edges: readonly EdgeLetter[];
}

export interface ObliqueAngles {
  tilt?: number;
  azimuth?: number;
}

export const rasToWorld = ([right, anterior, superior]: Ras): Vector3 =>
  new Vector3(right / 1000, superior / 1000, -anterior / 1000);
export const worldToRas = (point: Vector3): [number, number, number] => [
  point.x * 1000,
  -point.z * 1000,
  point.y * 1000,
];

export function worldToVoxelMatrix(volume: { inverse: ArrayLike<number> }): Matrix4 {
  const worldToSource = new Matrix4().set(1000, 0, 0, 0, 0, 0, -1000, 0, 0, 1000, 0, 0, 0, 0, 0, 1);
  return new Matrix4().fromArray(volume.inverse).multiply(worldToSource);
}

const BASES: Readonly<
  Record<
    SectionPlane,
    {
      normal: Ras;
      u: Ras;
      v: Ras;
      edges: readonly [EdgeLetter, EdgeLetter, EdgeLetter, EdgeLetter];
    }
  >
> = {
  sagittal: { normal: [1, 0, 0], u: [0, -1, 0], v: [0, 0, 1], edges: ['S', 'P', 'I', 'A'] },
  coronal: { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], edges: ['S', 'R', 'I', 'L'] },
  axial: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], edges: ['A', 'R', 'P', 'L'] },
};

/**
 * Where a plane with this normal must sit to pass through a RAS point.
 * Clamped so a centroid just outside the volume still lands on a legal cut.
 */
export function offsetThrough(
  ras: Ras,
  normal: Pick<Vector3, 'x' | 'y' | 'z'>,
  range: readonly [number, number],
): number {
  const offset = ras[0] * normal.x + ras[1] * normal.y + ras[2] * normal.z;
  const [minimum, maximum] = range;
  if (!Number.isFinite(offset) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    throw new Error('A cut through a point needs finite coordinates and a finite range.');
  }
  return Math.min(maximum, Math.max(minimum, offset));
}

/** All frame vectors and positions are in source surface RAS millimeters. */
export function createFrame(
  mode: CutMode,
  crosshair: Ras,
  { tilt = 30, azimuth = 30 }: ObliqueAngles = {},
): Frame {
  if (crosshair.length !== 3 || !crosshair.every(Number.isFinite)) {
    throw new Error('Slice coordinates must be three finite RAS values.');
  }
  const center = new Vector3(...crosshair);
  if (mode === 'oblique') {
    if (
      ![tilt, azimuth].every(Number.isFinite) ||
      tilt < 0 ||
      tilt > 90 ||
      Math.abs(azimuth) > 180
    ) {
      throw new RangeError('Oblique angles are out of range.');
    }
    const t = (tilt * Math.PI) / 180;
    const a = (azimuth * Math.PI) / 180;
    const normal = new Vector3(Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t));
    const u = new Vector3(-Math.sin(a), Math.cos(a), 0);
    const v = new Vector3().crossVectors(normal, u);
    return { center, normal, u, v, edges: [] };
  }
  // Own keys only: 'constructor' and 'toString' are not section planes.
  if (!Object.hasOwn(BASES, mode)) throw new Error(`Unknown section plane: ${mode}`);
  const basis = BASES[mode as SectionPlane];
  return {
    center,
    normal: new Vector3(...basis.normal),
    u: new Vector3(...basis.u),
    v: new Vector3(...basis.v),
    edges: basis.edges,
  };
}

/** Positive source-axis half is removed unless reverse is selected. */
export function clippingPlane(frame: Frame, reverse: boolean): Plane {
  const normal = rasToWorld(frame.normal.toArray())
    .normalize()
    .multiplyScalar(reverse ? 1 : -1);
  return new Plane().setFromNormalAndCoplanarPoint(normal, rasToWorld(frame.center.toArray()));
}

export function centeredFrame(mode: CutMode, crosshair: Ras, angles?: ObliqueAngles): Frame {
  const frame = createFrame(mode, crosshair, angles);
  frame.center.copy(frame.normal.clone().multiplyScalar(frame.center.dot(frame.normal)));
  return frame;
}

/**
 * Top-left canvas origin, unlike the bottom-left texture origin. `fieldOfView` is the side of the
 * square the frame spans, in millimetres.
 */
export function pointOnFrame(
  frame: Frame,
  xFraction: number,
  yFraction: number,
  fieldOfView: number,
): [number, number, number] {
  return frame.center
    .clone()
    .addScaledVector(frame.u, (xFraction - 0.5) * fieldOfView)
    .addScaledVector(frame.v, (0.5 - yFraction) * fieldOfView)
    .toArray();
}
