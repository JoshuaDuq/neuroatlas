import { isCoarse, isPhone, pixelRatioCap } from './device.js';

/**
 * How much GPU work this device can take without dropping frames.
 *
 * The anatomy stays full resolution on every device. Only the presentation
 * — pixel ratio, MSAA, ambient occlusion, whether to prefetch the other
 * atlas — scales. Labels, coordinates and triangle counts do not.
 *
 * A tablet is not a phone for layout, but it is for fill rate: GTAO is a
 * full extra pass over every region mesh, and an iPad at 2× is more pixels
 * than a laptop. Coarse pointer is the test, not width.
 */
export function qualityProfile(input = {}) {
  const connection = globalThis.navigator?.connection;
  const phone = input.phone ?? isPhone();
  const coarse = input.coarse ?? isCoarse();
  const saveData = input.saveData ?? Boolean(connection?.saveData);
  const pixelRatio = input.pixelRatio ?? (globalThis.devicePixelRatio ?? 1);
  const deviceMemory = input.deviceMemory ?? (globalThis.navigator?.deviceMemory ?? 8);
  const handheld = phone || coarse;
  const constrained = handheld || saveData || deviceMemory <= 4;
  return {
    pixelRatio: input.pixelRatio !== undefined
      ? Math.min(pixelRatio, handheld ? 1.5 : 2)
      : pixelRatioCap(),
    msaaSamples: constrained ? 2 : 4,
    occlusion: !constrained,
    occlusionScale: 1,
    occlusionSamples: constrained ? 8 : 32,
    prefetchLayers: !constrained,
  };
}

/**
 * Fold shading is part of the anatomy, not a decoration that can drop out
 * when the pointer goes down. Cuts and translucent cortex are the only
 * cases that cannot keep a single opaque depth buffer, matching the
 * original composer rule.
 */
export function occlusionActive({ enabled, transparent, sections }) {
  return Boolean(enabled && !transparent && !sections);
}
