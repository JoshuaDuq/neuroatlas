import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Orbiting and zooming from the keyboard.
 *
 * The canvas is focusable and tells a screen reader it can be rotated and
 * zoomed, which until now was only true with a pointer. These are the same two
 * gestures expressed as key presses, in the same directions: a right arrow
 * turns the model the way dragging right turns it, so the two agree. Both go
 * through the controls' own orbit, so they share its frame, its poles and the
 * surface the camera stays outside.
 */

/** Five degrees: fine enough to aim, coarse enough to cross a hemisphere. */
export const ORBIT_STEP = Math.PI / 36;

/** One step of zoom, matching the wheel's proportional feel. */
const DOLLY_STEP = 1.1;

export interface OrbitDelta {
  azimuth?: number;
  polar?: number;
}

/** Arrow directions, as changes to the orbit's azimuth and polar angle. */
export const ORBIT_KEYS: Readonly<
  Record<'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', OrbitDelta>
> = {
  ArrowLeft: { azimuth: ORBIT_STEP },
  ArrowRight: { azimuth: -ORBIT_STEP },
  ArrowUp: { polar: ORBIT_STEP },
  ArrowDown: { polar: -ORBIT_STEP },
};

/** Factors on the camera's distance. `+` and `=` share a key on most layouts, so both zoom in. */
export const DOLLY_KEYS: Readonly<Record<'+' | '=' | '-', number>> = {
  '+': 1 / DOLLY_STEP,
  '=': 1 / DOLLY_STEP,
  '-': DOLLY_STEP,
};

/** One arrow press, applied at once: the controls' damping would ease it, and key presses do not animate. */
export function turnFromKeyboard(
  controls: Pick<OrbitControls, 'enableDamping' | 'rotateLeft' | 'rotateUp'>,
  { azimuth = 0, polar = 0 }: OrbitDelta,
): void {
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  try {
    // OrbitControls subtracts what it is given from both angles.
    if (azimuth) controls.rotateLeft(-azimuth);
    if (polar) controls.rotateUp(-polar);
  } finally {
    controls.enableDamping = damping;
  }
}
