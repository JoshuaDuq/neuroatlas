import { labelOf } from './labels.js';
import { visibilityOf } from './visibility.js';

const EXACT = 0, PREFIX = 1, WORD = 2, SUBSTRING = 3, NO_MATCH = 4;

const normalise = value => value.trim().toLowerCase();
const stripDiacritics = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** True when `query` starts at a word boundary inside `text`. */
function startsAWord(text, query) {
  let from = text.indexOf(query);
  while (from > 0) {
    if (!/[a-z0-9]/.test(text[from - 1])) return true;
    from = text.indexOf(query, from + 1);
  }
  return from === 0;
}

/** How well one searchable string matches, lower being better. */
function tierOf(text, query) {
  if (!text) return NO_MATCH;
  if (text === query) return EXACT;
  if (text.startsWith(query)) return PREFIX;
  if (!text.includes(query)) return NO_MATCH;
  return startsAWord(text, query) ? WORD : SUBSTRING;
}

/**
 * A searchable, groupable index over the manifest's regions.
 *
 * Built once per manifest: the normalised search strings are precomputed, so
 * a keystroke costs a scan rather than a rebuild. Pure — it knows nothing of
 * Three.js or the DOM, and derives everything from a settings snapshot rather
 * than holding state of its own.
 */
export function createCatalog(manifest, defaultLang = 'en') {
  let activeLang = defaultLang;
  let entries = [];
  let byId = new Map();
  let selectable = [];

  function build(lang) {
    activeLang = lang;
    entries = [];
    byId.clear();
    for (const region of manifest.regions) {
      const label = labelOf(region, lang);
      if (!label) throw new Error(`Region has no label: ${region.id}`);
      const baseName = normalise(label.name);
      const strippedName = stripDiacritics(baseName);
      const aliasTerms = (label.aliases ?? []).flatMap(a => {
        const norm = normalise(a);
        const strip = stripDiacritics(norm);
        return norm === strip ? [norm] : [norm, strip];
      });
      const searchable = region.kind === 'non-region' ? [] : [
        baseName,
        ...(strippedName !== baseName ? [strippedName] : []),
        label.code ? normalise(label.code) : '',
        ...aliasTerms,
      ].filter(Boolean);

      const entry = { region, label, searchable };
      entries.push(entry);
      byId.set(region.id, entry);
    }
    selectable = entries.filter(entry => entry.searchable.length > 0);
  }

  build(defaultLang);

  function ensureLang(lang) {
    if (lang && lang !== activeLang) build(lang);
  }

  const compare = (a, b) =>
    a.label.name.localeCompare(b.label.name, activeLang) ||
    a.region.hemisphere.localeCompare(b.region.hemisphere);

  const row = (entry, settings) => ({
    region: entry.region,
    label: entry.label,
    ...visibilityOf(entry.region, settings),
  });

  return {
    get: id => byId.get(id) ?? null,

    setLanguage(lang) {
      ensureLang(lang);
    },

    /**
     * Ranked matches, capped, plus how many there really were. The caller
     * needs the total: showing the first fifty without saying so is the
     * silent absence this index exists to avoid.
     */
    search(rawQuery, settings, limit = 50) {
      if (settings?.lang) ensureLang(settings.lang);
      const query = normalise(rawQuery);
      if (!query) return { rows: [], total: 0 };
      const strippedQuery = stripDiacritics(query);
      const matched = [];
      for (const entry of selectable) {
        const tier = Math.min(...entry.searchable.map(text =>
          Math.min(tierOf(text, query), tierOf(text, strippedQuery)),
        ));
        if (tier !== NO_MATCH) matched.push({ entry, tier });
      }
      matched.sort((a, b) => a.tier - b.tier || compare(a.entry, b.entry));
      return {
        rows: matched.slice(0, limit).map(({ entry }) => row(entry, settings)),
        total: matched.length,
      };
    },

    /** Cortical groups of the active atlas, then the shared structure systems. */
    groups(settings) {
      if (settings?.lang) ensureLang(settings.lang);
      const cortical = new Map();
      const structural = new Map();
      for (const entry of selectable) {
        const isStructure = entry.region.kind === 'structure';
        if (!isStructure && entry.region.atlas !== settings.atlas) continue;
        const into = isStructure ? structural : cortical;
        if (!into.has(entry.label.group)) into.set(entry.label.group, []);
        into.get(entry.label.group).push(entry);
      }
      // A lobe and a system can share a name — Destrieux has a Limbic lobe and
      // aseg a Limbic system — so the key, not the name, identifies a group.
      const buildGroup = (map, kind) => [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b, activeLang))
        .map(([name, group]) => ({
          name,
          kind,
          key: `${kind}:${name}`,
          rows: group.sort(compare).map(entry => row(entry, settings)),
        }));
      return [...buildGroup(cortical, 'cortex'), ...buildGroup(structural, 'structure')];
    },

    /**
     * Selectable regions; the two unlabelled medial surfaces are not regions.
     */
    visibleCount(settings) {
      let count = 0;
      for (const entry of selectable) {
        if (visibilityOf(entry.region, settings).visible) count += 1;
      }
      return count;
    },
  };
}
