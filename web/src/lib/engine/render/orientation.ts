import { Matrix4, type Object3D, type Vector3 } from 'three';
import { t } from '../../core/i18n/index.ts';
import type { Language } from '../../types/index.ts';

export type Edge = 'right' | 'left' | 'top' | 'bottom';
export type Letter = 'R' | 'L' | 'S' | 'I' | 'P' | 'A';
type Direction = readonly [number, number, number];

/**
 * Anatomical direction letters for the four viewport edges.
 *
 * The manifest's coordinate system is x = right, y = superior, z = posterior,
 * so each signed world axis names one anatomical direction. An edge is
 * labelled with the direction a viewer moves toward as they travel to it,
 * which is the convention every medical imaging viewer uses.
 *
 * Deriving the letters from the camera's own basis, rather than tabulating
 * them per named view, means a freely orbited camera stays correct and there
 * is no table to fall out of step with the view presets.
 */
const AXES: readonly { letter: Letter; axis: 0 | 1 | 2; sign: 1 | -1 }[] = [
  { letter: 'R', axis: 0, sign: 1 },
  { letter: 'L', axis: 0, sign: -1 },
  { letter: 'S', axis: 1, sign: 1 },
  { letter: 'I', axis: 1, sign: -1 },
  { letter: 'P', axis: 2, sign: 1 },
  { letter: 'A', axis: 2, sign: -1 },
];

const OPPOSITE: Readonly<Record<Letter, Letter>> = {
  R: 'L',
  L: 'R',
  S: 'I',
  I: 'S',
  P: 'A',
  A: 'P',
};

const look = new Matrix4();

/**
 * The world-space basis vector of a camera column. Given the orbit target, it is the basis
 * lookAt gives the camera on its next update: OrbitControls announces a move before the world
 * matrix is recomputed, and a framing plan leaves the camera turned toward a destination it has
 * not reached. Without one, the refreshed world matrix is read.
 */
function basis(camera: Object3D, column: number, target: Vector3 | null): Direction {
  let m: ArrayLike<number>;
  if (target) {
    m = look.lookAt(camera.position, target, camera.up).elements;
  } else {
    camera.updateWorldMatrix(true, false);
    m = camera.matrixWorld.elements;
  }
  const offset = column * 4;
  const [x, y, z] = [m[offset]!, m[offset + 1]!, m[offset + 2]!];
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** The camera's world basis; pass the orbit target for the basis of the frame about to be drawn. */
export function cameraBasis(
  camera: Object3D,
  target: Vector3 | null = null,
): Record<'right' | 'up' | 'back', Direction> {
  return {
    right: basis(camera, 0, target),
    up: basis(camera, 1, target),
    back: basis(camera, 2, target),
  };
}

/**
 * Where each anatomical direction lands on a gizmo drawn from a camera basis: x right and y down,
 * -1 to 1, and `depth` from -1 (away from the viewer) to 1 (toward the viewer).
 */
export function projectAxes({ right, up, back }: Record<'right' | 'up' | 'back', Direction>): {
  letter: Letter;
  x: number;
  y: number;
  depth: number;
}[] {
  return AXES.map(({ letter, axis, sign }) => ({
    letter,
    x: sign * right[axis],
    y: -sign * up[axis],
    depth: sign * back[axis],
  }));
}

/** The anatomical letter for the axis most closely aligned with a direction. */
function letterFor([x, y, z]: Direction): Letter {
  const components = [x, y, z];
  let best = AXES[0]!;
  let bestDot = -Infinity;
  for (const candidate of AXES) {
    const dot = components[candidate.axis]! * candidate.sign;
    if (dot > bestDot) {
      bestDot = dot;
      best = candidate;
    }
  }
  return best.letter;
}

/** English edge letters in the reader's language. */
export function localizeEdges(
  raw: Record<Edge, Letter>,
  lang: Language = 'en',
): Record<Edge, string> {
  const letters = t(lang, 'orientation');
  return Object.fromEntries(
    Object.entries(raw).map(([edge, letter]) => [edge, letters[letter]]),
  ) as Record<Edge, string>;
}

/** Edge letters for a camera; pass the orbit target for the letters of the frame about to be drawn. */
export function edgeLabels(
  camera: Object3D,
  lang?: 'en',
  target?: Vector3 | null,
): Record<Edge, Letter>;
export function edgeLabels(
  camera: Object3D,
  lang: Language,
  target?: Vector3 | null,
): Record<Edge, string>;
export function edgeLabels(
  camera: Object3D,
  lang: Language = 'en',
  target: Vector3 | null = null,
): Record<Edge, string> {
  const right = letterFor(basis(camera, 0, target));
  const top = letterFor(basis(camera, 1, target));
  return localizeEdges({ right, left: OPPOSITE[right], top, bottom: OPPOSITE[top] }, lang);
}
