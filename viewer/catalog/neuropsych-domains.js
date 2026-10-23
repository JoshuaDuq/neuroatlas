/**
 * Each HCP-MMP area's neuropsychological domains: those whose meta-analytic
 * association reaches the published threshold there, strongest first.
 */

/** The overview the Functions list opens with: every area drawn as its strongest overview domain. */
export const ALL_DOMAINS = 'all';

const normalize = value => value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** The published partition, checked against the regions it assigns. */
export function validateNeuropsychDomains(partition, regions) {
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

export const domainRecord = (partition, id) => partition?.domains.find(domain => domain.id === id) ?? null;

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
  return Object.entries(partition.regions)
    .flatMap(([region, members]) => members.filter(member => member.domain === id)
      .map(member => ({ region, z: member.z })))
    .sort((a, b) => b.z - a.z);
}

/** The model paint for one domain, or for `ALL_DOMAINS` each area's strongest. */
export function domainPaint(partition, id) {
  const picked = id === ALL_DOMAINS ? null : id;
  if (picked && !domainRecord(partition, picked)) throw new Error(`Unknown neuropsychological domain: ${id}`);
  const colors = new Map();
  for (const region of Object.keys(partition.regions)) {
    const shown = shownDomain(partition, region, picked);
    if (shown) colors.set(region, shown.color);
  }
  return { id: `function:${id}`, colors };
}
