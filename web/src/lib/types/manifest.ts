import type { Region } from './region.ts';

type Matrix4 = readonly (readonly number[])[];

/** A file the manifest points at, as `fetchAsset` loads it. */
export interface ManifestFile {
  file: string;
  sha256?: string;
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
  glass_opacity?: number;
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
  volumes?: ManifestFile;
  tissues?: ManifestFile;
  atlas_comparison?: ManifestFile;
  boundary_convention?: string;
  limitations?: string[];
  provenance?: Record<string, unknown>;
}
