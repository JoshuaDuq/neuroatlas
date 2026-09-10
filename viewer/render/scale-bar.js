/**
 * A scale bar for the viewport, in true anatomical millimetres.
 *
 * The model carries real scale in metres, so the bar is a measurement rather
 * than a decoration. Lengths snap to a 1-2-5 sequence: an arbitrary "37 mm"
 * is the mark of a scale bar nobody designed, and a reader cannot subdivide
 * it by eye.
 */
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

const MIN_PIXELS = 60;
const MAX_PIXELS = 150;

/**
 * Millimetres spanned by one pixel at the distance the camera is focused on.
 * Only correct at that depth, which is where the anatomy of interest sits.
 */
export function millimetresPerPixel(fovDegrees, distanceMetres, viewportHeightPx) {
  const visibleMetres = 2 * distanceMetres * Math.tan((fovDegrees * Math.PI) / 360);
  return (visibleMetres * 1000) / viewportHeightPx;
}

/**
 * The largest 1-2-5 length whose bar fits the pixel window. The window spans
 * a factor of 2.5, which is the widest gap in the sequence, so some step
 * always fits.
 */
export function scaleBar(fovDegrees, distanceMetres, viewportHeightPx) {
  const perPixel = millimetresPerPixel(fovDegrees, distanceMetres, viewportHeightPx);
  let chosen = STEPS[0];
  for (const step of STEPS) {
    const pixels = step / perPixel;
    if (pixels > MAX_PIXELS) break;
    if (pixels >= MIN_PIXELS) chosen = step;
  }
  return { millimetres: chosen, pixels: chosen / perPixel };
}
