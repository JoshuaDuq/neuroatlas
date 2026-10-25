import type { DisplaySettings, Language, Manifest, Region } from '../../types/index.ts';
import { labelOf, type RegionLabel } from './labels.ts';
import { cabNpName, type CabNpPartition } from './networks.ts';
import { belongsToDetail, cutAtlasesOf, visibilityOf, type Visibility } from './visibility.ts';

const EXACT = 0,
  PREFIX = 1,
  WORD = 2,
  SUBSTRING = 3,
  NO_MATCH = 4;

const normalise = (value: string) => value.trim().toLowerCase();
const stripDiacritics = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** True when `query` starts at a word boundary inside `text`. */
function startsAWord(text: string, query: string): boolean {
  let from = text.indexOf(query);
  while (from > 0) {
    if (!/[\p{L}\p{N}]/u.test(text[from - 1])) return true;
    from = text.indexOf(query, from + 1);
  }
  return from === 0;
}

/** How well one searchable string matches, lower being better. */
function tierOf(text: string, query: string): number {
  if (!text) return NO_MATCH;
  if (text === query) return EXACT;
  if (text.startsWith(query)) return PREFIX;
  if (!text.includes(query)) return NO_MATCH;
  return startsAWord(text, query) ? WORD : SUBSTRING;
}

/** The display settings a catalog reads, plus the language the caller wants the labels in. */
export type CatalogSettings = DisplaySettings & { lang?: Language };

interface Entry {
  region: Region;
  label: RegionLabel;
  searchable: string[];
}

export type CatalogRow = { region: Region; label: RegionLabel } & Visibility;

export interface CatalogGroup {
  name: string;
  kind: 'cortex' | 'structure' | 'tissue';
  key: string;
  rows: CatalogRow[];
}

/**
 * A searchable, groupable index over the manifest's regions.
 *
 * Built once per manifest: the normalised search strings are precomputed, so
 * a keystroke costs a scan rather than a rebuild. Pure — it knows nothing of
 * Three.js or the DOM, and derives everything from a settings snapshot rather
 * than holding state of its own.
 */
export function createCatalog(
  manifest: Pick<Manifest, 'regions'>,
  defaultLang: Language = 'en',
  cabNp: CabNpPartition | null = null,
) {
  let activeLang: Language = defaultLang;
  let entries: Entry[] = [];
  const byId = new Map<string, Entry>();
  let selectable: Entry[] = [];

  function build(lang: Language) {
    activeLang = lang;
    entries = [];
    byId.clear();
    for (const region of manifest.regions) {
      const label = labelOf(region, lang);
      if (!label) throw new Error(`Region has no label: ${region.id}`);
      const baseName = normalise(label.name);
      const strippedName = stripDiacritics(baseName);
      const aliasTerms = (label.aliases ?? []).flatMap((a) => {
        const norm = normalise(a);
        const strip = stripDiacritics(norm);
        return norm === strip ? [norm] : [norm, strip];
      });
      const searchable =
        region.kind === 'non-region'
          ? []
          : [
              baseName,
              ...(strippedName !== baseName ? [strippedName] : []),
              label.code ? normalise(label.code) : '',
              ...aliasTerms,
            ].filter(Boolean);

      const entry: Entry = { region, label, searchable };
      entries.push(entry);
      byId.set(region.id, entry);
    }
    selectable = entries.filter((entry) => entry.searchable.length > 0);
  }

  build(defaultLang);

  function ensureLang(lang: Language | undefined) {
    if (lang && lang !== activeLang) build(lang);
  }

  const compare = (a: Entry, b: Entry) =>
    (a.region.family_order ?? 0) - (b.region.family_order ?? 0) ||
    a.label.name.localeCompare(b.label.name, activeLang) ||
    a.region.hemisphere.localeCompare(b.region.hemisphere);

  // While CAB-NP colours its atlas's areas, they are listed under the network their colour shows.
  const labelIn = (entry: Entry, settings?: CatalogSettings): RegionLabel => {
    const network = settings?.surfaceColor === 'cab-np' ? cabNp?.regions[entry.region.id] : null;
    return network ? { ...entry.label, group: cabNpName(network, activeLang) } : entry.label;
  };

  const row = (entry: Entry, settings: CatalogSettings): CatalogRow => ({
    region: entry.region,
    label: labelIn(entry, settings),
    ...visibilityOf(entry.region, settings),
  });

  return {
    get: (id: string) => byId.get(id) ?? null,

    label(id: string, settings?: CatalogSettings) {
      if (settings?.lang) ensureLang(settings.lang);
      return labelIn(byId.get(id)!, settings);
    },

    setLanguage(lang: Language) {
      ensureLang(lang);
    },

    /**
     * Ranked matches, capped, plus how many there really were. The caller
     * needs the total: showing the first fifty without saying so is the
     * silent absence this index exists to avoid.
     */
    search(rawQuery: string, settings: CatalogSettings, limit = 50) {
      if (settings?.lang) ensureLang(settings.lang);
      const query = normalise(rawQuery);
      if (!query) return { rows: [], total: 0 };
      const strippedQuery = stripDiacritics(query);
      const matched: { entry: Entry; tier: number }[] = [];
      for (const entry of selectable) {
        const tier = Math.min(
          ...entry.searchable.map((text) =>
            Math.min(tierOf(text, query), tierOf(text, strippedQuery)),
          ),
        );
        if (tier !== NO_MATCH) matched.push({ entry, tier });
      }
      matched.sort((a, b) => a.tier - b.tier || compare(a.entry, b.entry));
      return {
        rows: matched.slice(0, limit).map(({ entry }) => row(entry, settings)),
        total: matched.length,
      };
    },

    /**
     * Cortical groups of the active atlas, the structures of the active detail
     * level, then the cut-only regions of the active cut atlas.
     *
     * Each family is filtered by the control that actually selects it: surfaces
     * by the surface atlas, structures by the detail level, tissue regions by
     * the cut atlas.
     */
    groups(settings: CatalogSettings): CatalogGroup[] {
      if (settings?.lang) ensureLang(settings.lang);
      const cortical = new Map<string, Entry[]>();
      const structural = new Map<string, Entry[]>();
      const volumetric = new Map<string, Entry[]>();
      for (const entry of selectable) {
        const { kind, atlas } = entry.region;
        const into =
          kind === 'structure' ? structural : kind === 'tissue-region' ? volumetric : cortical;
        const shown =
          into === volumetric
            ? cutAtlasesOf(entry.region).includes(settings.cutAtlas)
            : into === structural
              ? belongsToDetail(entry.region, settings.detail)
              : atlas === settings.atlas;
        if (!shown) continue;
        if (
          into === structural &&
          settings.internalSystem &&
          labelOf(entry.region, 'en')!.group !== settings.internalSystem
        )
          continue;
        const { group } = labelIn(entry, settings);
        if (!into.has(group)) into.set(group, []);
        into.get(group)!.push(entry);
      }
      // A lobe and a system can share a name — Destrieux has a Limbic lobe and
      // aseg a Limbic system — so the key, not the name, identifies a group.
      const inFamilyOrder = (a: Entry, b: Entry) =>
        (a.region.family_order ?? -1) - (b.region.family_order ?? -1) || compare(a, b);
      const buildGroup = (map: Map<string, Entry[]>, kind: CatalogGroup['kind']): CatalogGroup[] =>
        [...map.entries()]
          .sort(([a], [b]) => a.localeCompare(b, activeLang))
          .map(([name, group]) => ({
            name,
            kind,
            key: `${kind}:${name}`,
            rows: group.sort(inFamilyOrder).map((entry) => row(entry, settings)),
          }));
      const cortex = buildGroup(cortical, 'cortex');
      const structures = buildGroup(structural, 'structure');
      return [
        ...(settings.cortexVisible ? [...cortex, ...structures] : [...structures, ...cortex]),
        ...buildGroup(volumetric, 'tissue'),
      ];
    },

    /**
     * Selectable regions; the two unlabelled medial surfaces are not regions.
     */
    visibleCount(settings: CatalogSettings) {
      let count = 0;
      for (const entry of selectable) {
        if (visibilityOf(entry.region, settings).visible) count += 1;
      }
      return count;
    },
  };
}
