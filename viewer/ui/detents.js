/**
 * Where the sheet is allowed to rest, and which rest a drag lands on.
 *
 * The sheet snaps to three heights rather than floating anywhere: a free
 * sheet needs momentum, and a half-open panel that stops at an arbitrary
 * height cuts a control in half. Three named rests also give the rest of the
 * interface something to reason about — the camera reframes on arrival, and
 * "peek" is a state the selection strip can rely on.
 *
 *   peek  handle, selection strip and tabs — every control one tap away
 *   half  the working height: panel open, anatomy still visible
 *   full  a long list deserves the screen
 *
 * Pure: no DOM, no timers.
 */

export const DETENTS = ['peek', 'half', 'full'];

/**
 * Sheet spans in pixels for the space available, in detent order.
 *
 * The fractions differ by orientation. Upright the sheet grows over a tall
 * screen and half of it is a fair share; sideways it grows across a wide one,
 * where the same half leaves the anatomy a square too small to read, so it
 * takes less and the reader still sees the brain beside the panel.
 */
export function detentHeights(available, { peek = 132, half = 0.5, full = 0.88 } = {}) {
  const span = Math.max(0, available);
  // On a small screen the fractions can fall below the peek span or collide
  // with each other; each rest is held clear of the one below it so a drag
  // always has somewhere distinct to land.
  const floor = Math.min(peek, span);
  const middle = Math.max(floor, Math.round(span * half));
  const top = Math.max(middle, Math.round(span * full));
  return { peek: floor, half: middle, full: top };
}

/** Proportions for a sheet that grows across the screen rather than up it. */
export const SIDEWAYS_DETENTS = { peek: 180, half: 0.4, full: 0.62 };

/** The detent a height is nearest to. Ties resolve downward, toward the anatomy. */
export function nearestDetent(height, heights) {
  let best = DETENTS[0];
  let distance = Infinity;
  for (const name of DETENTS) {
    const delta = Math.abs(heights[name] - height);
    if (delta < distance) {
      distance = delta;
      best = name;
    }
  }
  return best;
}

/**
 * Where a drag ends up.
 *
 * A deliberate flick moves one rest in the direction it was thrown even when
 * the finger has barely travelled, because waiting to cross the midpoint of a
 * tall sheet makes the gesture feel stuck. A slow drag is read by position
 * alone, which is what makes fine adjustment possible.
 *
 * `velocity` is pixels per millisecond, positive when the sheet is growing.
 */
export function settleDetent(from, height, heights, velocity = 0) {
  const FLICK = 0.5;
  if (Math.abs(velocity) >= FLICK) {
    const index = DETENTS.indexOf(from);
    const next = index + (velocity > 0 ? 1 : -1);
    if (next >= 0 && next < DETENTS.length) return DETENTS[next];
    return DETENTS[Math.min(Math.max(index, 0), DETENTS.length - 1)];
  }
  return nearestDetent(height, heights);
}

/**
 * Resistance past the tallest rest.
 *
 * Without it a sheet dragged upward simply stops, which reads as a broken
 * gesture rather than a limit. Beyond the top the sheet keeps moving at a
 * third of the finger, which says "this is as far as it goes" while still
 * answering the hand.
 */
export function clampDrag(height, heights) {
  const floor = heights.peek;
  const ceiling = heights.full;
  if (height > ceiling) return ceiling + (height - ceiling) / 3;
  if (height < floor) return floor - (floor - height) / 3;
  return height;
}

/** The next rest up or down, for the handle's tap and for the keyboard. */
export function stepDetent(from, direction) {
  const index = DETENTS.indexOf(from);
  if (index < 0) return DETENTS[0];
  return DETENTS[Math.min(Math.max(index + direction, 0), DETENTS.length - 1)];
}
