import { validateClinicalData } from './validate.js';
import { nearest } from '../catalog/nearest.js';

const normalize = value => value.trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function required(index, id, kind) {
  const record = index.get(id);
  if (!record) throw new Error(`Unknown ${kind}: ${id}`);
  return record;
}

/** Deficits under their group, in the groups' authored order; a group with no match is left out. */
export function groupDeficits(groups, deficits) {
  return groups
    .map(group => ({ group, deficits: deficits.filter(deficit => deficit.group === group.id) }))
    .filter(entry => entry.deficits.length > 0);
}

/*
 * Each finding's colour, in citation order. The first three stay apart from one another and from
 * the cortex's tissue colour under every pair, in normal vision and simulated colour-vision
 * deficiency (OKLab ΔE at least 12 and 19). Past three no order can keep every pair apart, so the
 * key names each finding and shows one alone when chosen.
 */
export const FINDING_COLORS = [
  [57, 135, 229], [213, 81, 129], [0, 131, 0], [201, 133, 0], [98, 80, 214], [232, 123, 164],
];

/**
 * A deficit's findings with their colours, and its paint: each mapped region in the colour of the
 * first finding that cites it, or only the regions of `finding` when one is chosen.
 */
export function findingPaint(deficit, associations, finding = null) {
  if (associations.length > FINDING_COLORS.length) {
    throw new Error(`${deficit} has more findings than finding colours.`);
  }
  if (finding && !associations.some(association => association.id === finding)) {
    throw new Error(`${deficit} has no finding ${finding}.`);
  }
  const findings = associations.map((association, index) => ({ association, color: FINDING_COLORS[index] }));
  const colors = new Map();
  for (const { association, color } of findings) {
    if (finding && association.id !== finding) continue;
    for (const { region } of association.mappings) if (!colors.has(region)) colors.set(region, color);
  }
  return { findings, paint: { id: `deficit:${deficit}${finding ? `:${finding}` : ''}`, colors } };
}

/** Every region a deficit's associations map, once each, in the order they are cited. */
export function mappedRegionIds(associations) {
  return [...new Set(associations.flatMap(association => association.mappings.map(m => m.region)))];
}

export function createClinicalCatalog(data, manifest) {
  const { groups, deficits, references, associations, regions } = validateClinicalData(data, manifest);
  const byDeficit = new Map([...deficits.keys()].map(id => [id, []]));
  const byRegion = new Map([...regions.keys()].map(id => [id, []]));
  for (const association of associations.values()) {
    byDeficit.get(association.deficit).push(association);
    for (const mapping of association.mappings) byRegion.get(mapping.region).push(association);
  }

  const searchIndexes = new Map(['en', 'fr'].map(lang => [lang,
    [...deficits.values()].map(deficit => ({
      deficit,
      name: normalize(deficit.name[lang]),
      terms: [deficit.name[lang], deficit.domain[lang], ...deficit.aliases[lang],
        ...byDeficit.get(deficit.id).flatMap(a => [a.title[lang], a.network[lang]])]
        .map(normalize),
    })),
  ]));

  const mapped = new Map([...byDeficit].map(([id, list]) => [id, mappedRegionIds(list)]));

  function search(query, lang) {
    const index = required(searchIndexes, lang, 'language');
    const term = normalize(query);
    return index.filter(entry => entry.terms.some(text => text.includes(term)))
      .sort((a, b) => Number(b.name === term) - Number(a.name === term)
        || a.deficit.name[lang].localeCompare(b.deficit.name[lang], lang))
      .map(entry => entry.deficit);
  }

  return {
    revised: data.revised,
    groups: [...groups.values()],
    get: id => required(deficits, id, 'deficit'),
    reference: id => required(references, id, 'reference'),
    forDeficit: id => required(byDeficit, id, 'deficit'),
    forRegion: id => required(byRegion, id, 'region'),
    mappedRegions: id => required(mapped, id, 'deficit'),
    paint: (id, finding = null) => findingPaint(id, required(byDeficit, id, 'deficit'), finding),
    search,
    grouped: (query, lang) => groupDeficits([...groups.values()], search(query, lang)),
    /** The deficit name or alias a query that matched nothing most likely misspells. */
    nearest: (query, lang) => nearest(query, [...deficits.values()].flatMap(deficit => [deficit.name[lang], ...deficit.aliases[lang]])),
  };
}
