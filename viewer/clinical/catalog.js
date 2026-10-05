import { validateClinicalData } from './validate.js';

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
    search,
    grouped: (query, lang) => groupDeficits([...groups.values()], search(query, lang)),
  };
}
