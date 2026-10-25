import type { Region } from '../../types/index.ts';

/**
 * The regions a selection shares anatomy with: itself, the source regions a
 * grouped structure is the union of, and the grouped structures that contain it.
 * A teaching-set thalamus is thereby linked to evidence mapped on its NextBrain
 * nuclei, and a nucleus to the lessons that use its thalamus as a landmark.
 */
export function createInvolvement(
  regions: ReadonlyMap<string, Pick<Region, 'id' | 'constituent_regions'>>,
): (id: string) => Set<string> {
  const containing = new Map<string, string[]>();
  for (const region of regions.values()) {
    for (const part of region.constituent_regions ?? []) {
      if (!containing.has(part)) containing.set(part, []);
      containing.get(part)!.push(region.id);
    }
  }
  return (id) => {
    const region = regions.get(id);
    if (!region) throw new Error(`Unknown region: ${id}`);
    return new Set([id, ...(region.constituent_regions ?? []), ...(containing.get(id) ?? [])]);
  };
}
