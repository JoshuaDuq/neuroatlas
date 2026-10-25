import type { CutMode, FunctionalLevel, Hemisphere, SurfaceColor } from './display.ts';
import type { Explorer, Language } from './session.ts';

/** Camera position, target and optional up vector, in millimetres (state/url-state.js:96). */
export interface Orbit {
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
}

/** MRI level and window over the scan's uint8 intensities. */
export interface MriWindow {
  center: number;
  width: number;
}

/**
 * The shareable state `decodeState` reads from a link and `encodeState` writes.
 * Decoding yields a `Partial` of this: a field a link omits is absent.
 * `DEFAULTS` (state/url-state.js:8) lists the values encoding leaves out.
 */
export interface LinkState {
  hemisphere: Hemisphere;
  cortexVisible: boolean;
  cortexOpacity: number;
  internalVisible: boolean;
  spinalCordVisible: boolean;
  surfaceColor: SurfaceColor;
  functionalLevel: FunctionalLevel;
  view: string;
  cut: CutMode;
  cutOffset: number;
  cutReverse: boolean;
  cutTilt: number;
  cutAzimuth: number;
  selectedRegion: string | null;
  isolatedRegion: string | null;
  internalSystem: string | null;
  anatomy: string | null;
  atlas: string;
  cutAtlas: string;
  detail: string;
  explorer: Explorer;
  selectedFunction: string | null;
  selectedDeficit: string | null;
  circuit: string | null;
  circuitStep: number;
  orbit: Orbit | null;
  mriWindow: MriWindow | null;
  lang: Language;
  hiddenRegions: string[];
}
