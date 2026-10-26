/**
 * Where the phone sheet is allowed to rest, and which rest a drag lands on
 * (viewer/ui/chrome/detents.js).
 *
 * The sheet snaps to three heights rather than floating anywhere: a free sheet needs momentum,
 * and a half-open panel that stops at an arbitrary height cuts a control in half. Three named
 * rests also give the rest of the interface something to reason about: the camera reframes on
 * arrival, and "peek" is a state the selection strip can rely on.
 *
 *   peek  handle, selection and tabs: every control one tap away
 *   half  the working height: panel open, anatomy still visible
 *   full  a long list deserves the screen
 *
 * Pure: no DOM, no timers.
 */

export const DETENTS = ['peek', 'half', 'full'] as const;

export type Detent = (typeof DETENTS)[number];

export type DetentHeights = Record<Detent, number>;

/** The size of each rest: `peek` in pixels, `half` and `full` as fractions of the room, less `picture` pixels at full. */
export interface DetentProportions {
  peek: number;
  half: number;
  full?: number;
  picture?: number;
}

/** The sheet's span at an instant of a drag, in pixels, with the event's `timeStamp`. */
export interface SpanSample {
  at: number;
  span: number;
}

/**
 * Sheet spans in pixels for the space available, in detent order.
 *
 * Upright the sheet grows over a tall screen: half shares the screen evenly between the working
 * panel and the anatomy, and full leaves a fixed band of picture rather than a fraction, so the
 * preview above a raised sheet is the same deliberate size on every phone. Sideways the working
 * rest also shares the screen evenly; its full rest is narrower so the model remains readable
 * beside it.
 */
export function detentHeights(
  available: number,
  { peek, half, full = 1, picture = 0 }: DetentProportions,
): DetentHeights {
  const span = Math.max(0, available);
  // On a small screen the fractions can fall below the peek span or collide with each other;
  // each rest is held clear of the one below it so a drag always has somewhere distinct to land.
  const floor = Math.min(peek, span);
  const middle = Math.max(floor, Math.round(span * half));
  const top = Math.max(middle, Math.round(span * full) - picture);
  return { peek: floor, half: middle, full: top };
}

/** Peek is the grip's own height when it can be measured; this is the fallback. */
export const UPRIGHT_DETENTS: DetentProportions = { peek: 132, half: 0.5, picture: 128 };

/**
 * Proportions for a sheet that grows across the screen rather than up it. Peek is the narrowest
 * the rail goes; the one row of tabs it measures is usually wider, so half has to clear that.
 */
export const SIDEWAYS_DETENTS: DetentProportions = { peek: 216, half: 0.5, full: 0.62 };

/** The detent a height is nearest to. Ties resolve downward, toward the anatomy. */
export function nearestDetent(height: number, heights: DetentHeights): Detent {
  let best: Detent = DETENTS[0];
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

/** Pixels per millisecond; Vaul's snap-point threshold. */
const FLICK_VELOCITY = 0.4;

/**
 * Where a drag ends up.
 *
 * A deliberate flick moves one rest in the direction it was thrown even when the finger has
 * barely travelled, because waiting to cross the midpoint of a tall sheet makes the gesture feel
 * stuck. A slow drag is read by position alone, which is what makes fine adjustment possible.
 *
 * `velocity` is pixels per millisecond, positive when the sheet is growing.
 */
export function settleDetent(
  from: Detent,
  height: number,
  heights: DetentHeights,
  velocity = 0,
): Detent {
  if (Math.abs(velocity) >= FLICK_VELOCITY) {
    const index = DETENTS.indexOf(from);
    const next = index + (velocity > 0 ? 1 : -1);
    if (next >= 0 && next < DETENTS.length) return DETENTS[next]!;
    return DETENTS[Math.min(Math.max(index, 0), DETENTS.length - 1)]!;
  }
  return nearestDetent(height, heights);
}

/** Only the movement just before release counts as the throw. */
const VELOCITY_WINDOW_MS = 100;

/**
 * Velocity at release from samples, oldest first.
 *
 * Read over a short window rather than the last pair of moves: one late sample with a tiny
 * interval spikes the estimate, and a finger that stopped before lifting has not thrown anything.
 */
export function releaseVelocity(samples: readonly SpanSample[], releasedAt: number): number {
  const recent = samples.filter((sample) => releasedAt - sample.at <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const elapsed = last.at - first.at;
  return elapsed > 0 ? (last.span - first.span) / elapsed : 0;
}

/** How far past a limit the sheet can ever be pulled, however far the finger goes. */
const OVERSHOOT_PX = 72;

/**
 * Resistance past the outer rests.
 *
 * A sheet that stops dead reads as a broken gesture. Past a limit it follows the finger at about
 * half speed and then ever less, approaching but never reaching OVERSHOOT_PX: the rubber band of
 * a native scroll view.
 */
export function clampDrag(height: number, heights: DetentHeights): number {
  const band = (over: number) => OVERSHOOT_PX * (1 - 1 / (1 + (over * 0.55) / OVERSHOOT_PX));
  if (height > heights.full) return heights.full + band(height - heights.full);
  if (height < heights.peek) return heights.peek - band(heights.peek - height);
  return height;
}

/** The next rest up or down, for the handle's tap and for the keyboard. */
export function stepDetent(from: Detent, direction: number): Detent {
  const index = DETENTS.indexOf(from);
  if (index < 0) return DETENTS[0];
  return DETENTS[Math.min(Math.max(index + direction, 0), DETENTS.length - 1)]!;
}
