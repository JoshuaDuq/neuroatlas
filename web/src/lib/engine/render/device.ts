/**
 * What kind of device is reading this, asked in one place.
 *
 * The compact interface query (`PHONE_QUERY`, in the shared constants) includes tablets and
 * narrow desktop windows. A phone held sideways is 812 by 375: a `max-width` alone would hand a
 * landscape phone the desktop layout, which is the shape it has least room for. Height catches
 * it instead. The narrower phone device query stays separate so changing the panel layout does
 * not lower rendering quality or change MRI defaults.
 */
import { COARSE_POINTER_QUERY, PHONE_DEVICE_QUERY } from '../../types/constants.ts';

/** A phone-shaped viewport, in either orientation. */
export const isPhone = (): boolean => globalThis.matchMedia?.(PHONE_DEVICE_QUERY).matches ?? false;

/** A finger rather than a mouse. Drives hit-target size. */
export const isCoarse = (): boolean =>
  globalThis.matchMedia?.(COARSE_POINTER_QUERY).matches ?? false;

/**
 * Whether this WebGL renderer is an integrated / unified GPU.
 *
 * Discrete cards are named. Everything else — Apple Silicon, Intel iGPU,
 * a blocked UNMASKED_RENDERER, an empty string — is treated as integrated,
 * because that is the machine the fill-rate budget has to survive on.
 */
export function isIntegratedGpu(renderer = ''): boolean {
  const name = renderer.toLowerCase();
  if (!name) return true;
  if (/\bapple\b/.test(name)) return true;
  if (/\bnvidia\b|\bgeforce\b|\bquadro\b|\brtx\b|\bgtx\b/.test(name)) return false;
  if (/\bradeon\s+rx\b|\bradeon\s+pro\b/.test(name)) return false;
  if (/\bintel\s+arc\b/.test(name)) return false;
  return true;
}

/**
 * Apple silicon is integrated too, but draws a Mac display's full density:
 * measured on an M5, orbiting holds 60 fps and a cut misses about one frame in
 * twenty. MSAA stays at 2x, because 4x halved the frame rate of an MRI cut.
 */
export function isAppleSilicon(renderer = ''): boolean {
  return /\bapple\b/i.test(renderer);
}

/** The GPU name the driver reports, or empty when the browser withholds it. */
export function gpuRendererName(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined,
): string {
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  if (!gl || !info) return '';
  return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
}

/**
 * Whether the machine's GPU is integrated, read from a throwaway WebGL context. The context is
 * released once the name is read: browsers cap live contexts, and this probe runs on every call.
 * Errors propagate (see docs/decisions/deviations/e1-render-primitives.md).
 */
export function detectIntegratedGpu(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const gl =
    canvas.getContext('webgl2', { powerPreference: 'high-performance' }) ??
    canvas.getContext('webgl', { powerPreference: 'high-performance' });
  const integrated = isIntegratedGpu(gpuRendererName(gl));
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return integrated;
}

/**
 * Device pixels per CSS pixel to render at.
 *
 * Two is the point past which more pixels stop being visible on any display.
 * A phone or tablet is held closer but carries a fraction of the fill rate,
 * and this scene costs passes over the geometry — two outlines —
 * before it reaches the screen. 1.5 renders 44% fewer pixels
 * than 2 for a softening that is hard to see at arm's length and easy to
 * feel in the hand. A phone is capped at one: the same softening again,
 * which is what keeps a drag on the refresh.
 */
export function pixelRatioCap(integrated = false): number {
  const device = globalThis.devicePixelRatio ?? 1;
  const cap = isPhone() ? 1 : isCoarse() || integrated ? 1.5 : 2;
  return Math.min(device, cap);
}
