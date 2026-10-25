import type { Manifest, Region } from '../../types/index.ts';
import { canonicalSourceName } from '../catalog/source-names.ts';
import type {
  ClinicalAssociation,
  ClinicalData,
  ClinicalDeficit,
  ClinicalGroup,
  ClinicalReference,
} from './types.ts';

const LANGUAGES = ['en', 'fr'] as const;
const METHODS = new Set(['lesion-mapping', 'meta-analysis', 'case-report', 'case-series']);
const DOI = /^10\.\d{4,9}\/\S+$/;

function requireValue(condition: unknown, context: string): asserts condition {
  if (!condition) throw new Error(`Invalid clinical catalog: ${context}`);
}

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function localized(record: { id: string }, field: string) {
  const value = (record as unknown as Record<string, Record<string, unknown> | undefined>)[field];
  for (const lang of LANGUAGES) {
    requireValue(isText(value?.[lang]), `${record.id}: ${field}.${lang} is required`);
  }
}

function indexRecords<T extends { id: string }>(records: readonly T[], kind: string) {
  requireValue(Array.isArray(records) && records.length > 0, `${kind} records are required`);
  const index = new Map<string, T>();
  for (const record of records) {
    requireValue(isText(record?.id), `${kind} id is required`);
    requireValue(!index.has(record.id), `Duplicate ${kind}: ${record.id}`);
    index.set(record.id, record);
  }
  return index;
}

function validateDeficit(deficit: ClinicalDeficit, groups: ReadonlyMap<string, ClinicalGroup>) {
  for (const field of ['name', 'domain', 'summary']) localized(deficit, field);
  requireValue(groups.has(deficit.group), `${deficit.id}: unknown group ${deficit.group}`);
  for (const lang of LANGUAGES) {
    const aliases = deficit.aliases?.[lang];
    requireValue(
      Array.isArray(aliases) && aliases.every(isText),
      `${deficit.id}: aliases.${lang} must be a list of terms`,
    );
  }
}

function validateReference(reference: ClinicalReference) {
  for (const field of ['title', 'authors', 'journal'] as const) {
    requireValue(isText(reference[field]), `${reference.id}: ${field} is required`);
  }
  requireValue(
    Number.isInteger(reference.year) && reference.year >= 1800,
    `${reference.id}: year must be a publication year`,
  );
  requireValue(DOI.test(reference.doi), `${reference.id}: invalid doi`);
  requireValue(/^\d+$/.test(reference.pmid), `${reference.id}: invalid pmid`);
  requireValue(METHODS.has(reference.method), `${reference.id}: unknown method`);
  requireValue(
    reference.scope === 'abstract' || reference.scope === 'full-text',
    `${reference.id}: source scope is required`,
  );
  localized(reference, 'population');
  // Published errata and corrections, each with what it changes.
  requireValue(
    reference.corrections === undefined || Array.isArray(reference.corrections),
    `${reference.id}: corrections must be a list`,
  );
  for (const correction of reference.corrections ?? []) {
    requireValue(DOI.test(correction.doi), `${reference.id}: invalid correction doi`);
    for (const lang of LANGUAGES) {
      requireValue(
        isText(correction.summary?.[lang]),
        `${reference.id}: correction summary.${lang} is required`,
      );
    }
  }
}

interface Indexes {
  groups: Map<string, ClinicalGroup>;
  deficits: Map<string, ClinicalDeficit>;
  references: Map<string, ClinicalReference>;
  associations: Map<string, ClinicalAssociation>;
  regions: Map<string, Region>;
}

function validateAssociation(
  association: ClinicalAssociation,
  { deficits, references, regions }: Indexes,
) {
  const context = association.id;
  requireValue(deficits.has(association.deficit), `${context}: unknown deficit`);
  for (const field of ['title', 'finding', 'limitation', 'network', 'mapping_note']) {
    localized(association, field);
  }
  requireValue(
    ['left', 'right', 'bilateral'].includes(association.laterality),
    `${context}: invalid laterality`,
  );
  requireValue(
    Array.isArray(association.evidence) &&
      association.evidence.some((item) => item.role === 'supporting'),
    `${context}: supporting evidence is required`,
  );
  for (const item of association.evidence) {
    requireValue(references.has(item.reference), `${context}: unknown reference ${item.reference}`);
    requireValue(
      ['supporting', 'qualifying'].includes(item.role),
      `${context}: invalid evidence role`,
    );
  }
  requireValue(Array.isArray(association.mappings), `${context}: mappings must be a list`);
  const mapped = new Set<string>();
  for (const mapping of association.mappings) {
    const region = regions.get(mapping.region);
    requireValue(
      region && region.kind !== 'non-region',
      `${context}: unknown region ${mapping.region}`,
    );
    // Compared canonically: the catalog names a parcel, and two recons spell
    // some parcel names differently. A genuine re-pointing still fails here.
    requireValue(
      canonicalSourceName(region.source_name!) === canonicalSourceName(mapping.source_name),
      `${context}: source_name disagrees with ${mapping.region}`,
    );
    requireValue(
      association.laterality === 'bilateral' || association.laterality === region.hemisphere,
      `${context}: hemisphere mismatch`,
    );
    requireValue(!mapped.has(mapping.region), `${context}: duplicate region ${mapping.region}`);
    mapped.add(mapping.region);
  }
}

export function validateClinicalData(data: ClinicalData, manifest: Pick<Manifest, 'regions'>) {
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(data?.revised), 'revision date is required');
  const indexes: Indexes = {
    groups: indexRecords(data.groups, 'group'),
    deficits: indexRecords(data.deficits, 'deficit'),
    references: indexRecords(data.references, 'reference'),
    associations: indexRecords(data.associations, 'association'),
    regions: indexRecords(manifest.regions, 'region'),
  };
  for (const group of indexes.groups.values()) localized(group, 'name');
  for (const deficit of indexes.deficits.values()) validateDeficit(deficit, indexes.groups);
  for (const group of indexes.groups.keys()) {
    requireValue(
      [...indexes.deficits.values()].some((deficit) => deficit.group === group),
      `${group}: group has no deficits`,
    );
  }
  for (const reference of indexes.references.values()) validateReference(reference);
  for (const association of indexes.associations.values())
    validateAssociation(association, indexes);
  return indexes;
}
