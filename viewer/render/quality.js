import { detectIntegratedGpu, isCoarse, isPhone, pixelRatioCap } from './device.js';

/**
 * How much GPU work this device can take without dropping frames.
 *
 * The anatomy stays full resolution on every device. Only the presentation
 * — pixel ratio, MSAA, ambient occlusion, whether to prefetch the other
 * atlas — scales. Labels, coordinates and triangle counts do not.
 *
 * GTAO is a look, not a fill-rate lever: it stays on wherever it already
 * did. Integrated GPUs (Apple Silicon, Intel iGPU) still cannot afford a
 * 2× retina buffer and 4× MSAA on top of it, so those drop independently.
 */
export function qualityProfile(input = {}) {
  const connection = globalThis.navigator?.connection;
  const phone = input.phone ?? isPhone();
  const coarse = input.coarse ?? isCoarse();
  const saveData = input.saveData ?? Boolean(connection?.saveData);
  const pixelRatio = input.pixelRatio ?? (globalThis.devicePixelRatio ?? 1);
  const deviceMemory = input.deviceMemory ?? (globalThis.navigator?.deviceMemory ?? 8);
  const integrated = input.integrated ?? detectIntegratedGpu();
  const handheld = phone || coarse;
  const constrained = handheld || saveData || deviceMemory <= 4;
  const fillBound = constrained || integrated;
  return {
    pixelRatio: input.pixelRatio !== undefined
      ? Math.min(pixelRatio, handheld || integrated ? 1.5 : 2)
      : pixelRatioCap(integrated),
    msaaSamples: fillBound ? 2 : 4,
    occlusion: !constrained,
    occlusionScale: 1,
    occlusionSamples: constrained ? 8 : 32,
    prefetchLayers: !fillBound,
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
