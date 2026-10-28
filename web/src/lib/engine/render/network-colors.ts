import { BufferAttribute, Color, SRGBColorSpace } from 'three';
import type { BufferGeometry } from 'three';
import type { Region, Rgb } from '../../types/index.ts';

/** Red, green, blue and whether this vertex has a network at all. */
export const NETWORK_COLOR_ITEM_SIZE = 4;

/** The slice of the manifest's `networks` the colours read. */
export interface NetworkMetadata {
  networks: readonly string[];
  colors: Readonly<Record<string, Rgb>>;
}

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
export function networkColors(
  indices: ArrayLike<number>,
  { networks, colors }: NetworkMetadata,
): Float32Array {
  return paletteColors(
    indices,
    networks.map((name) => colors[name]!),
  );
}

/** Per-vertex colour from a 1-based index into `colors`; index 0, or one past the end, carries none. */
export function paletteColors(indices: ArrayLike<number>, colors: readonly Rgb[]): Float32Array {
  const palette = colors.map(([red, green, blue]) =>
    new Color().setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace),
  );
  const values = new Float32Array(indices.length * NETWORK_COLOR_ITEM_SIZE);
  for (let vertex = 0; vertex < indices.length; vertex += 1) {
    const color = palette[Math.round(indices[vertex]!) - 1];
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
export function attachNetworkColors(geometry: BufferGeometry, metadata: NetworkMetadata): boolean {
  const field = geometry.getAttribute('_network');
  if (!field) return false;
  geometry.setAttribute(
    '_networkColor',
    new BufferAttribute(networkColors(field.array, metadata), NETWORK_COLOR_ITEM_SIZE),
  );
  return true;
}

/** Bind the territory palette to one geometry's `_TERRITORY` field, as `_territoryColor`. */
export function attachTerritoryColors(
  geometry: BufferGeometry,
  territories: readonly { color: Rgb }[],
): boolean {
  const field = geometry.getAttribute('_territory');
  if (!field) return false;
  // The build writes one index per published territory; a larger one means the mesh and the
  // manifest disagree, which drawing it as "no territory" would hide.
  for (let vertex = 0; vertex < field.count; vertex += 1) {
    const index = field.getX(vertex);
    if (!Number.isInteger(index) || index < 0 || index > territories.length) {
      throw new Error(`Vertex index ${index} has no published territory.`);
    }
  }
  geometry.setAttribute(
    '_territoryColor',
    new BufferAttribute(
      paletteColors(
        field.array,
        territories.map((territory) => territory.color),
      ),
      NETWORK_COLOR_ITEM_SIZE,
    ),
  );
  return true;
}

/**
 * The colour of the territory holding most of a region, when one holds a majority. A region drawn
 * whole, as a deep structure's surface or a cut voxel is, has one code, so it can only show that.
 */
export function majorityTerritoryColor(
  region: Pick<Region, 'territories'> | undefined,
  territories: readonly { id: string; color: Rgb }[],
): Rgb | null {
  const largest = region?.territories?.[0];
  if (!largest || largest.fraction < 0.5) return null;
  const entry = territories.find((candidate) => candidate.id === largest.territory);
  if (!entry) throw new Error(`No arterial territory ${largest.territory} is published.`);
  return entry.color;
}
