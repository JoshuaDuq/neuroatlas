import { Color, SRGBColorSpace } from 'three';
import type { DisplaySettings, Region, RegionHemisphere, Rgb } from '../../types/index.ts';
import { dominantNetwork } from '../../core/catalog/networks.ts';
import type { CabNpPartition } from '../../core/catalog/networks.ts';
import { internalSystemAllows } from '../../core/catalog/visibility.ts';
import { tissueColor } from '../render/materials.ts';
import type { TissuePalette } from '../render/materials.ts';
import type { NetworkMetadata } from '../render/network-colors.ts';

/** One entry of a cut atlas's label table (`tissue-labels.json`). */
export interface Label {
  source_label_id: number;
  region_id: string | null;
  kind: string;
  hemisphere: RegionHemisphere;
  color: Rgb;
  name?: string;
}

/** The display settings a label's colour and visibility depend on. */
export type PaletteState = DisplaySettings;

/** The catalog data a label's colour can come from. */
export interface PaletteLookup {
  regions?: ReadonlyMap<string, Region>;
  networks?: Pick<NetworkMetadata, 'colors'>;
  cabNp?: CabNpPartition;
  /** The arterial territories' palette, by territory id. */
  territories?: readonly { id: string; color: Rgb }[];
}

export function labelVisible(label: Label, state: PaletteState, lookup?: PaletteLookup): boolean {
  if (label.region_id != null && state.hiddenRegions?.has(label.region_id)) return false;
  const region = label.region_id == null ? undefined : lookup?.regions?.get(label.region_id);
  if (region && !internalSystemAllows(region, state)) return false;
  if (label.source_label_id === 0 && label.kind !== 'cortex') return false;
  if (state.isolatedRegion) return label.region_id === state.isolatedRegion;
  if (
    state.hemisphere !== 'both' &&
    label.hemisphere !== 'midline' &&
    label.hemisphere !== state.hemisphere
  )
    return false;
  if (label.kind === 'cortex' || [2, 41].includes(label.source_label_id)) {
    return state.cortexVisible && state.cortexOpacity > 0;
  }
  return true;
}

/** Whether a cut face shows the parcellation's own published colours. */
export const usesAtlasColors = (state: Pick<PaletteState, 'surfaceColor'>) =>
  state.surfaceColor === 'atlas';

/** Whether a cut face carries the network colours the surface is carrying. */
export const usesNetworkColors = (state: Pick<PaletteState, 'surfaceColor'>) =>
  state.surfaceColor === 'network';

/** Whether a cut face carries the arterial territory colours the surface is carrying. */
export const usesTerritoryColors = (state: Pick<PaletteState, 'surfaceColor'>) =>
  state.surfaceColor === 'territory';

/** Whether a cut face carries CAB-NP's colours, which only HCP-MMP's areas have. */
export const usesCabNpColors = (state: Pick<PaletteState, 'surfaceColor'>) =>
  state.surfaceColor === 'cab-np';

/** Whether a panel's paint is drawn over the surface colour, on a cut face as on the surface. */
export const usesPaint = (state: Pick<PaletteState, 'paint'>) => Boolean(state.paint);

/** A published sRGB colour, converted the way the surfaces' glTF factors are. */
const setPublished = (color: Color, [red, green, blue]: Rgb) =>
  color.setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace);

/*
 * The network a cut voxel is painted with.
 *
 * The surface field is per vertex; a label volume has one code per parcel, so
 * a cut can only be coloured by the network that holds most of that parcel.
 * A region split between two networks therefore reads as one colour on the
 * cut and as both on the surface — the cut status says so.
 *
 * Kind is not the test: NextBrain cortical parcels are cut-only tissue
 * labels, but they still have a region record and, when the build has
 * measured them, the same network shares. A region in no network — nuclei,
 * white matter, the medial wall — keeps its tissue colour.
 */
function networkColor(label: Label, { regions, networks }: PaletteLookup = {}): Rgb | null {
  if (!label.region_id) return null;
  const name = dominantNetwork(regions?.get(label.region_id) ?? {});
  return name ? (networks?.colors?.[name] ?? null) : null;
}

/*
 * The territory a cut voxel is painted with. The arterial cut labels are territories themselves
 * and keep their own colour, and with them on the cut nothing else is recoloured: a voxel the atlas
 * leaves out, or a fluid space, shows its tissue. With other cut labels a region is painted, like
 * networks, with the territory holding most of it, and only when one holds a majority.
 */
const TERRITORY_MAJORITY = 0.5;

function territoryColor(
  label: Label,
  state: PaletteState,
  { regions, territories }: PaletteLookup = {},
): Rgb | null {
  if (!label.region_id || !territories) return null;
  const region = regions?.get(label.region_id);
  if (region?.atlas === 'arterial') return label.color;
  if (state.cutAtlas === 'arterial') return null;
  const largest = region?.territories?.[0];
  if (!largest || largest.fraction < TERRITORY_MAJORITY) return null;
  const entry = territories.find((candidate) => candidate.id === largest.territory);
  if (!entry) throw new Error(`No arterial territory ${largest.territory} is published.`);
  return entry.color;
}

/**
 * What one label looks like, whether a voxel cut or a solid cap paints it.
 *
 * Both paths read this, so a parcel cannot come out one colour on a sampled
 * cut face and another on a geometric one.
 */
export function labelAppearance(
  label: Label,
  state: PaletteState,
  tissuePalette: TissuePalette,
  lookup?: PaletteLookup,
  color = new Color(),
): { color: Color; visible: boolean } {
  // Published colours are sRGB; the surfaces' glTF factors decode to the same.
  setPublished(color, label.color);
  if (!usesAtlasColors(state)) {
    color.set(tissueColor({ ...label, source_name: label.name }, tissuePalette));
  }
  if (usesNetworkColors(state)) {
    const channels = networkColor(label, lookup);
    // Published sRGB, converted the same way the surface converts it, so a
    // parcel reads as one colour whether it is met on the cut or the surface.
    if (channels) setPublished(color, channels);
  }
  if (usesTerritoryColors(state)) {
    const channels = territoryColor(label, state, lookup);
    if (channels) setPublished(color, channels);
  }
  const cabNpNetwork =
    usesCabNpColors(state) && label.region_id ? lookup?.cabNp?.regions[label.region_id] : null;
  if (cabNpNetwork) {
    setPublished(color, lookup!.cabNp!.colors[cabNpNetwork]!);
  }
  if (state.paint) {
    const painted = label.region_id ? state.paint.colors.get(label.region_id) : undefined;
    if (painted) setPublished(color, painted);
    else color.set(tissueColor({ ...label, source_name: label.name }, tissuePalette));
  }
  if (label.kind === 'cortex' && !label.region_id) color.set(tissuePalette.unlabelled);
  return { color, visible: labelVisible(label, state, lookup) };
}

/** Palette is independent of slice position, so dragging never rebuilds it. */
export function createPalette(
  labels: readonly Label[],
  state: PaletteState,
  tissuePalette: TissuePalette,
  lookup?: PaletteLookup,
): Float32Array {
  const palette = new Float32Array(labels.length * 4);
  const color = new Color();
  for (const [code, label] of labels.entries()) {
    const { visible } = labelAppearance(label, state, tissuePalette, lookup, color);
    palette.set([color.r, color.g, color.b, Number(visible)], code * 4);
  }
  return palette;
}
