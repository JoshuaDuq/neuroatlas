/**
 * Each HCP-MMP area's neuropsychological domains: those whose meta-analytic
 * association reaches the published threshold there, strongest first.
 */

/** The overview the Functions list opens with: every area drawn as its strongest overview domain. */
export const ALL_DOMAINS = 'all';

/** A searched Neurosynth term's function id is its term after this prefix. */
const TERM = 'term:';
export const isTermId = id => typeof id === 'string' && id.startsWith(TERM);

const normalize = value => value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Kinds of searched term: one naming a function, task or stimulus, or one naming a clinical group. */
export const TERM_KINDS = ['function', 'population'];

/**
 * The published term search, checked against the regions it names: each term with its study count, its
 * kind and the regions it reaches, strongest first. None may repeat a curated function's term or reach nothing.
 */
function validateTerms(published, partition, regions) {
  if (published?.id !== 'neurosynth-terms' || published.atlas !== partition.atlas
      || published.structure_atlas !== partition.structure_atlas || published.threshold_z !== partition.threshold_z
      || published.color?.length !== 3 || !Array.isArray(published.regions) || !Array.isArray(published.terms)) {
    throw new Error('Invalid Neurosynth term search.');
  }
  for (const id of published.regions) {
    if (!scoredRegion(partition, regions.get(id))) throw new Error(`Invalid Neurosynth term region: ${id}`);
  }
  const curated = new Set(partition.domains.map(domain => domain.term));
  const terms = new Map();
  for (const [term, studies, kind, reached] of published.terms) {
    if (typeof term !== 'string' || !term || terms.has(`${TERM}${term}`) || curated.has(term)
        || !Number.isInteger(studies) || !TERM_KINDS.includes(kind) || !reached.length
        || reached.some(([index, z]) => !published.regions[index] || !(z >= published.threshold_z))) {
      throw new Error(`Invalid Neurosynth term: ${term}`);
    }
    terms.set(`${TERM}${term}`, {
      id: `${TERM}${term}`, term, kind, name: term, name_fr: term, color: published.color, overview: false,
      group: null, studies, searchKey: normalize(term),
      areas: reached.map(([index, z]) => ({ region: published.regions[index], z })),
    });
  }
  return { terms, derivation: published.derivation };
}

/** The published partition, checked against the regions it assigns, with the term search where one is published. */
export function validateNeuropsychDomains(partition, regions, published = null) {
  if (partition?.id !== 'neuropsych-domains' || !Array.isArray(partition.domains) || !partition.regions
      || !Array.isArray(partition.groups) || !partition.structure_atlas || !Array.isArray(partition.structures)) {
    throw new Error('Invalid neuropsychological-domain partition.');
  }
  const groups = new Set();
  for (const group of partition.groups) {
    if (!group.id || groups.has(group.id) || !group.name || !group.name_fr) {
      throw new Error(`Invalid neuropsychological-domain group: ${group.id}`);
    }
    groups.add(group.id);
  }
  const ids = new Set();
  for (const domain of partition.domains) {
    if (!domain.id || domain.id === ALL_DOMAINS || ids.has(domain.id) || !domain.name || !domain.name_fr
        || !domain.term || !groups.has(domain.group) || typeof domain.overview !== 'boolean' || domain.color?.length !== 3
        || !Number.isInteger(partition.derivation?.studies?.[domain.id])
        || !partition.lesion_checks?.[domain.id]) {
      throw new Error(`Invalid neuropsychological domain: ${domain.id}`);
    }
    ids.add(domain.id);
  }
  if (!partition.domains.some(domain => domain.overview)) throw new Error('No neuropsychological domain is in the overview.');
  partition.search = published && validateTerms(published, partition, regions);
  for (const [id, members] of Object.entries(partition.regions)) {
    const region = regions.get(id);
    const scored = region?.atlas === partition.atlas
      || (region?.atlas === partition.structure_atlas && partition.structures.includes(region.source_name));
    if (!scored || !members.length
        || members.some(member => !ids.has(member.domain) || !(member.z >= partition.threshold_z))) {
      throw new Error(`Invalid neuropsychological-domain assignment: ${id}`);
    }
  }
  return partition;
}

export const domainRecord = (partition, id) => (isTermId(id) ? partition?.search?.terms.get(id)
  : partition?.domains.find(domain => domain.id === id)) ?? null;

/** How many studies a function's term rests on. */
export const domainStudies = (partition, id) => (isTermId(id)
  ? domainRecord(partition, id).studies : partition.derivation.studies[id]);

/**
 * Searched terms matching `query`, best first: the term itself, then those with a word starting with it,
 * then the rest holding it; more studies first within each.
 */
export function matchingTerms(partition, query) {
  const term = normalize(query);
  if (!term || !partition.search) return [];
  const rank = record => (record.searchKey === term ? 0
    : record.searchKey.startsWith(term) || record.searchKey.includes(` ${term}`) ? 1 : 2);
  return [...partition.search.terms.values()]
    .filter(record => record.searchKey.includes(term))
    .sort((a, b) => rank(a) - rank(b) || b.studies - a.studies || a.term.localeCompare(b.term));
}

/** Edits (insertions, deletions, substitutions, adjacent swaps) between two words. */
function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/**
 * The function name or searched term a query that matched nothing most likely misspells: the closest
 * within one edit per four letters, a tie going to the curated name; null when nothing is that close.
 */
export function nearestName(partition, query, lang) {
  const typed = normalize(query);
  if (typed.length < 4) return null;
  const names = [...partition.domains.map(domain => domainName(domain, lang)), ...partition.domains.map(domain => domain.term),
    ...(partition.search ? [...partition.search.terms.values()].map(record => record.term) : [])];
  let best = null;
  let bestDistance = Math.floor(typed.length / 4) + 1;
  for (const name of names) {
    const distance = editDistance(typed, normalize(name));
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

/** An area's domains with their z, strongest first; none where no domain reaches the threshold. */
export const domainsOf = (partition, regionId) => (partition?.regions[regionId] ?? [])
  .map(member => ({ ...domainRecord(partition, member.domain), z: member.z }));

/**
 * The domain an area is drawn as: the one picked when the reader picks one and
 * the area reaches it, otherwise its strongest overview domain.
 */
export function shownDomain(partition, regionId, picked) {
  const members = partition?.regions[regionId];
  if (!members) return null;
  const member = members.find(entry => (picked ? entry.domain === picked : domainRecord(partition, entry.domain).overview));
  return member ? domainRecord(partition, member.domain) : null;
}

/** The domains the overview draws together; the rest overlap them and are shown one at a time. */
export const overviewDomains = partition => partition.domains.filter(domain => domain.overview);

export const domainName = (record, lang = 'en') => (lang === 'fr' ? record.name_fr : record.name);

/** Domains matching `query` by name in either language or by term, under their groups in authored order. */
export function groupedDomains(partition, query, lang) {
  const term = normalize(query);
  const matches = domain => !term || [domain.name, domain.name_fr, domain.term]
    .some(text => normalize(text).includes(term));
  return partition.groups
    .map(group => ({ group, name: lang === 'fr' ? group.name_fr : group.name,
      domains: partition.domains.filter(domain => domain.group === group.id && matches(domain)) }))
    .filter(entry => entry.domains.length > 0);
}

/** Whether a region is one the domains are scored on: an area of their atlas, or a sampled structure. */
export const scoredRegion = (partition, region) => (region?.atlas === partition.atlas && region.kind === 'cortex')
  || (region?.atlas === partition.structure_atlas && partition.structures.includes(region.source_name));

/** Every area or structure that reaches a domain, strongest first; ties keep the published order. */
export function domainAreas(partition, id) {
  if (isTermId(id)) return domainRecord(partition, id).areas;
  return Object.entries(partition.regions)
    .flatMap(([region, members]) => members.filter(member => member.domain === id)
      .map(member => ({ region, z: member.z })))
    .sort((a, b) => b.z - a.z);
}

/** The model paint for one domain, or for `ALL_DOMAINS` each area's strongest. */
export function domainPaint(partition, id) {
  const picked = id === ALL_DOMAINS ? null : id;
  const record = picked && domainRecord(partition, picked);
  if (picked && !record) throw new Error(`Unknown neuropsychological domain: ${id}`);
  if (isTermId(id)) return { id: `function:${id}`, colors: new Map(record.areas.map(({ region }) => [region, record.color])) };
  const colors = new Map();
  for (const region of Object.keys(partition.regions)) {
    const shown = shownDomain(partition, region, picked);
    if (shown) colors.set(region, shown.color);
  }
  return { id: `function:${id}`, colors };
}
