import { encodeCsv } from '../comparison/catalog.ts';
import { SLIGHT_SHARE } from '../lesion/findings.ts';

type Shares = ReadonlyMap<string, { inside: number; whole: number }>;

export interface ShareRow {
  id: string;
  /** mm³ of the sphere in it. */
  inside: number;
  /** Its share of the sphere, not of itself. */
  share: number;
}

/** What fills the sphere, largest first: rows of 1% or more, those under, and the share no row covers. */
export interface SphereShares {
  shown: ShareRow[];
  slight: ShareRow[];
  rest: number;
}

const atlasOf = (id: string) => id.slice(0, id.indexOf(':'));

function spread(inside: ReadonlyMap<string, number>, volume: number): SphereShares {
  if (!(volume > 0)) throw new RangeError(`A sphere's volume must be positive, not ${volume}.`);
  const rows = [...inside]
    .map(([id, mm3]) => ({ id, inside: mm3, share: mm3 / volume }))
    .sort((a, b) => b.share - a.share);
  const covered = rows.reduce((sum, row) => sum + row.inside, 0);
  return {
    shown: rows.filter((row) => row.share >= SLIGHT_SHARE),
    slight: rows.filter((row) => row.share < SLIGHT_SHARE),
    rest: (volume - covered) / volume,
  };
}

/** One atlas's regions as shares of the sphere's `volume`; `keep` narrows them further. */
export function sphereShares(
  regions: Shares,
  atlas: string,
  volume: number,
  keep: (id: string) => boolean = () => true,
): SphereShares {
  const inside = new Map<string, number>();
  for (const [id, region] of regions) {
    if (atlasOf(id) === atlas && keep(id)) inside.set(id, region.inside);
  }
  return spread(inside, volume);
}

/** An atlas's regions gathered into the networks each is assigned to, as shares of the sphere. */
export function networkShares(
  regions: Shares,
  atlas: string,
  volume: number,
  networksOf: (id: string) => readonly { network: string; fraction: number }[] | undefined,
): SphereShares {
  const inside = new Map<string, number>();
  for (const [id, region] of regions) {
    if (atlasOf(id) !== atlas) continue;
    const networks = networksOf(id);
    if (!networks) throw new Error(`No network is published for ${id}.`);
    for (const { network, fraction } of networks) {
      inside.set(network, (inside.get(network) ?? 0) + region.inside * fraction);
    }
  }
  return spread(inside, volume);
}

/** A nested record's leaves as `prefix.key.key` and their values. */
export function flattened(prefix: string, value: unknown): [string, unknown][] {
  if (value === null || typeof value !== 'object') return [[prefix, value]];
  return Object.entries(value).flatMap(([key, inner]) => flattened(`${prefix}.${key}`, inner));
}

/** The report as a table: what was entered and how it was placed, then every share of the sphere. */
export function coordinateCsv(
  metadata: readonly (readonly [string, unknown])[],
  shares: readonly { atlas: string; id: string; name: string; share: number }[],
): string {
  return encodeCsv([
    ...metadata.map(([item, value]) => ({ item, atlas: '', region_id: '', region: '', value })),
    ...shares.map(({ atlas, id, name, share }) => ({
      item: 'share_of_sphere',
      atlas,
      region_id: id,
      region: name,
      value: share,
    })),
  ]);
}
