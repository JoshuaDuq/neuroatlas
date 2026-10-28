import type {
  CUTS,
  FUNCTIONAL_LEVELS,
  HEMISPHERES,
  SURFACE_COLORS,
  VIEW_NAMES,
} from './constants.ts';
import type { Paint } from './paint.ts';
import type { Region } from './region.ts';

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
  internalConstituents: ReadonlySet<string>;
  /** Null until the sections module sets it (brain-atlas.js:184). */
  cutAtlas: string | null;
  cutActive: boolean;
  hemisphere: Hemisphere;
  cortexVisible: boolean;
  cortexOpacity: number;
  internalVisible: boolean;
  spinalCordVisible: boolean;
  surfaceColor: SurfaceColor;
  paint: Paint | null;
  isolatedRegion: string | null;
  hiddenRegions: ReadonlySet<string>;
  dissectionCanUndo: boolean;
}

/** The model's state (`BrainAtlas.state`, model/brain-atlas.js:501): its settings and what is on screen. */
export interface ModelState extends DisplaySettings {
  selectedRegion: Region | null;
  visibleMeshCount: number;
}
