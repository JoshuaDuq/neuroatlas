import { FUNCTIONAL_LEVELS } from '../../types/index.ts';
import type { FunctionalLevel, Language, Region, Rgb } from '../../types/index.ts';

/**
 * Published groupings of HCP-MMP areas at two levels: Glasser's 22 sections,
 * which partition the cortex, and the named regions a source defines.
 */
export { FUNCTIONAL_LEVELS };

/** One published region (or section) and the HCP-MMP areas it groups. */
export interface FunctionalRegion {
  id: string;
  name: string;
  name_fr: string;
  short: string;
  short_fr: string;
  color: Rgb;
  source: string;
  areas: string[];
  [field: string]: unknown;
}

/** `functional-regions.json`. */
export interface FunctionalRegions {
  id: string;
  atlas: string;
  sources: Record<string, Record<string, unknown>>;
  levels: Record<FunctionalLevel, FunctionalRegion[]>;
  regions: Record<FunctionalLevel, Record<string, string>>;
  [field: string]: unknown;
}

/** The published partition, checked against the regions it assigns. */
export function validateFunctionalRegions(
  partition: FunctionalRegions,
  regions: ReadonlyMap<string, Region>,
): FunctionalRegions {
  if (partition?.id !== 'functional-regions' || !partition.levels || !partition.regions) {
    throw new Error('Invalid functional-region partition.');
  }
  for (const level of FUNCTIONAL_LEVELS) {
    const defined = partition.levels[level];
    if (!Array.isArray(defined) || !partition.regions[level]) {
      throw new Error(`Functional-region partition has no ${level} level.`);
    }
    const ids = new Set();
    for (const record of defined) {
      if (
        !record.id ||
        ids.has(record.id) ||
        !record.name ||
        !record.name_fr ||
        !record.short ||
        !record.short_fr ||
        record.color?.length !== 3 ||
        !partition.sources?.[record.source] ||
        !record.areas?.length
      ) {
        throw new Error(`Invalid functional region: ${record.id}`);
      }
      ids.add(record.id);
    }
    for (const [id, assigned] of Object.entries(partition.regions[level])) {
      if (regions.get(id)?.atlas !== partition.atlas || !ids.has(assigned)) {
        throw new Error(`Invalid functional-region assignment: ${id}`);
      }
    }
  }
  return partition;
}

/** The region an area belongs to at a level, or null where no source names one. */
export function functionalRegionOf(
  partition: FunctionalRegions | null | undefined,
  level: FunctionalLevel,
  regionId: string,
): FunctionalRegion | null | undefined {
  const id = partition?.regions[level]?.[regionId];
  return id ? partition.levels[level].find((record) => record.id === id) : null;
}

export const functionalName = (record: FunctionalRegion, lang: Language = 'en') =>
  lang === 'fr' ? record.name_fr : record.name;

/** What the colour key prints: a published abbreviation, or the name without "cortex". */
export const functionalShortName = (record: FunctionalRegion, lang: Language = 'en') =>
  lang === 'fr' ? record.short_fr : record.short;
