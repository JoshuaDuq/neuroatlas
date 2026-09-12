/**
 * What kind of device is reading this, asked in one place.
 *
 * The phone query is written out rather than reduced to a width, because a
 * phone held sideways is 812 by 375: a `max-width` alone would hand a
 * landscape phone the desktop layout, which is the shape it has least room
 * for. Height catches it instead.
 *
 * CSS repeats this query literally in `styles/phone.css`; the two are kept in
 * step by hand, and the constant below is the copy the interface reasons about.
 */
export const PHONE_QUERY = '(max-width: 640px), (max-height: 480px) and (orientation: landscape)';

/** A phone-shaped viewport, in either orientation. */
export const isPhone = () => globalThis.matchMedia?.(PHONE_QUERY).matches ?? false;

/** A finger rather than a mouse. Drives hit-target size and the reticle. */
export const isCoarse = () => globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;

/** A phone held sideways, where the sheet belongs at the side rather than the foot. */
export const isLandscape = () =>
  globalThis.matchMedia?.('(orientation: landscape)').matches ?? false;

/**
 * Device pixels per CSS pixel to render at.
 *
 * Two is the point past which more pixels stop being visible on any display.
 * A phone or tablet is held closer but carries a fraction of the fill rate,
 * and this scene costs three passes over the geometry — occlusion and two
 * outlines — before it reaches the screen. 1.5 renders 44% fewer pixels
 * than 2 for a softening that is hard to see at arm's length and easy to
 * feel in the hand.
 */
export function pixelRatioCap() {
  const device = globalThis.devicePixelRatio ?? 1;
  return Math.min(device, (isPhone() || isCoarse()) ? 1.5 : 2);
}
