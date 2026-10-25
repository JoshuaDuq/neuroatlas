import {
  type Intersection,
  type PerspectiveCamera,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';
import type {} from 'three-mesh-bvh'; // types `Raycaster.firstHitOnly`
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const Y_UP = new Vector3(0, 1, 0);

/** Finds the nearest visible hit along a ray, or null. */
export type Intersect = (raycaster: Raycaster) => Pick<Intersection, 'point'> | null;

/** OrbitControls state that exists at runtime but that `@types/three` does not declare. */
interface OrbitInternals {
  _quat: Quaternion;
  _quatInverse: Quaternion;
  _scale: number;
  _performCursorZoom: boolean;
  _mouse: Vector2;
}

type InternalControls = OrbitControls & OrbitInternals;

/*
 * The adaptations reach into OrbitControls' private state. three is pinned to one release and
 * the tests drive the real controls, so a release that renames these fails there first.
 */
function requirePrivate(
  controls: OrbitControls,
  keys: readonly (keyof OrbitInternals)[],
): asserts controls is InternalControls {
  const missing = keys.filter((key) => !(key in controls));
  if (missing.length) throw new Error(`OrbitControls no longer has ${missing.join(', ')}`);
}

/**
 * Orbit about the camera's current up rather than the up the controls were built with.
 *
 * OrbitControls derives its orbit frame from `object.up` once, in its constructor. The superior
 * and inferior views set an anterior or posterior up, which left the camera on that frame's
 * clamped pole: a sideways drag did nothing and a vertical one moved only one way. Re-deriving the
 * frame whenever the up changes turns every view about its own screen axes, as the arrow keys did.
 */
export function followCameraUp(controls: OrbitControls): void {
  requirePrivate(controls, ['_quat', '_quatInverse']);
  const frameUp = controls.object.up.clone();
  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    const { up } = controls.object;
    if (!up.equals(frameUp)) {
      frameUp.copy(up);
      controls._quat.setFromUnitVectors(up.clone().normalize(), Y_UP);
      controls._quatInverse.copy(controls._quat).invert();
    }
    return update(deltaTime);
  };
}

/** Camera and target scaled together about `point`, their distance held within the orbit limits. */
export function zoomAbout(
  position: Vector3,
  target: Vector3,
  point: Vector3,
  scale: number,
  { min, max }: { min: number; max: number },
): { position: Vector3; target: Vector3 } {
  const distance = position.distanceTo(target);
  const factor = Math.min(Math.max(distance * scale, min), max) / distance;
  return {
    position: point.clone().lerp(position, factor),
    target: point.clone().lerp(target, factor),
  };
}

/**
 * Zoom toward the first surface under the pointer, or in the middle of the view for a zoom key.
 *
 * OrbitControls scales the distance to its target, which sits inside the anatomy, so zooming onto
 * the cortex carried the camera through it. Scaling camera and target together about the surface
 * point keeps that point still on screen and shrinks only the gap to it: the camera can approach a
 * surface but never pass it. Over empty stage the point is level with the target.
 *
 * `intersect(raycaster)` returns the nearest visible hit, or null.
 */
export function zoomAboutSurface(controls: OrbitControls, intersect: Intersect): void {
  requirePrivate(controls, ['_scale', '_performCursorZoom', '_mouse']);
  const camera = controls.object as PerspectiveCamera;
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const forward = new Vector3();
  const level = new Plane();
  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    if (controls._scale !== 1) {
      camera.updateMatrixWorld();
      if (controls._performCursorZoom) {
        raycaster.setFromCamera(controls._mouse, camera);
      } else {
        raycaster.set(
          camera.position,
          forward.subVectors(controls.target, camera.position).normalize(),
        );
      }
      level.setFromNormalAndCoplanarPoint(camera.getWorldDirection(forward), controls.target);
      const point =
        intersect(raycaster)?.point ?? raycaster.ray.intersectPlane(level, new Vector3());
      if (!point) throw new Error('The zoom ray never meets the level plane.');
      const zoomed = zoomAbout(camera.position, controls.target, point, controls._scale, {
        min: controls.minDistance,
        max: controls.maxDistance,
      });
      camera.position.copy(zoomed.position);
      controls.target.copy(zoomed.target);
      controls._scale = 1;
      controls._performCursorZoom = false;
    }
    return update(deltaTime);
  };
}

/**
 * Keep an orbit or pan from carrying the camera into, or flat against, a surface.
 *
 * Close in, the pivot sits under the surface the reader zoomed onto, and turning about it can swing
 * the camera into the tissue around it, or skim it so close that one surface fills the view. The
 * surfaces are single-sided, so a camera already inside one cannot see it; but the camera starts
 * outside, and a surface it nears from outside faces it. A move is refused when it would come
 * within a quarter of the closest zoom of a surface, along its path or along the line of sight,
 * and the camera backs away from the target by as far as the move tried to go instead: pressing
 * into the anatomy zooms out rather than pinning the camera to it. Lifting it out to the outermost
 * surface jumped it across whole lobes in one frame.
 *
 * Backing away is not the reader's zoom. Moves that are free again bring the camera back toward the
 * distance the reader last chose, by as far as each move goes, so it rides over the anatomy and
 * settles where it was.
 */
export function stayOutside(controls: OrbitControls, intersect: Intersect): void {
  const camera = controls.object;
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const from = new Vector3();
  const fromTarget = new Vector3();
  const step = new Vector3();
  const sight = new Vector3();
  const back = new Vector3();
  // The reader's distance, and the one this last left the camera at: any other was a zoom or a framing.
  let chosen = 0;
  let left = NaN;
  /** How far along a ray the nearest surface lies, if within `reach`; otherwise Infinity. */
  const room = (origin: Vector3, direction: Vector3, reach: number): number => {
    raycaster.set(origin, direction);
    raycaster.far = reach;
    return intersect(raycaster)?.point.distanceTo(origin) ?? Infinity;
  };

  function keepClear(): void {
    const length = step.subVectors(camera.position, from).length();
    if (length === 0) return;
    const clearance = controls.minDistance / 4;
    const distance = camera.position.distanceTo(controls.target);
    sight.subVectors(controls.target, camera.position).divideScalar(distance);
    if (
      room(from, step.divideScalar(length), length + clearance) < Infinity ||
      room(camera.position, sight, clearance) < Infinity
    ) {
      back.subVectors(from, fromTarget).normalize();
      camera.position.copy(from);
      if (room(from, back, length + clearance) === Infinity) {
        camera.position.addScaledVector(back, length);
      }
      controls.target.copy(fromTarget);
      camera.lookAt(controls.target);
    } else {
      const excess = Math.min(distance - chosen, length);
      if (excess <= 0) return;
      const inward = Math.min(excess, room(camera.position, sight, excess + clearance) - clearance);
      if (inward <= 0) return;
      camera.position.addScaledVector(sight, inward);
    }
    controls.dispatchEvent({ type: 'change' });
  }

  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    // Only the controls' own moves are checked: a framing move places the camera before this runs.
    from.copy(camera.position);
    fromTarget.copy(controls.target);
    const distance = from.distanceTo(fromTarget);
    if (distance !== left) chosen = distance;
    const moved = update(deltaTime);
    if (moved) keepClear();
    left = camera.position.distanceTo(controls.target);
    return moved;
  };
}
