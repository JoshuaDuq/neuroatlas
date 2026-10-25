import type {
  CUTS,
  FUNCTIONAL_LEVELS,
  HEMISPHERES,
  SURFACE_COLORS,
  VIEW_NAMES,
} from './constants.ts';
import type { Paint } from './paint.ts';

export type ViewName = (typeof VIEW_NAMES)[number];
export type CutMode = (typeof CUTS)[number];
export type SurfaceColor = (typeof SURFACE_COLORS)[number];
export type FunctionalLevel = (typeof FUNCTIONAL_LEVELS)[number];
export type Hemisphere = (typeof HEMISPHERES)[number];

/** The display settings (`BrainAtlas.settings`, model/brain-atlas.js:480). */
export interface DisplaySettings {
  atlas: string;
  detail: string;
  internalSystem: string | null;
  internalConstituents: boolean;
  cutAtlas: string;
  cutActive: boolean;
  hemisphere: Hemisphere;
  cortexVisible: boolean;
  cortexOpacity: number;
  internalVisible: boolean;
  spinalCordVisible: boolean;
  surfaceColor: SurfaceColor;
  functionalLevel: FunctionalLevel;
  paint: Paint | null;
  isolatedRegion: string | null;
  hiddenRegions: ReadonlySet<string>;
  dissectionCanUndo: boolean;
}
