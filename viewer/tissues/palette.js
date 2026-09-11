import { Color } from 'three';

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

/** Palette is independent of slice position, so dragging never rebuilds it. */
export function createPalette(labels, state) {
  const palette = new Float32Array(labels.length * 4);
  const color = new Color();
  for (const [code, label] of labels.entries()) {
    // Match the linear baseColorFactor stored in the exported glTF materials.
    color.setRGB(...label.color.map((value) => value / 255));
    if (!state.atlasColors) color.setHex(label.kind === 'cortex' ? 0xd6cfc2 : 0xc7beb0);
    if (label.kind === 'cortex' && !label.region_id) color.setHex(0xb0aca5);
    palette.set([color.r, color.g, color.b, Number(labelVisible(label, state))], code * 4);
  }
  return palette;
}
