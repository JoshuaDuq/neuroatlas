import type { CutMode, Hemisphere, SurfaceColor } from './display.ts';
import type { Region } from './region.ts';
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
 * The shareable state `decodeState` returns (state/url-state.js:220), as a `Partial`:
 * a field a link omits is absent. `DEFAULTS` (state/url-state.js:8) lists the values
 * encoding leaves out.
 */
export interface LinkState {
  hemisphere: Hemisphere;
  cortexVisible: boolean;
  cortexOpacity: number;
  internalVisible: boolean;
  spinalCordVisible: boolean;
  surfaceColor: SurfaceColor;
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

/**
 * What `encodeState` takes (state/url-state.js:201; app.js:1773 spreads `model.state`):
 * the selected region may be the model's record, and the hidden regions are a set,
 * since `encodeState` reads `.size`.
 */
export interface LinkInput extends Omit<LinkState, 'selectedRegion' | 'hiddenRegions'> {
  selectedRegion: Region | string | null;
  hiddenRegions: ReadonlySet<string>;
}
