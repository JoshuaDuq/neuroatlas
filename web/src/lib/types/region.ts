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
  /** A Schaefer parcel's name in the 17-network order, which divides the same parcels. */
  source_17_network_name?: string;
  source_atlas?: string;
  networks?: { network: string; fraction: number }[];
  /** Typical arterial territory shares of the region's voxels or vertices, largest first. */
  territories?: { territory: string; fraction: number }[];
  /** The share of the region in no territory, counted, so slivers left out of `territories` are not in it. */
  territory_unassigned?: number;
  /** A cerebellar lobule's shares in each functional region of the registered group atlas, largest first. */
  cerebellar_functions?: { region: string; fraction: number }[];
  /** The share of the lobule in no functional region, counted rather than inferred. */
  cerebellar_functions_unassigned?: number;
  vertex_count?: number;
  triangle_count?: number;
  surface_area_mm2?: number;
  voxel_count?: number;
  voxel_size_mm?: number[];
  display_maximum_displacement_mm?: number;
  segmentation_volume_mm3?: number;
  /** The mean of its voxel centres (a cortical parcel's, in the ribbon), surface RAS mm. */
  centroid_ras_mm?: [number, number, number];
  /** Its own voxel nearest that centroid, surface RAS mm: inside it, as a centroid may not be. */
  anchor_ras_mm?: [number, number, number];
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
