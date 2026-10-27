import { SLIGHT_SHARE } from './findings.ts';

type Shares = ReadonlyMap<string, { inside: number; whole: number }>;

export interface RegionRow {
  id: string;
  /** mm³ inside the lesion, and the region's whole size. */
  inside: number;
  whole: number;
  share: number;
}

const atlasOf = (id: string) => id.slice(0, id.indexOf(':'));
const sideOf = (id: string) => id.split(':')[1];

/** One atlas's regions in the lesion, largest share first; those under 1% are folded away. */
export function regionRows(
  regions: Shares,
  atlas: string,
): { shown: RegionRow[]; slight: RegionRow[] } {
  const rows = [...regions]
    .filter(([id]) => atlasOf(id) === atlas)
    .map(([id, { inside, whole }]) => ({ id, inside, whole, share: inside / whole }))
    .sort((a, b) => b.share - a.share);
  return {
    shown: rows.filter((row) => row.share >= SLIGHT_SHARE),
    slight: rows.filter((row) => row.share < SLIGHT_SHARE),
  };
}

/** The hemispheres the lesion's labelled regions lie in, or null before it reaches any. */
export function lesionSides(regions: Shares): 'left' | 'right' | 'both' | null {
  const sides = new Set([...regions.keys()].map(sideOf));
  const left = sides.has('left');
  const right = sides.has('right');
  return left && right ? 'both' : left ? 'left' : right ? 'right' : null;
}

/** The bundles a lesion crosses, largest share of streamlines first, and the ones it misses. */
export function tractRows<T extends { id: string; crossing: number; total: number }>(
  crossings: readonly T[],
): { crossed: (T & { share: number })[]; missed: string[] } {
  return {
    crossed: crossings
      .filter((bundle) => bundle.crossing > 0)
      .map((bundle) => ({ ...bundle, share: bundle.crossing / bundle.total }))
      .sort((a, b) => b.share - a.share),
    missed: crossings.filter((bundle) => bundle.crossing === 0).map((bundle) => bundle.id),
  };
}
