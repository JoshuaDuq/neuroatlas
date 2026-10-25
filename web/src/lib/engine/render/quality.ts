import { detectIntegratedGpu, isCoarse, isPhone, pixelRatioCap } from './device.ts';

/** `navigator.connection` and `deviceMemory` are not in lib.dom. */
interface NavigatorWithHints {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

export interface QualityInput {
  phone?: boolean;
  coarse?: boolean;
  saveData?: boolean;
  pixelRatio?: number;
  deviceMemory?: number;
  integrated?: boolean;
  appleSilicon?: boolean;
}

export interface QualityProfile {
  mriPixelRatio: number;
  pixelRatio: number;
  motionPixelRatio: number;
  msaaSamples: 2 | 4;
  prefetchLayers: boolean;
}

/**
 * How much GPU work this device can take without dropping frames.
 *
 * The anatomy stays full resolution on every device. Only the presentation
 * — pixel ratio, MSAA, whether to prefetch the other atlas — scales.
 * Labels, coordinates and triangle counts do not.
 */
export function qualityProfile(input: QualityInput = {}): QualityProfile {
  const hints = globalThis.navigator as NavigatorWithHints | undefined;
  const phone = input.phone ?? isPhone();
  const coarse = input.coarse ?? isCoarse();
  const saveData = input.saveData ?? Boolean(hints?.connection?.saveData);
  const pixelRatio = input.pixelRatio ?? globalThis.devicePixelRatio ?? 1;
  const deviceMemory = input.deviceMemory ?? hints?.deviceMemory ?? 8;
  const integrated = input.integrated ?? detectIntegratedGpu();
  const fewerPixels = integrated && !input.appleSilicon;
  const handheld = phone || coarse;
  const constrained = handheld || saveData || deviceMemory <= 4;
  const fillBound = constrained || integrated;
  // A phone renders one CSS pixel. Tablets stay at 1.5. The meshes do not change.
  const presentationCap = phone ? 1 : handheld || fewerPixels ? 1.5 : 2;
  const settledRatio =
    input.pixelRatio !== undefined
      ? Math.min(pixelRatio, presentationCap)
      : pixelRatioCap(fewerPixels);
  return {
    mriPixelRatio: pixelRatio,
    pixelRatio: settledRatio,
    // Fill is most of a Retina frame; a picture in motion cannot show the extra pixels anyway.
    motionPixelRatio: Math.min(settledRatio, 1),
    msaaSamples: fillBound ? 2 : 4,
    prefetchLayers: !fillBound,
  };
}

// Device pixels a frame in motion may fill; a 1440×900 window's stage is about 0.9 M at 1×.
const MOTION_PIXEL_BUDGET = 2_000_000;

/** The pixel ratio for a moving camera on a canvas of this CSS size, at most `cap`. */
export function motionRatio(cap: number, width: number, height: number): number {
  if (!width || !height) return cap;
  return Math.round(Math.min(cap, Math.sqrt(MOTION_PIXEL_BUDGET / (width * height))) * 100) / 100;
}
