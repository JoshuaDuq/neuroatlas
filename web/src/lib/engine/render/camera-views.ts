import { type Box3, type PerspectiveCamera, Sphere, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CutMode, ViewName } from '../../types/index.ts';

/**
 * Anatomical view directions, in the manifest's coordinate system
 * (x = right, y = superior, z = posterior). Each vector points from the
 * subject toward the camera.
 */
export const VIEW_DIRECTIONS: Readonly<Record<ViewName, Vector3>> = {
  oblique: new Vector3(-1, 0.3, -0.45).normalize(),
  left: new Vector3(-1, 0, 0),
  right: new Vector3(1, 0, 0),
  anterior: new Vector3(0, 0, -1),
  posterior: new Vector3(0, 0, 1),
  superior: new Vector3(0, 1, 0),
  inferior: new Vector3(0, -1, 0),
};

/** Looking straight down or up needs an up vector that is not the view axis. */
export function upFor(view: ViewName): Vector3 {
  if (view === 'superior') return new Vector3(0, 0, -1);
  if (view === 'inferior') return new Vector3(0, 0, 1);
  return new Vector3(0, 1, 0);
}

// "off" has no cut surface to face.
const CUT_VIEWS: Readonly<Partial<Record<CutMode, readonly [ViewName, ViewName]>>> = {
  sagittal: ['right', 'left'],
  coronal: ['anterior', 'posterior'],
  axial: ['superior', 'inferior'],
  oblique: ['oblique', 'oblique'],
};

/** The preset that faces a cut's surface; an oblique cut is faced along its own normal. */
export function cutFacingView(mode: CutMode, reverse = false): ViewName | null {
  // The lookup stays tolerant: restored links reach here untrusted.
  return CUT_VIEWS[mode]?.[Number(Boolean(reverse))] ?? null;
}

/** The view a restored link should face its cut from, or null to keep the link's own view. */
export function viewForRestoredCut({
  cut,
  reverse = false,
  view,
}: {
  cut?: CutMode;
  reverse?: boolean;
  view?: ViewName | null;
} = {}): ViewName | null {
  return view || cut === undefined ? null : cutFacingView(cut, reverse);
}

export interface CameraConstraints {
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
}

/**
 * Clipping planes and orbit limits for whatever is being framed.
 *
 * Derived from the framed radius rather than set once and mutated, so
 * focusing a small structure tightens the near plane and returning to the
 * whole brain restores it. The near-to-far ratio is constant, which is what
 * keeps depth precision the same at every scale. Elongated structures like
 * the spinal cord derive minDistance from their cross-section so the reader
 * can approach fine details rather than being locked out by overall length.
 */
export function cameraConstraints(bounds: Box3): CameraConstraints {
  const radius = bounds.getBoundingSphere(new Sphere()).radius;
  const size = bounds.getSize(new Vector3());
  const minSpan = Math.min(size.x, size.y, size.z);
  return {
    near: radius * 0.01,
    far: radius * 100,
    minDistance: Math.min(radius * 0.25, Math.max(minSpan * 0.5, 0.005)),
    maxDistance: radius * 25,
  };
}

/** The share of the visible stage the framed anatomy spans on its tighter axis, leaving room for the markings. */
export const FRAME_FILL = 0.8;

/** Below this bounding radius a framed structure loses the neighbourhood that locates it, in metres. */
export const MIN_CONTEXT_RADIUS = 0.05;

/** Bounds grown evenly on every side until their bounding sphere reaches `radius`. */
export function withContext(bounds: Box3, radius = MIN_CONTEXT_RADIUS): Box3 {
  const grown = bounds.clone();
  const half = bounds.getSize(new Vector3()).multiplyScalar(0.5);
  const sum = half.x + half.y + half.z;
  const squares = half.lengthSq();
  if (squares >= radius * radius) return grown;
  // |half + d| = radius, solved for the margin d added to each axis.
  const margin = (-sum + Math.sqrt(sum * sum - 3 * (squares - radius * radius))) / 3;
  return grown.expandByScalar(margin);
}

/*
 * Screen axes for a camera looking along `direction`. An orbit can bring the
 * view onto the up axis, where the cross product collapses; any perpendicular
 * serves there, and returning one keeps the fit finite instead of NaN.
 */
function viewBasis(up: Vector3, direction: Vector3): { right: Vector3; up: Vector3 } {
  const right = new Vector3().crossVectors(up, direction);
  if (right.lengthSq() < 1e-12) right.crossVectors(new Vector3(0, 0, 1), direction);
  if (right.lengthSq() < 1e-12) right.crossVectors(new Vector3(1, 0, 0), direction);
  right.normalize();
  return { right, up: new Vector3().crossVectors(direction, right).normalize() };
}

/** The fraction of each axis the reader can actually see. */
export interface FitScale {
  vertical?: number;
  horizontal?: number;
}

/**
 * How far back the camera must sit for `bounds` to fit the visible frustum.
 *
 * `fit` is the fraction of each axis the reader can actually see, from
 * `effective-viewport.ts`. On a phone the sheet covers the lower canvas, so
 * fitting to the whole frustum would place half the anatomy behind it. The
 * slopes narrow instead, which pushes the camera back until the brain fits
 * the uncovered rectangle. It defaults to the whole canvas, so every desktop
 * caller is unaffected.
 *
 * `points` is a flat x, y, z list of the anatomy's own vertices. An empty list
 * would fit nothing and return a zero distance, so it is refused (see
 * docs/decisions/deviations/e1-render-primitives.md).
 */
export function fitDistance(
  camera: PerspectiveCamera,
  bounds: Box3,
  direction: Vector3,
  fit: FitScale = {},
  points: ArrayLike<number> | null = null,
): number {
  if (points?.length === 0) throw new RangeError('Fitting to an empty point list.');
  const center = bounds.getCenter(new Vector3());
  const { right, up } = viewBasis(camera.up, direction);
  const halfAngle = Math.tan((camera.fov * Math.PI) / 360) * FRAME_FILL;
  const verticalSlope = halfAngle * (fit.vertical ?? 1);
  const horizontalSlope = halfAngle * camera.aspect * (fit.horizontal ?? 1);
  let distance = 0;
  const offset = new Vector3();
  const reach = () => {
    const depth = offset.dot(direction);
    distance = Math.max(
      distance,
      depth + Math.abs(offset.dot(right)) / horizontalSlope,
      depth + Math.abs(offset.dot(up)) / verticalSlope,
    );
  };
  if (points) {
    // The anatomy's own silhouette. A box's far corner sticks out past a brain
    // that never reaches it, and on an oblique view — the one this opens on —
    // that corner is what the camera was backing away from.
    for (let i = 0; i < points.length; i += 3) {
      offset.set(points[i]!, points[i + 1]!, points[i + 2]!).sub(center);
      reach();
    }
    return distance;
  }
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        offset.set(x, y, z).sub(center);
        reach();
      }
    }
  }
  return distance;
}

/** Fit a perspective camera to unchanged world bounds, spanning FRAME_FILL of the view. */
export function frameBounds(
  camera: PerspectiveCamera,
  bounds: Box3,
  direction: Vector3,
  fit: FitScale = {},
  points: ArrayLike<number> | null = null,
): Vector3 {
  const center = bounds.getCenter(new Vector3());
  camera.position
    .copy(center)
    .addScaledVector(direction, fitDistance(camera, bounds, direction, fit, points));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  return center;
}

/**
 * Frame bounds and apply the matching constraints in one step, so the two can
 * never be applied separately and drift apart. The controls are not updated:
 * this plans a move, and an update would announce it to every 'change' listener.
 */
export function frameTo(
  camera: PerspectiveCamera,
  controls: Pick<OrbitControls, 'minDistance' | 'maxDistance' | 'target'>,
  bounds: Box3,
  direction: Vector3,
  fit?: FitScale,
  points: ArrayLike<number> | null = null,
): Vector3 {
  const { near, far, minDistance, maxDistance } = cameraConstraints(bounds);
  camera.near = near;
  camera.far = far;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  const center = frameBounds(camera, bounds, direction, fit, points);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  return center;
}
