import { Quaternion, Spherical, Vector3 } from 'three';

/**
 * Orbiting and zooming from the keyboard.
 *
 * The canvas is focusable and tells a screen reader it can be rotated and
 * zoomed, which until now was only true with a pointer. These are the same two
 * gestures expressed as key presses, in the same directions: a right arrow
 * turns the model the way dragging right turns it, so the two agree.
 *
 * The maths lives here rather than in the event handler so the directions can
 * be checked without a canvas.
 */

/** Five degrees: fine enough to aim, coarse enough to cross a hemisphere. */
export const ORBIT_STEP = Math.PI / 36;

/** One step of zoom, matching the wheel's proportional feel. */
export const DOLLY_STEP = 1.1;

const Y_UP = new Vector3(0, 1, 0);
const POLE = 1e-6;

/** Arrow directions, signed the way `OrbitControls` signs a drag. */
export const ORBIT_KEYS = {
  ArrowLeft: { azimuth: ORBIT_STEP },
  ArrowRight: { azimuth: -ORBIT_STEP },
  ArrowUp: { polar: ORBIT_STEP },
  ArrowDown: { polar: -ORBIT_STEP },
};

/** `+` and `=` share a key on most layouts, so both zoom in. */
export const DOLLY_KEYS = { '+': 1 / DOLLY_STEP, '=': 1 / DOLLY_STEP, '-': DOLLY_STEP };

export function orbitedPosition(position, target, up, { azimuth = 0, polar = 0 }) {
  // Superior and inferior views set `up` off the Y axis, so the offset is
  // rotated into a Y-up frame for the spherical step and back afterwards.
  const toYUp = new Quaternion().setFromUnitVectors(up.clone().normalize(), Y_UP);
  const offset = position.clone().sub(target).applyQuaternion(toYUp);
  if (offset.lengthSq() === 0) return position.clone();
  const spherical = new Spherical().setFromVector3(offset);
  spherical.theta += azimuth;
  // Crossing a pole flips the horizon, which a reader cannot undo by feel.
  spherical.phi = Math.min(Math.PI - POLE, Math.max(POLE, spherical.phi + polar));
  return target.clone().add(
    new Vector3().setFromSpherical(spherical).applyQuaternion(toYUp.invert()),
  );
}

/** Where the camera lands after one zoom step, inside the orbit's own limits. */
export function dolliedPosition(position, target, factor, { min = 0, max = Infinity } = {}) {
  const offset = position.clone().sub(target);
  const length = offset.length();
  if (length === 0) return position.clone();
  const distance = Math.min(max, Math.max(min, length * factor));
  return target.clone().addScaledVector(offset.divideScalar(length), distance);
}
