/**
 * The part of the canvas that interface chrome does not cover.
 *
 * On a phone the sheet sits over the canvas rather than beside it, so the
 * canvas is full-bleed while only part of it is visible. Resizing the canvas
 * as the sheet moves would reallocate the composer target
 * and both outline passes on every drag frame, so the canvas keeps its size
 * and the camera is told where the reader can actually see instead.
 *
 * Everything that must agree about "where the viewport is" derives from
 * `visibleRect`: framing, the orientation markers, the view presets and the
 * scale bar. One rectangle, one source of truth.
 *
 * Pure: no DOM, no Three.js.
 */

/** Chrome insets clamped so they can never consume the canvas entirely. */
export function visibleRect(canvas, insets = {}) {
  const { width = 0, height = 0 } = canvas ?? {};
  if (!(width > 0) || !(height > 0)) return { x: 0, y: 0, width: 0, height: 0 };

  const want = {
    top: Math.max(0, insets.top ?? 0),
    right: Math.max(0, insets.right ?? 0),
    bottom: Math.max(0, insets.bottom ?? 0),
    left: Math.max(0, insets.left ?? 0),
  };

  // A sheet dragged to full height would otherwise leave a zero or negative
  // rectangle, and every consumer would divide by it. A tenth of the canvas
  // is kept on each axis, so the framing stays finite even when the reader
  // has covered the model.
  const minimum = { x: width * 0.1, y: height * 0.1 };
  const scale = axis => {
    const [near, far, span, floor] = axis === 'x'
      ? [want.left, want.right, width, minimum.x]
      : [want.top, want.bottom, height, minimum.y];
    const requested = near + far;
    const allowed = span - floor;
    return requested > allowed && requested > 0 ? allowed / requested : 1;
  };

  const sx = scale('x');
  const sy = scale('y');
  const left = want.left * sx;
  const right = want.right * sx;
  const top = want.top * sy;
  const bottom = want.bottom * sy;

  return {
    x: left,
    y: top,
    width: width - left - right,
    height: height - top - bottom,
  };
}

/**
 * How much of the frustum the visible rectangle spans, per axis.
 *
 * `frameBounds` multiplies its slopes by these, so anatomy is fitted to the
 * rectangle the reader can see rather than to the whole canvas.
 */
export function fitScale(canvas, rect) {
  const { width = 0, height = 0 } = canvas ?? {};
  if (!(width > 0) || !(height > 0)) return { horizontal: 1, vertical: 1 };
  return {
    horizontal: Math.min(1, (rect?.width ?? width) / width),
    vertical: Math.min(1, (rect?.height ?? height) / height),
  };
}

/**
 * Arguments for `PerspectiveCamera.setViewOffset` that slide the image so the
 * model sits in the middle of the visible rectangle.
 *
 * The frustum is shifted rather than the camera moved: moving the camera
 * would drag the orbit target off the anatomy, and orbiting would then swing
 * the model around a point beside it. A projection offset leaves the target
 * on the model, and the raycaster reads it back through
 * `projectionMatrixInverse`, so picking stays correct with no extra work.
 *
 * Returns null when the rectangle is already centred, so the caller can clear
 * the offset rather than set an identity one.
 */
export function viewOffset(canvas, rect) {
  const { width = 0, height = 0 } = canvas ?? {};
  if (!(width > 0) || !(height > 0) || !rect) return null;

  const dx = (rect.x + rect.width / 2) - width / 2;
  const dy = (rect.y + rect.height / 2) - height / 2;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;

  // Negated: a frustum shifted left moves the image right. Negative zero is
  // normalised away so a caller comparing offsets never sees -0 and 0 differ.
  const negate = value => (value === 0 ? 0 : -value);
  return {
    fullWidth: width, fullHeight: height,
    offsetX: negate(dx), offsetY: negate(dy),
    width, height,
  };
}

/**
 * Framing that keeps the anatomy off the stage's markings.
 *
 * `rect` is the visible rectangle, `dock` how far the dock reaches up into it, `clear` the room
 * the orientation letters and scale bar take at each edge, and `fill` the share of the room over
 * the dock that framing spans when the markings are not in the way. The scene centres the image
 * above `inset`; scaling its fit by `scale` puts the anatomy inside the band the markings leave.
 */
export function clearFraming({ width, height }, dock, clear, fill) {
  const inset = Math.max(0, dock + clear.bottom - clear.top);
  const centre = (height - inset) / 2;
  const room = fill * Math.max(0, height - dock) / 2;
  // A stage too short for its markings keeps a sliver of anatomy rather than none.
  const half = Math.max(room / 4, Math.min(room, centre - clear.top, height - dock - clear.bottom - centre));
  const across = Math.max(fill * width / 8, Math.min(fill * width / 2, width / 2 - Math.max(clear.left, clear.right)));
  return {
    inset,
    scale: {
      horizontal: width > 0 ? across / (fill * width / 2) : 1,
      vertical: centre > 0 && half > 0 ? half / (fill * centre) : 1,
    },
  };
}
