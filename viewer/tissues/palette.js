import { Color } from 'three';
import { tissueColor } from '../render/materials.js';

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

/**
 * Whether a cut face shows the parcellation's own published colours.
 *
 * A cut face is sampled from a label volume, and the network layer is a
 * surface field with no volumetric counterpart — so networks cannot reach a
 * cut, and under that mode the face falls back to tissue rather than showing
 * a parcellation the surface is no longer showing.
 */
export const usesAtlasColors = state => state.surfaceColor === 'atlas';

/** Palette is independent of slice position, so dragging never rebuilds it. */
export function createPalette(labels, state, tissuePalette) {
  const palette = new Float32Array(labels.length * 4);
  const color = new Color();
  for (const [code, label] of labels.entries()) {
    // Match the linear baseColorFactor stored in the exported glTF materials.
    color.setRGB(...label.color.map((value) => value / 255));
    if (!usesAtlasColors(state)) {
      color.set(tissueColor({ ...label, source_name: label.name }, tissuePalette));
    }
    if (label.kind === 'cortex' && !label.region_id) color.set(tissuePalette.unlabelled);
    palette.set([color.r, color.g, color.b, Number(labelVisible(label, state))], code * 4);
  }
  return palette;
}
