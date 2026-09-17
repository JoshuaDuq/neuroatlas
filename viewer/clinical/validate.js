import { canonicalSourceName } from '../catalog/source-names.js';

const LANGUAGES = ['en', 'fr'];
const METHODS = new Set(['lesion-mapping', 'meta-analysis', 'case-report', 'case-series']);

function requireValue(condition, context) {
  if (!condition) throw new Error(`Invalid clinical catalog: ${context}`);
}

const isText = value => typeof value === 'string' && value.trim().length > 0;

function localized(record, field) {
  for (const lang of LANGUAGES) {
    requireValue(isText(record[field]?.[lang]), `${record.id}: ${field}.${lang} is required`);
  }
}

function indexRecords(records, kind) {
  requireValue(Array.isArray(records) && records.length > 0, `${kind} records are required`);
  const index = new Map();
  for (const record of records) {
    requireValue(isText(record?.id), `${kind} id is required`);
    requireValue(!index.has(record.id), `Duplicate ${kind}: ${record.id}`);
    index.set(record.id, record);
  }
  return index;
}

function validateDeficit(deficit) {
  for (const field of ['name', 'domain', 'summary']) localized(deficit, field);
  for (const lang of LANGUAGES) {
    const aliases = deficit.aliases?.[lang];
    requireValue(Array.isArray(aliases) && aliases.every(isText),
      `${deficit.id}: aliases.${lang} must be a list of terms`);
  }
}

function validateReference(reference) {
  for (const field of ['title', 'authors', 'journal']) {
    requireValue(isText(reference[field]), `${reference.id}: ${field} is required`);
  }
  requireValue(Number.isInteger(reference.year) && reference.year >= 1800,
    `${reference.id}: year must be a publication year`);
  requireValue(/^10\.\d{4,9}\/\S+$/.test(reference.doi), `${reference.id}: invalid doi`);
  requireValue(/^\d+$/.test(reference.pmid), `${reference.id}: invalid pmid`);
  requireValue(METHODS.has(reference.method), `${reference.id}: unknown method`);
  requireValue(reference.scope === 'abstract' || reference.scope === 'full-text',
    `${reference.id}: source scope is required`);
  localized(reference, 'population');
}

function validateAssociation(association, indexes) {
  const { deficits, references, regions } = indexes;
  const context = association.id;
  requireValue(deficits.has(association.deficit), `${context}: unknown deficit`);
  for (const field of ['title', 'finding', 'limitation', 'network', 'mapping_note']) {
    localized(association, field);
  }
  requireValue(['left', 'right', 'bilateral'].includes(association.laterality),
    `${context}: invalid laterality`);
  requireValue(Array.isArray(association.evidence)
    && association.evidence.some(item => item.role === 'supporting'),
  `${context}: supporting evidence is required`);
  for (const item of association.evidence) {
    requireValue(references.has(item.reference), `${context}: unknown reference ${item.reference}`);
    requireValue(['supporting', 'qualifying'].includes(item.role), `${context}: invalid evidence role`);
  }
  requireValue(Array.isArray(association.mappings), `${context}: mappings must be a list`);
  const mapped = new Set();
  for (const mapping of association.mappings) {
    const region = regions.get(mapping.region);
    requireValue(region && region.kind !== 'non-region', `${context}: unknown region ${mapping.region}`);
    // Compared canonically: the catalog names a parcel, and two recons spell
    // some parcel names differently. A genuine re-pointing still fails here.
    requireValue(
      canonicalSourceName(region.source_name) === canonicalSourceName(mapping.source_name),
      `${context}: source_name disagrees with ${mapping.region}`);
    requireValue(association.laterality === 'bilateral'
      || association.laterality === region.hemisphere, `${context}: hemisphere mismatch`);
    requireValue(!mapped.has(mapping.region), `${context}: duplicate region ${mapping.region}`);
    mapped.add(mapping.region);
  }
}

export function validateClinicalData(data, manifest) {
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(data?.revised), 'revision date is required');
  const indexes = {
    deficits: indexRecords(data.deficits, 'deficit'),
    references: indexRecords(data.references, 'reference'),
    associations: indexRecords(data.associations, 'association'),
    regions: indexRecords(manifest.regions, 'region'),
  };
  for (const deficit of indexes.deficits.values()) validateDeficit(deficit);
  for (const reference of indexes.references.values()) validateReference(reference);
  for (const association of indexes.associations.values()) validateAssociation(association, indexes);
  return indexes;
}
