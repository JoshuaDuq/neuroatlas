import { Sphere, Vector3 } from 'three';

/**
 * Anatomical view directions, in the manifest's coordinate system
 * (x = right, y = superior, z = posterior). Each vector points from the
 * subject toward the camera.
 */
export const VIEW_DIRECTIONS = {
  oblique: new Vector3(-1, 0.3, -0.45).normalize(),
  left: new Vector3(-1, 0, 0),
  right: new Vector3(1, 0, 0),
  anterior: new Vector3(0, 0, -1),
  posterior: new Vector3(0, 0, 1),
  superior: new Vector3(0, 1, 0),
  inferior: new Vector3(0, -1, 0),
};

/** Looking straight down or up needs an up vector that is not the view axis. */
export function upFor(view) {
  if (view === 'superior') return new Vector3(0, 0, -1);
  if (view === 'inferior') return new Vector3(0, 0, 1);
  return new Vector3(0, 1, 0);
}

/**
 * Clipping planes and orbit limits for whatever is being framed.
 *
 * Derived from the framed radius rather than set once and mutated, so
 * focusing a small structure tightens the near plane and returning to the
 * whole brain restores it. The near-to-far ratio is constant, which is what
 * keeps depth precision the same at every scale; the previous code moved the
 * near plane to 50 um while leaving far at 10 m, a 200,000:1 ratio that
 * persisted for the rest of the session.
 */
export function cameraConstraints(bounds) {
  const radius = bounds.getBoundingSphere(new Sphere()).radius;
  return {
    near: radius * 0.01,
    far: radius * 100,
    minDistance: radius * 0.25,
    maxDistance: radius * 15,
  };
}

/*
 * Screen axes for a camera looking along `direction`. An orbit can bring the
 * view onto the up axis, where the cross product collapses; any perpendicular
 * serves there, and returning one keeps the fit finite instead of NaN.
 */
function viewBasis(up, direction) {
  const right = new Vector3().crossVectors(up, direction);
  if (right.lengthSq() < 1e-12) right.crossVectors(new Vector3(0, 0, 1), direction);
  if (right.lengthSq() < 1e-12) right.crossVectors(new Vector3(1, 0, 0), direction);
  right.normalize();
  return { right, up: new Vector3().crossVectors(direction, right).normalize() };
}

/**
 * How far back the camera must sit for `bounds` to fit the visible frustum.
 *
 * `fit` is the fraction of each axis the reader can actually see, from
 * `effective-viewport.js`. On a phone the sheet covers the lower canvas, so
 * fitting to the whole frustum would place half the anatomy behind it. The
 * slopes narrow instead, which pushes the camera back until the brain fits
 * the uncovered rectangle. It defaults to the whole canvas, so every desktop
 * caller is unaffected.
 */
export function fitDistance(camera, bounds, direction, fit = {}) {
  const center = bounds.getCenter(new Vector3());
  const { right, up } = viewBasis(camera.up, direction);
  const halfAngle = Math.tan(camera.fov * Math.PI / 360) * 0.92;
  const verticalSlope = halfAngle * (fit.vertical ?? 1);
  const horizontalSlope = halfAngle * camera.aspect * (fit.horizontal ?? 1);
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new Vector3(x, y, z).sub(center);
        const depth = corner.dot(direction);
        distance = Math.max(distance,
          depth + Math.abs(corner.dot(right)) / horizontalSlope,
          depth + Math.abs(corner.dot(up)) / verticalSlope);
      }
    }
  }
  return distance;
}

/** Fit a perspective camera to unchanged world bounds, with a small screen margin. */
export function frameBounds(camera, bounds, direction, fit = {}) {
  const center = bounds.getCenter(new Vector3());
  camera.position.copy(center)
    .addScaledVector(direction, fitDistance(camera, bounds, direction, fit));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  return center;
}

/**
 * Frame bounds and apply the matching constraints in one step, so the two can
 * never be applied separately and drift apart.
 */
export function frameTo(camera, controls, bounds, direction, fit) {
  const { near, far, minDistance, maxDistance } = cameraConstraints(bounds);
  camera.near = near;
  camera.far = far;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  const center = frameBounds(camera, bounds, direction, fit);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  return center;
}
