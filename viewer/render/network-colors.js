import { BufferAttribute, Color, SRGBColorSpace } from 'three';

/** Red, green, blue and whether this vertex has a network at all. */
export const NETWORK_COLOR_ITEM_SIZE = 4;

/**
 * Per-vertex network colour, from the `_NETWORK` field and the published palette.
 *
 * The index itself cannot be interpolated. A triangle spanning Visual (1) and
 * Default (7) would sweep through five networks it never touches, painting
 * thin bands of unrelated colour along every boundary. A colour can be: such a
 * triangle blends the two colours that actually meet there, across roughly the
 * one millimetre between vertices.
 *
 * The fourth channel says whether a vertex is in a network. The medial wall is
 * in none and keeps whatever colour its region already had, so nothing invents
 * a network where the parcellation declines to put one.
 */
export function networkColors(indices, { networks, colors }) {
  const palette = networks.map(name => {
    const [red, green, blue] = colors[name];
    return new Color().setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace);
  });
  const values = new Float32Array(indices.length * NETWORK_COLOR_ITEM_SIZE);
  for (let vertex = 0; vertex < indices.length; vertex += 1) {
    const color = palette[Math.round(indices[vertex]) - 1];
    if (!color) continue;
    const at = vertex * NETWORK_COLOR_ITEM_SIZE;
    values[at] = color.r;
    values[at + 1] = color.g;
    values[at + 2] = color.b;
    values[at + 3] = 1;
  }
  return values;
}

/** Bind the palette to one geometry's `_NETWORK` field. */
export function attachNetworkColors(geometry, metadata) {
  const field = geometry.getAttribute('_network');
  if (!field) return false;
  geometry.setAttribute(
    '_networkColor',
    new BufferAttribute(networkColors(field.array, metadata), NETWORK_COLOR_ITEM_SIZE),
  );
  return true;
}
