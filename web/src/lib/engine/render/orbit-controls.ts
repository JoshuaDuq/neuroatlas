import {
  type Intersection,
  type PerspectiveCamera,
  Plane,
  Quaternion,
  Raycaster,
  type Spherical,
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
  _sphericalDelta: Spherical;
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

/** How far off the superior axis a top or bottom view steps to take a heading, in radians. */
const POLE_OFFSET = 1e-4;
/** The share of the remaining roll each update of a turn removes. */
const LEVEL_RATE = 0.2;
/** Below this roll, in radians, the camera is level. */
const LEVELLED = 1e-3;
/** A turn smaller than this per update is the tail of damping, not the reader turning. */
const TURNING = 1e-4;

/**
 * Turn the brain like a turntable, superior up, whatever roll a framing left the camera at.
 *
 * The superior and inferior views, a faced cut, a linked camera and a grab mid-move can each leave
 * the camera's up off the superior axis. Orbiting about that up carried the roll into every later
 * view: a sideways drag from above laid the brain on its side and kept it there. The controls keep
 * their superior frame, and once the reader turns, the roll eases out over a few frames. On a top or
 * bottom view the camera sits on the axis, where the up alone sets the roll; it steps a hair off the
 * axis to the side whose superior up draws the same picture, so a sideways drag spins the view.
 */
export function levelOnOrbit(controls: OrbitControls): void {
  requirePrivate(controls, ['_sphericalDelta']);
  const camera = controls.object;
  const offset = new Vector3();
  const sight = new Vector3();
  const shown = new Vector3();
  const level = new Vector3();
  const axis = new Vector3();
  const roll = new Quaternion();
  // The up this last left; a framing that writes another ends the levelling.
  const written = new Vector3();
  let levelling = false;

  function levelStep(): void {
    offset.subVectors(camera.position, controls.target);
    const length = offset.length();
    shown.copy(Y_UP).applyQuaternion(camera.quaternion);
    if (Math.hypot(offset.x, offset.z) < length * POLE_OFFSET) {
      // Looking along the axis, superior up reads as the horizontal away from the camera's offset
      // from above, and toward it from below.
      const side = Math.sign(offset.y);
      shown.setY(0).normalize();
      camera.position
        .copy(controls.target)
        .addScaledVector(Y_UP, side * length * Math.cos(POLE_OFFSET))
        .addScaledVector(shown, -side * length * Math.sin(POLE_OFFSET));
      camera.up.copy(Y_UP);
      levelling = false;
      return;
    }
    sight.copy(offset).divideScalar(-length);
    level.copy(Y_UP).addScaledVector(sight, -sight.y).normalize();
    // Both lie across the line of sight, so the roll between them is a turn about it.
    const angle = Math.atan2(sight.dot(axis.crossVectors(shown, level)), shown.dot(level));
    if (Math.abs(angle) < LEVELLED) {
      camera.up.copy(Y_UP);
      levelling = false;
      return;
    }
    camera.up.copy(shown).applyQuaternion(roll.setFromAxisAngle(sight, angle * LEVEL_RATE));
    written.copy(camera.up);
  }

  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    if (levelling && !camera.up.equals(written)) levelling = false;
    const { theta, phi } = controls._sphericalDelta;
    const turning = Math.max(Math.abs(theta), Math.abs(phi)) > TURNING;
    if (turning && !camera.up.equals(Y_UP)) levelling = true;
    if (levelling) levelStep();
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

/** Where zooming out leads: the centre of what is framed, and how far back it fills the stage. */
export type Home = (direction: Vector3) => { center: Vector3; distance: number };

/**
 * The share of the way to its home a zoom out from `before` to `after` carries the orbit target.
 *
 * Counted in zoom steps, so the shares compound: from far in, the target is most of the way home
 * as the distance reaches `fill`. Within half a doubling of `fill`, and beyond it, each step takes
 * a share of what is left in proportion to its size, so no step jumps the anatomy across the stage.
 */
export function homeward(before: number, after: number, fill: number): number {
  return Math.min(1, Math.log(after / before) / Math.max(Math.log(fill / before), Math.LN2 / 2));
}

/**
 * Zoom in toward the first surface under the pointer, or in the middle of the view for a zoom key;
 * zoom out straight back, toward the centre of what is framed.
 *
 * OrbitControls scales the distance to its target, which sits inside the anatomy, so zooming onto
 * the cortex carried the camera through it. Scaling camera and target together about the surface
 * point keeps that point still on screen and shrinks only the gap to it: the camera can approach a
 * surface but never pass it. Over empty stage the point is level with the target.
 *
 * Each zoom in carries the target toward the pointer, and zooming out about the pointer carried it
 * further: the anatomy drifted off the stage and swung wide on the next turn. Zooming out instead
 * backs away from the target and leads it home in step with the zoom.
 *
 * `intersect(raycaster)` returns the nearest visible hit, or null.
 */
export function zoomAboutSurface(controls: OrbitControls, intersect: Intersect, home: Home): void {
  requirePrivate(controls, ['_scale', '_performCursorZoom', '_mouse']);
  const camera = controls.object as PerspectiveCamera;
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const forward = new Vector3();
  const level = new Plane();
  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    if (controls._scale > 1) {
      const before = camera.position.distanceTo(controls.target);
      const zoomed = zoomAbout(camera.position, controls.target, controls.target, controls._scale, {
        min: controls.minDistance,
        max: controls.maxDistance,
      });
      const after = zoomed.position.distanceTo(zoomed.target);
      const { center, distance } = home(
        forward.subVectors(zoomed.position, zoomed.target).divideScalar(after),
      );
      const shift = center.sub(zoomed.target).multiplyScalar(homeward(before, after, distance));
      camera.position.copy(zoomed.position).add(shift);
      controls.target.copy(zoomed.target).add(shift);
      controls._scale = 1;
      controls._performCursorZoom = false;
    } else if (controls._scale < 1) {
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
