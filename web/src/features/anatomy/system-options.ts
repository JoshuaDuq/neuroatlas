import { labelOf } from '../../lib/core/catalog/labels.ts';
import { belongsToDetail } from '../../lib/core/catalog/visibility.ts';
import { groupDisplayName } from '../../lib/core/panels/navigator.ts';
import type { Language, Region } from '../../lib/types/index.ts';

/**
 * The systems the structures of this detail level belong to, keyed by their English group name
 * (what the display holds), shown as the tree names them and sorted by that name. `shared` is the
 * names two vocabularies use (`sharedGroupNames`), which are qualified.
 */
export function systemOptions(
  regions: readonly Region[],
  detail: string,
  lang: Language,
  shared: ReadonlySet<string>,
): { value: string; label: string }[] {
  const systems = new Map<string, string>();
  for (const region of regions) {
    if (region.kind !== 'structure' || !belongsToDetail(region, detail)) continue;
    systems.set(
      labelOf(region, 'en')!.group,
      groupDisplayName(labelOf(region, lang)!.group, region, shared, lang),
    );
  }
  return [...systems]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, lang));
}
