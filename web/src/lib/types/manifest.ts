import type { Rgb } from './paint.ts';
import type { Region } from './region.ts';

type Matrix4 = readonly (readonly number[])[];

/** A file the manifest points at, as `fetchAsset` loads it. */
export interface ManifestFile {
  file: string;
  sha256?: string;
}

/** A published label grid (`slices/volume.ts` reads it). */
export interface ManifestVolume extends ManifestFile {
  sha256: string;
  decoded_sha256: string;
  byte_length: number;
  dtype: string;
  shape: readonly number[];
  order: string;
  voxel_to_surface_ras_mm: readonly (readonly number[])[];
}

export interface ManifestAtlas {
  id: string;
  label: string;
  annotation: string;
  citation: string;
  license_file?: string;
  file: string;
  region_count: number;
  surface_shading?: Record<string, unknown>;
  ribbon_labels?: Record<string, unknown>;
}

export interface ManifestSourceGrid {
  voxel_to_surface_ras_mm: Matrix4;
  voxel_size_mm: readonly number[];
}

export interface ManifestDetailLevel {
  id: string;
  label: string;
  file: string;
  region_count: number;
  /** Absent on a level built from several source grids (`learning`). */
  voxel_to_surface_ras_mm?: Matrix4;
  voxel_size_mm?: readonly number[];
  source_grids?: Record<string, ManifestSourceGrid>;
  palette_method?: string;
  display_geometry: Record<string, unknown>;
}

export interface ManifestCutAtlas {
  id: string;
  label: string;
  citation: string;
  procedure?: string;
  surface: boolean;
}

export interface ManifestSupplementalLayer {
  id: string;
  label: string;
  file: string;
  region_count: number;
  sha256: string;
  citations: string[];
  license: string;
  license_file: string;
  attribution: string;
  /** Two opposite corners, `[min, max]` (slices/sections.js:117). */
  bounds_ras_mm: readonly [readonly number[], readonly number[]];
  /** The vertebral levels the cord reaches, top to bottom. */
  vertebral_levels: string[];
}

export interface ManifestAppearance {
  tissue: Record<string, string | number>;
  folds: Record<string, unknown>;
  see_through_opacity?: number;
  intensity?: Record<string, unknown>;
  lighting?: Record<string, unknown>;
  occlusion?: Record<string, unknown>;
  field_ranges?: Record<string, unknown>;
}

export interface ManifestAnatomy {
  id: string;
  subject: string;
  display_name: string;
  label: string;
  individual: boolean;
  source_url?: string;
  reconstruction?: string;
  hcp_projected_from?: string;
}

/**
 * `manifest.json` as `validateManifest` (model/brain-atlas.js:75) accepts it.
 * Sections that only some anatomies publish are optional.
 */
export interface Manifest {
  schema_version: 1;
  atlases: ManifestAtlas[];
  regions: Region[];
  detail_levels: ManifestDetailLevel[];
  appearance: ManifestAppearance;
  solid_envelopes: ManifestFile & { source?: string };
  anatomy: ManifestAnatomy;
  coordinate_system?: Record<string, unknown>;
  cut_atlases?: ManifestCutAtlas[];
  supplemental_layers?: ManifestSupplementalLayer[];
  networks?: Record<string, unknown>;
  cab_np?: ManifestFile & Record<string, unknown>;
  functional_regions?: ManifestFile & Record<string, unknown>;
  neuropsych_domains?: ManifestFile & Record<string, unknown>;
  neurosynth_terms?: ManifestFile & Record<string, unknown>;
  boundary_certainty?: ManifestFile & Record<string, unknown>;
  /** The comparison's file, and the compared NextBrain volume on aseg's grid. */
  segmentation_agreement?: ManifestFile & { volume: ManifestVolume } & Record<string, unknown>;
  arterial_territories?: ArterialTerritories;
  cerebellar_functions?: CerebellarFunctions;
  receptor_fingerprints?: ManifestFile & Record<string, unknown>;
  volumes?: ManifestFile;
  tissues?: ManifestFile;
  atlas_comparison?: ManifestFile;
  atlas_comparisons?: (ManifestFile & { atlases: readonly [string, string] })[];
  boundary_convention?: string;
  limitations?: string[];
  provenance?: Record<string, unknown>;
}

/** One functional region of the cerebellar atlas, the same on both sides. */
export interface CerebellarFunctionRegion {
  id: string;
  domain: string;
  name: string;
  name_fr: string;
  description: string;
  description_fr: string;
  color: Rgb;
}

/** `manifest.cerebellar_functions`: the registered Nettekoven et al. (2024) group atlas. */
export interface CerebellarFunctions {
  id: 'nettekoven';
  label: string;
  citation: string;
  license: string;
  domains: Record<string, { name: string; name_fr: string }>;
  regions: CerebellarFunctionRegion[];
  registration: Record<string, unknown>;
  method: string;
}

/** One branch territory of the arterial territory atlas. */
export interface ArterialTerritory {
  id: string;
  major: string;
  name: string;
  name_fr: string;
  color: Rgb;
}

/** `manifest.arterial_territories`: the registered Liu et al. (2023) atlas and its palette. */
export interface ArterialTerritories {
  id: 'arterial';
  label: string;
  citation: string;
  license: string;
  attribute: '_TERRITORY';
  major: Record<string, { name: string; name_fr: string; short: string }>;
  territories: ArterialTerritory[];
  registration: Record<string, unknown>;
  method: string;
}
