import { labelOf } from './labels.js';
import { visibilityOf } from './visibility.js';

const EXACT = 0, PREFIX = 1, WORD = 2, SUBSTRING = 3, NO_MATCH = 4;

const normalise = value => value.trim().toLowerCase();

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
export function createCatalog(manifest) {
  const entries = [];
  const byId = new Map();

  for (const region of manifest.regions) {
    const label = labelOf(region);
    if (!label) throw new Error(`Region has no label: ${region.id}`);
    const entry = {
      region,
      label,
      // Non-regions are unselectable, so they are indexed for nothing.
      searchable: region.kind === 'non-region' ? [] : [
        normalise(label.name),
        label.code ? normalise(label.code) : '',
        ...label.aliases.map(normalise),
      ].filter(Boolean),
    };
    entries.push(entry);
    byId.set(region.id, entry);
  }

  const selectable = entries.filter(entry => entry.searchable.length > 0);

  const compare = (a, b) =>
    a.label.name.localeCompare(b.label.name) ||
    a.region.hemisphere.localeCompare(b.region.hemisphere);

  const row = (entry, settings) => ({
    region: entry.region,
    label: entry.label,
    ...visibilityOf(entry.region, settings),
  });

  return {
    get: id => byId.get(id) ?? null,

    search(rawQuery, settings, limit = 50) {
      const query = normalise(rawQuery);
      if (!query) return [];
      const matched = [];
      for (const entry of selectable) {
        const tier = Math.min(...entry.searchable.map(text => tierOf(text, query)));
        if (tier !== NO_MATCH) matched.push({ entry, tier });
      }
      matched.sort((a, b) => a.tier - b.tier || compare(a.entry, b.entry));
      return matched.slice(0, limit).map(({ entry }) => row(entry, settings));
    },

    /** Cortical groups of the active atlas, then the shared structure systems. */
    groups(settings) {
      const cortical = new Map();
      const structural = new Map();
      for (const entry of selectable) {
        const isStructure = entry.region.kind === 'structure';
        if (!isStructure && entry.region.atlas !== settings.atlas) continue;
        const into = isStructure ? structural : cortical;
        if (!into.has(entry.label.group)) into.set(entry.label.group, []);
        into.get(entry.label.group).push(entry);
      }
      const build = map => [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, group]) => ({
          name,
          rows: group.sort(compare).map(entry => row(entry, settings)),
        }));
      return [...build(cortical), ...build(structural)];
    },

    /**
     * How many meshes the model will show. Mesh and region are one to one, so
     * this is derivable without walking the scene graph.
     */
    visibleCount(settings) {
      let count = 0;
      for (const entry of entries) {
        if (visibilityOf(entry.region, settings).visible) count += 1;
      }
      return count;
    },
  };
}
