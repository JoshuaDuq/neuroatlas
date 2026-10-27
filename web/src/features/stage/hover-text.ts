import { cabNpName, networkName } from '../../lib/core/catalog/networks.ts';
import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
import { functionalName, functionalRegionOf } from '../../lib/core/catalog/functional-regions.ts';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import {
  ALL_DOMAINS,
  domainAreas,
  domainName,
  domainRecord,
  domainsOf,
  isTermId,
  scoredSource,
} from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains, TermRecord } from '../../lib/core/catalog/neuropsych-domains.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { paintKind } from '../../lib/core/state/paint.ts';
import type { Language, ModelState, Region, SessionState } from '../../lib/types/index.ts';

/** What the hover chip reads from the reader's state. */
export type HoverView = Pick<ModelState, 'surfaceColor' | 'functionalLevel' | 'paint'> &
  Pick<SessionState, 'lang' | 'selectedFunction'>;

/** The published partitions and the model rules the chip names a region by. */
export interface HoverSources {
  regions: ReadonlyMap<string, Region>;
  functionalRegions: FunctionalRegions | null;
  cabNp: CabNpPartition | null;
  domains: NeuropsychDomains | null;
  /** The catalog's label for a region in the view's language, where it has one. */
  catalogName(id: string): string | undefined;
  canSelect(region: Region): boolean;
}

/**
 * The functions the painted area belongs to: the open term's name when the area carries it, else the
 * overview's (or the one shown alone) domain names.
 */
function domainNames(
  region: Region,
  { selectedFunction, lang }: HoverView & { lang: Language },
  domains: NeuropsychDomains,
): string {
  if (isTermId(selectedFunction)) {
    const scored = scoredSource(domains, region.id);
    return domainAreas(domains, selectedFunction).some((area) => area.region === scored)
      ? (domainRecord(domains, selectedFunction) as TermRecord).term
      : '';
  }
  return domainsOf(domains, region.id)
    .filter((record) =>
      selectedFunction === ALL_DOMAINS ? record.overview : record.id === selectedFunction,
    )
    .map((record) => domainName(record, lang))
    .join(', ');
}

/**
 * What the chip says about the region under the pointer, or null where the model does not let it be
 * selected (app.js:1694-1717). Both hemispheres share every name, so the chip says which side as well.
 */
export function hoverText(region: Region, view: HoverView, sources: HoverSources): string | null {
  if (!sources.canSelect(region)) return null;
  const { lang, surfaceColor, functionalLevel, paint } = view;
  const name = sources.catalogName(region.id) ?? region.label;
  // Glass belongs to no division of the level on show, but always to a section.
  const division =
    surfaceColor === 'functional'
      ? (functionalRegionOf(sources.functionalRegions, functionalLevel, region.id) ??
        functionalRegionOf(sources.functionalRegions, 'sections', region.id))
      : null;
  // The network a colour stands for, where one network holds the whole region: every CAB-NP area; a
  // Yeo 7 region only when all its assigned vertices share one network.
  const cabNp = surfaceColor === 'cab-np' ? sources.cabNp?.regions[region.id] : undefined;
  const yeo = surfaceColor === 'network' ? sources.regions.get(region.id)?.networks : undefined;
  const network = cabNp
    ? cabNpName(cabNp, lang)
    : yeo?.length === 1
      ? networkName(yeo[0]!.network, lang)
      : null;
  // While the functions are painted: the functions the area reaches.
  let functions = '';
  if (paintKind(paint) === 'function') {
    if (!sources.domains) throw new Error('A function is painted but no domains are published.');
    functions = domainNames(region, view, sources.domains);
  }
  const side = t(lang, 'sides').capitalized[region.hemisphere];
  return [name, division && functionalName(division, lang), network, functions, side]
    .filter(Boolean)
    .join(' · ');
}
