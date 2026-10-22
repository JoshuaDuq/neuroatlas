/**
 * Published groupings of HCP-MMP areas at two levels: Glasser's 22 sections,
 * which partition the cortex, and the named regions a source defines.
 */
export const FUNCTIONAL_LEVELS = ['named', 'sections'];

/** The published partition, checked against the regions it assigns. */
export function validateFunctionalRegions(partition, regions) {
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
      if (!record.id || ids.has(record.id) || !record.name || !record.name_fr || !record.short || !record.short_fr ||
          record.color?.length !== 3 || !partition.sources?.[record.source] || !record.areas?.length) {
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
export function functionalRegionOf(partition, level, regionId) {
  const id = partition?.regions[level]?.[regionId];
  return id ? partition.levels[level].find(record => record.id === id) : null;
}

export const functionalName = (record, lang = 'en') => (lang === 'fr' ? record.name_fr : record.name);

/** What the colour key prints: a published abbreviation, or the name without "cortex". */
export const functionalShortName = (record, lang = 'en') => (lang === 'fr' ? record.short_fr : record.short);
