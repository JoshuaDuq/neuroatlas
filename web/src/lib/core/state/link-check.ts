import type { LinkState, Region } from '../../types/index.ts';
import { PARAMS } from './url-state.ts';

/** What this anatomy publishes: the ids a link may name. */
export interface KnownLinkIds {
  regions: ReadonlyMap<string, Pick<Region, 'kind'>>;
  atlases: ReadonlySet<string>;
  details: ReadonlySet<string>;
  cutAtlases: ReadonlySet<string>;
  views: ReadonlySet<string>;
  surfaceColors: ReadonlySet<string>;
  explorers: ReadonlySet<string>;
  functions: ReadonlySet<string>;
  deficits: ReadonlySet<string>;
  /** Each circuit's step count. */
  circuits: ReadonlyMap<string, number>;
  spinalCord: boolean;
}

/**
 * What a decoded link names, judged against what this anatomy publishes.
 * `known` lists the ids on offer; a field naming anything else is dropped and
 * its link parameter returned in `rejected`, so the reader can be told.
 */
export function checkLink(
  link: Partial<LinkState>,
  known: KnownLinkIds,
): { state: Partial<LinkState>; rejected: string[] } {
  const state = { ...link };
  const rejected: string[] = [];
  const reject = (key: keyof LinkState) => {
    delete state[key];
    rejected.push(PARAMS[key]!);
  };
  const region = (id: string) => {
    const record = known.regions.get(id);
    return Boolean(record) && record!.kind !== 'non-region';
  };
  const checks: [keyof LinkState, (value: never) => boolean][] = [
    ['atlas', (id: string) => known.atlases.has(id)],
    ['detail', (id: string) => known.details.has(id)],
    ['cutAtlas', (id: string) => known.cutAtlases.has(id)],
    ['view', (id: string) => known.views.has(id)],
    ['surfaceColor', (id: string) => known.surfaceColors.has(id)],
    ['explorer', (id: string) => known.explorers.has(id)],
    ['selectedRegion', region],
    ['isolatedRegion', region],
    ['hiddenRegions', (ids: string[]) => ids.every((id) => known.regions.has(id))],
    ['selectedFunction', (id: string) => known.functions.has(id)],
    ['selectedDeficit', (id: string) => known.deficits.has(id)],
    ['circuit', (id: string) => known.circuits.has(id)],
  ];
  for (const [key, valid] of checks) {
    if (key in state && !(valid as (value: unknown) => boolean)(state[key])) reject(key);
  }
  if ('circuitStep' in state && !(state.circuitStep! < (known.circuits.get(state.circuit!) ?? 0))) {
    reject('circuitStep');
  }
  if (state.spinalCordVisible && !known.spinalCord) reject('spinalCordVisible');
  return { state, rejected };
}
