import { validateClinicalData } from './validate.js';

const normalize = value => value.trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function required(index, id, kind) {
  const record = index.get(id);
  if (!record) throw new Error(`Unknown ${kind}: ${id}`);
  return record;
}

export function createClinicalCatalog(data, manifest) {
  const { deficits, references, associations, regions } = validateClinicalData(data, manifest);
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

  return {
    revised: data.revised,
    get: id => required(deficits, id, 'deficit'),
    reference: id => required(references, id, 'reference'),
    forDeficit: id => required(byDeficit, id, 'deficit'),
    forRegion: id => required(byRegion, id, 'region'),
    search(query, lang) {
      const index = required(searchIndexes, lang, 'language');
      const term = normalize(query);
      return index.filter(entry => entry.terms.some(text => text.includes(term)))
        .sort((a, b) => Number(b.name === term) - Number(a.name === term)
          || a.deficit.name[lang].localeCompare(b.deficit.name[lang], lang))
        .map(entry => entry.deficit);
    },
  };
}
