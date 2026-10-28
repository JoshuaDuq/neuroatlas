import cdmdRecords from '../../../../../data/diffusion-cdmd.yaml';
import type { Translated } from '../clinical/types.ts';

/** A scalar map shown beside the tracts (T1, FA). */
export interface TractMap {
  id: string;
  file: string;
  name: Translated;
  colormap: string;
  range: readonly [number, number];
  opacity: number;
}

/** The anatomical fibre classes, in the order the Tracts list shows them. */
export const TRACT_CLASSES = ['association', 'projection', 'commissural'] as const;
export type TractClass = (typeof TRACT_CLASSES)[number];

export interface TractBundle {
  id: string;
  file: string;
  name: Translated;
  class: TractClass;
  /** A numbered segment's anatomical part (TractSeg's CC_1–CC_7). */
  segment?: Translated;
  initial?: boolean;
}

/** One diffusion dataset's catalog (`data/diffusion-*.yaml`), as authored. */
export interface TractCatalog {
  id: string;
  name: Translated;
  source: string;
  license: string;
  provenance: string;
  anatomy: string;
  reference_space: string;
  overlay_cortex_opacity: number;
  resample_step_mm: number;
  text: Readonly<Record<'en' | 'fr', Readonly<Record<string, string>>>>;
  brain_outline: {
    file: string;
    provenance: string;
    source: string;
    intensity_threshold: number;
    step_size: number;
    opacity: number;
  };
  maps: readonly TractMap[];
  bundles: readonly TractBundle[];
}

const cdmd = cdmdRecords as TractCatalog;

/** Every tract catalog; config/model.yaml's tract_catalogs names the same files. */
export const TRACT_CATALOGS: readonly TractCatalog[] = [cdmd];

/** An anatomy's own tracts, or CDMD's as an independent reference for one without. */
export function tractCatalog(anatomy: string): TractCatalog {
  return TRACT_CATALOGS.find((catalog) => catalog.anatomy === anatomy) ?? cdmd;
}
