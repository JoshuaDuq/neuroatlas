import { detectIntegratedGpu, isCoarse, isPhone, pixelRatioCap } from './device.js';

/**
 * How much GPU work this device can take without dropping frames.
 *
 * The anatomy stays full resolution on every device. Only the presentation
 * — pixel ratio, MSAA, whether to prefetch the other atlas — scales.
 * Labels, coordinates and triangle counts do not.
 */
export function qualityProfile(input = {}) {
  const connection = globalThis.navigator?.connection;
  const phone = input.phone ?? isPhone();
  const coarse = input.coarse ?? isCoarse();
  const saveData = input.saveData ?? Boolean(connection?.saveData);
  const pixelRatio = input.pixelRatio ?? (globalThis.devicePixelRatio ?? 1);
  const deviceMemory = input.deviceMemory ?? (globalThis.navigator?.deviceMemory ?? 8);
  const integrated = input.integrated ?? detectIntegratedGpu();
  const fewerPixels = integrated && !input.appleSilicon;
  const handheld = phone || coarse;
  const constrained = handheld || saveData || deviceMemory <= 4;
  const fillBound = constrained || integrated;
  // A phone renders one CSS pixel. Tablets stay at 1.5. The meshes do not change.
  const presentationCap = phone ? 1 : (handheld || fewerPixels) ? 1.5 : 2;
  return {
    mriPixelRatio: pixelRatio,
    pixelRatio: input.pixelRatio !== undefined
      ? Math.min(pixelRatio, presentationCap)
      : pixelRatioCap(fewerPixels),
    msaaSamples: fillBound ? 2 : 4,
    prefetchLayers: !fillBound,
  };
}
