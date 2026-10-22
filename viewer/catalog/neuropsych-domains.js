/**
 * Each HCP-MMP area's neuropsychological domains: those whose meta-analytic
 * association reaches the published threshold there, strongest first.
 */

/** The published partition, checked against the regions it assigns. */
export function validateNeuropsychDomains(partition, regions) {
  if (partition?.id !== 'neuropsych-domains' || !Array.isArray(partition.domains) || !partition.regions) {
    throw new Error('Invalid neuropsychological-domain partition.');
  }
  const ids = new Set();
  for (const domain of partition.domains) {
    if (!domain.id || ids.has(domain.id) || !domain.name || !domain.name_fr || !domain.term
        || domain.color?.length !== 3 || !partition.lesion_checks?.[domain.id]) {
      throw new Error(`Invalid neuropsychological domain: ${domain.id}`);
    }
    ids.add(domain.id);
  }
  for (const [id, members] of Object.entries(partition.regions)) {
    if (regions.get(id)?.atlas !== partition.atlas || !members.length
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
 * the area reaches it, otherwise its strongest.
 */
export function shownDomain(partition, regionId, picked) {
  const members = partition?.regions[regionId];
  if (!members) return null;
  const member = picked ? members.find(entry => entry.domain === picked) : members[0];
  return member ? domainRecord(partition, member.domain) : null;
}

export const domainName = (record, lang = 'en') => (lang === 'fr' ? record.name_fr : record.name);
