import { visibilityOf } from '../../lib/core/catalog/visibility.ts';
import type { Region } from '../../lib/types/index.ts';

type Settings = Parameters<typeof visibilityOf>[1];

/**
 * What the profile's meta line counts (clinical.js:297-304), from what is drawn now: the regions
 * painted, or every mapped one when nothing is painted. A masthead colour chosen over the paint
 * leaves them drawn but not coloured.
 */
export function stageCounts(
  ids: readonly string[],
  regionOf: (id: string) => Region,
  settings: Settings,
  painted: boolean,
) {
  return {
    shown: ids.filter((id) => visibilityOf(regionOf(id), settings).visible).length,
    total: ids.length,
    coloured: painted,
  };
}
