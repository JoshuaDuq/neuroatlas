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
 * Whether this WebGL renderer is an integrated / unified GPU.
 *
 * Discrete cards are named. Everything else — Apple Silicon, Intel iGPU,
 * a blocked UNMASKED_RENDERER, an empty string — is treated as integrated,
 * because that is the machine the fill-rate budget has to survive on.
 */
export function isIntegratedGpu(renderer = '') {
  const name = renderer.toLowerCase();
  if (!name) return true;
  if (/\bapple\b/.test(name)) return true;
  if (/\bnvidia\b|\bgeforce\b|\bquadro\b|\brtx\b|\bgtx\b/.test(name)) return false;
  if (/\bradeon\s+rx\b|\bradeon\s+pro\b/.test(name)) return false;
  if (/\bintel\s+arc\b/.test(name)) return false;
  return true;
}

/** The GPU name the driver reports, or empty when the browser withholds it. */
export function gpuRendererName(gl) {
  const info = gl?.getExtension?.('WEBGL_debug_renderer_info');
  if (!info) return '';
  return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
}

export function detectIntegratedGpu() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' })
      ?? canvas.getContext('webgl', { powerPreference: 'high-performance' });
    return isIntegratedGpu(gpuRendererName(gl));
  } catch {
    return true;
  }
}

/**
 * Device pixels per CSS pixel to render at.
 *
 * Two is the point past which more pixels stop being visible on any display.
 * A phone or tablet is held closer but carries a fraction of the fill rate,
 * and this scene costs passes over the geometry — two outlines —
 * before it reaches the screen. 1.5 renders 44% fewer pixels
 * than 2 for a softening that is hard to see at arm's length and easy to
 * feel in the hand.
 */
export function pixelRatioCap(integrated = false) {
  const device = globalThis.devicePixelRatio ?? 1;
  return Math.min(device, (isPhone() || isCoarse() || integrated) ? 1.5 : 2);
}
