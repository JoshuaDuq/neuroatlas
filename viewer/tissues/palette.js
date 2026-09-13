import { Color, SRGBColorSpace } from 'three';
import { tissueColor } from '../render/materials.js';
import { dominantNetwork } from '../catalog/networks.js';

export function labelVisible(label, state) {
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
export const usesAtlasColors = state => state.surfaceColor === 'atlas';

/** Whether a cut face carries the network colours the surface is carrying. */
export const usesNetworkColors = state => state.surfaceColor === 'network';

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
function networkColor(label, { regions, networks } = {}) {
  if (!label.region_id) return null;
  const name = dominantNetwork(regions?.get(label.region_id));
  return name ? networks?.colors?.[name] ?? null : null;
}

/**
 * What one label looks like, whether a voxel cut or a solid cap paints it.
 *
 * Both paths read this, so a parcel cannot come out one colour on a sampled
 * cut face and another on a geometric one.
 */
export function labelAppearance(label, state, tissuePalette, lookup, color = new Color()) {
  // Match the linear baseColorFactor stored in the exported glTF materials.
  color.setRGB(...label.color.map((value) => value / 255));
  if (!usesAtlasColors(state)) {
    color.set(tissueColor({ ...label, source_name: label.name }, tissuePalette));
  }
  if (usesNetworkColors(state)) {
    const channels = networkColor(label, lookup);
    // Published sRGB, converted the same way the surface converts it, so a
    // parcel reads as one colour whether it is met on the cut or the surface.
    if (channels) color.setRGB(...channels.map(value => value / 255), SRGBColorSpace);
  }
  if (label.kind === 'cortex' && !label.region_id) color.set(tissuePalette.unlabelled);
  return { color, visible: labelVisible(label, state) };
}

/** Palette is independent of slice position, so dragging never rebuilds it. */
export function createPalette(labels, state, tissuePalette, lookup) {
  const palette = new Float32Array(labels.length * 4);
  const color = new Color();
  for (const [code, label] of labels.entries()) {
    const { visible } = labelAppearance(label, state, tissuePalette, lookup, color);
    palette.set([color.r, color.g, color.b, Number(visible)], code * 4);
  }
  return palette;
}
