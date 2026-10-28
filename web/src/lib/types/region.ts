import type { Rgb } from './paint.ts';

export type RegionHemisphere = 'left' | 'right' | 'midline';
export type RegionKind = 'cortex' | 'structure' | 'non-region' | 'tissue-region';

/** Per-language text, keyed by language code. */
export type Localised = Readonly<Record<string, string>>;

/**
 * One entry of the manifest's `regions`. `validateManifest` (model/brain-atlas.js:84)
 * requires `id`, `label`, `hemisphere` and `kind`; the rest depends on the layer the region comes from.
 */
export interface Region {
  id: string;
  label: string;
  hemisphere: RegionHemisphere;
  kind: RegionKind;
  source_name?: string;
  atlas?: string;
  source_label_id?: number | null;
  source_label_ids?: number[];
  source_annotation_value?: number;
  source_vertex_count?: number;
  source_published_name?: string;
  source_atlas?: string;
  networks?: { network: string; fraction: number }[];
  /** Typical arterial territory shares of the region's voxels or vertices, largest first. */
  territories?: { territory: string; fraction: number }[];
  /** The share of the region in no territory, counted, so slivers left out of `territories` are not in it. */
  territory_unassigned?: number;
  vertex_count?: number;
  triangle_count?: number;
  surface_area_mm2?: number;
  voxel_count?: number;
  voxel_size_mm?: number[];
  display_maximum_displacement_mm?: number;
  segmentation_volume_mm3?: number;
  constituent_regions?: string[];
  display_names?: Localised;
  system_names?: Localised;
  display_color?: Rgb;
  family?: string | null;
  family_order?: number | null;
  family_names?: Localised | null;
  aliases?: Readonly<Record<string, string[]>>;
  notes?: Localised;
  cut_atlases?: string[];
  supplemental?: boolean;
  mri_registered?: boolean;
  tissue?: string;
}
