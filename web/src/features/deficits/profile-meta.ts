import { visibilityOf } from '../../lib/core/catalog/visibility.ts';
import type { Region } from '../../lib/types/index.ts';

type Settings = Parameters<typeof visibilityOf>[1];

/**
 * What the profile's meta line counts (clinical.js:297-304), from what is drawn now: the regions
 * painted, or every mapped one when nothing is painted, each shown when a region it is drawn as is.
 * A masthead colour chosen over the paint leaves them drawn but not coloured.
 */
export function stageCounts(
  ids: readonly string[],
  drawnAs: (id: string) => readonly Region[],
  settings: Settings,
  painted: boolean,
) {
  return {
    shown: ids.filter((id) => drawnAs(id).some((region) => visibilityOf(region, settings).visible))
      .length,
    total: ids.length,
    coloured: painted,
  };
}
