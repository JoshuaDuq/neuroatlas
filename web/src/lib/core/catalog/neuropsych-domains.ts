import type { Language, Paint, Region, Rgb } from '../../types/index.ts';
import { nearest } from './nearest.ts';

export interface DomainGroup {
  id: string;
  name: string;
  name_fr: string;
}

/** A curated neuropsychological function, as `neuropsych-domains.json` lists it. */
export interface Domain {
  id: string;
  name: string;
  name_fr: string;
  term: string;
  group: string;
  overview: boolean;
  color: Rgb;
  [field: string]: unknown;
}

export type TermKind = 'function' | 'population';

/** A searched Neurosynth term, shaped like a domain so the Functions list can treat both alike. */
export interface TermRecord {
  id: string;
  term: string;
  kind: TermKind;
  name: string;
  name_fr: string;
  overview: false;
  group: null;
  studies: number;
  searchKey: string;
  areas: { region: string; z: number }[];
}

export type DomainRecord = Domain | TermRecord;

export interface DomainMember {
  domain: string;
  z: number;
}

export interface ZBand {
  from: number;
  color: Rgb;
}

/** `neurosynth-terms.json`. */
export interface NeurosynthTerms {
  id: string;
  atlas: string;
  structure_atlas: string;
  threshold_z: number;
  derivation: Record<string, unknown>;
  regions: string[];
  /** `[term, studies, kind, [[region index, z], …]]`. */
  terms: [string, number, TermKind, [number, number][]][];
}

/** The validated term search, attached to the partition as `search`. */
export interface TermSearch {
  terms: Map<string, TermRecord>;
  derivation: Record<string, unknown>;
}

/** `neuropsych-domains.json`; `validateNeuropsychDomains` attaches `search`. */
export interface NeuropsychDomains {
  id: string;
  atlas: string;
  structure_atlas: string;
  structures: string[];
  threshold_z: number;
  z_scale: ZBand[];
  groups: DomainGroup[];
  domains: Domain[];
  regions: Record<string, DomainMember[]>;
  derivation: { studies: Record<string, number>; [field: string]: unknown };
  lesion_checks: Record<string, unknown>;
  search?: TermSearch | null;
  [field: string]: unknown;
}

/**
 * Each HCP-MMP area's neuropsychological domains: those whose meta-analytic
 * association reaches the published threshold there, strongest first.
 */

/** The overview the Functions list opens with: every area drawn as its strongest overview domain. */
export const ALL_DOMAINS = 'all';

/** A searched Neurosynth term's function id is its term after this prefix. */
const TERM = 'term:';
export const isTermId = (id: unknown): id is string =>
  typeof id === 'string' && id.startsWith(TERM);

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Kinds of searched term: one naming a function, task or stimulus, or one naming a clinical group. */
export const TERM_KINDS = ['function', 'population'];

/**
 * The published term search, checked against the regions it names: each term with its study count, its
 * kind and the regions it reaches, strongest first. None may repeat a curated function's term or reach nothing.
 */
function validateTerms(
  published: NeurosynthTerms,
  partition: NeuropsychDomains,
  regions: ReadonlyMap<string, Region>,
): TermSearch {
  if (
    published?.id !== 'neurosynth-terms' ||
    published.atlas !== partition.atlas ||
    published.structure_atlas !== partition.structure_atlas ||
    published.threshold_z !== partition.threshold_z ||
    !Array.isArray(published.regions) ||
    !Array.isArray(published.terms)
  ) {
    throw new Error('Invalid Neurosynth term search.');
  }
  for (const id of published.regions) {
    if (!scoredRegion(partition, regions.get(id)))
      throw new Error(`Invalid Neurosynth term region: ${id}`);
  }
  const curated = new Set(partition.domains.map((domain) => domain.term));
  const terms = new Map<string, TermRecord>();
  for (const [term, studies, kind, reached] of published.terms) {
    if (
      typeof term !== 'string' ||
      !term ||
      terms.has(`${TERM}${term}`) ||
      curated.has(term) ||
      !Number.isInteger(studies) ||
      !TERM_KINDS.includes(kind) ||
      !reached.length ||
      reached.some(([index, z]) => !published.regions[index] || !(z >= published.threshold_z))
    ) {
      throw new Error(`Invalid Neurosynth term: ${term}`);
    }
    terms.set(`${TERM}${term}`, {
      id: `${TERM}${term}`,
      term,
      kind,
      name: term,
      name_fr: term,
      overview: false,
      group: null,
      studies,
      searchKey: normalize(term),
      areas: reached.map(([index, z]) => ({ region: published.regions[index], z })),
    });
  }
  return { terms, derivation: published.derivation };
}

/** The published partition, checked against the regions it assigns, with the term search where one is published. */
export function validateNeuropsychDomains(
  partition: NeuropsychDomains,
  regions: ReadonlyMap<string, Region>,
  published: NeurosynthTerms | null = null,
): NeuropsychDomains {
  if (
    partition?.id !== 'neuropsych-domains' ||
    !Array.isArray(partition.domains) ||
    !partition.regions ||
    !Array.isArray(partition.groups) ||
    !partition.structure_atlas ||
    !Array.isArray(partition.structures)
  ) {
    throw new Error('Invalid neuropsychological-domain partition.');
  }
  const groups = new Set<string>();
  for (const group of partition.groups) {
    if (!group.id || groups.has(group.id) || !group.name || !group.name_fr) {
      throw new Error(`Invalid neuropsychological-domain group: ${group.id}`);
    }
    groups.add(group.id);
  }
  const ids = new Set<string>();
  for (const domain of partition.domains) {
    if (
      !domain.id ||
      domain.id === ALL_DOMAINS ||
      ids.has(domain.id) ||
      !domain.name ||
      !domain.name_fr ||
      !domain.term ||
      !groups.has(domain.group) ||
      typeof domain.overview !== 'boolean' ||
      domain.color?.length !== 3 ||
      !Number.isInteger(partition.derivation?.studies?.[domain.id]) ||
      !partition.lesion_checks?.[domain.id]
    ) {
      throw new Error(`Invalid neuropsychological domain: ${domain.id}`);
    }
    ids.add(domain.id);
  }
  if (!partition.domains.some((domain) => domain.overview))
    throw new Error('No neuropsychological domain is in the overview.');
  const starts = partition.z_scale?.map((band) => band.from) ?? [];
  if (
    !starts.length ||
    starts[0] !== partition.threshold_z ||
    starts.some((start, index) => index && start <= starts[index - 1]) ||
    partition.z_scale.some((band) => band.color?.length !== 3)
  ) {
    throw new Error('Invalid neuropsychological-domain z scale.');
  }
  partition.search = published && validateTerms(published, partition, regions);
  for (const [id, members] of Object.entries(partition.regions)) {
    const region = regions.get(id);
    const scored =
      region?.atlas === partition.atlas ||
      (region?.atlas === partition.structure_atlas &&
        partition.structures.includes(region.source_name as string));
    if (
      !scored ||
      !members.length ||
      members.some((member) => !ids.has(member.domain) || !(member.z >= partition.threshold_z))
    ) {
      throw new Error(`Invalid neuropsychological-domain assignment: ${id}`);
    }
  }
  return partition;
}

export const domainRecord = (
  partition: NeuropsychDomains | null | undefined,
  id: string,
): DomainRecord | null =>
  (isTermId(id)
    ? partition?.search?.terms.get(id)
    : partition?.domains.find((domain) => domain.id === id)) ?? null;

/** How many studies a function's term rests on. */
export const domainStudies = (partition: NeuropsychDomains, id: string): number =>
  isTermId(id)
    ? (domainRecord(partition, id) as TermRecord).studies
    : partition.derivation.studies[id];

/**
 * Searched terms matching `query`, best first: the term itself, then those with a word starting with it,
 * then the rest holding it; more studies first within each.
 */
export function matchingTerms(partition: NeuropsychDomains, query: string): TermRecord[] {
  const term = normalize(query);
  if (!term || !partition.search) return [];
  const rank = (record: TermRecord) =>
    record.searchKey === term
      ? 0
      : record.searchKey.startsWith(term) || record.searchKey.includes(` ${term}`)
        ? 1
        : 2;
  return [...partition.search.terms.values()]
    .filter((record) => record.searchKey.includes(term))
    .sort((a, b) => rank(a) - rank(b) || b.studies - a.studies || a.term.localeCompare(b.term));
}

/** The function name or searched term a query that matched nothing most likely misspells, curated names first. */
export const nearestName = (partition: NeuropsychDomains, query: string, lang: Language) =>
  nearest(query, [
    ...partition.domains.map((domain) => domainName(domain, lang)),
    ...partition.domains.map((domain) => domain.term),
    ...(partition.search ? [...partition.search.terms.values()].map((record) => record.term) : []),
  ]);

/** An area's domains with their z, strongest first; none where no domain reaches the threshold. */
export const domainsOf = (partition: NeuropsychDomains | null | undefined, regionId: string) =>
  (partition?.regions[regionId] ?? []).map((member) => ({
    ...(domainRecord(partition, member.domain) as Domain),
    z: member.z,
  }));

/**
 * The domain an area is drawn as: the one picked when the reader picks one and
 * the area reaches it, otherwise its strongest overview domain.
 */
export function shownDomain(
  partition: NeuropsychDomains | null | undefined,
  regionId: string,
  picked: string | null,
): Domain | null {
  const members = partition?.regions[regionId];
  if (!members) return null;
  const member = members.find((entry) =>
    picked ? entry.domain === picked : (domainRecord(partition, entry.domain) as Domain).overview,
  );
  return member ? (domainRecord(partition, member.domain) as Domain) : null;
}

/** The domains the overview draws together; the rest overlap them and are shown one at a time. */
export const overviewDomains = (partition: NeuropsychDomains) =>
  partition.domains.filter((domain) => domain.overview);

export const domainName = (record: DomainRecord, lang: Language = 'en') =>
  lang === 'fr' ? record.name_fr : record.name;

/** Domains matching `query` by name in either language or by term, under their groups in authored order. */
export function groupedDomains(partition: NeuropsychDomains, query: string, lang: Language) {
  const term = normalize(query);
  const matches = (domain: Domain) =>
    !term ||
    [domain.name, domain.name_fr, domain.term].some((text) => normalize(text).includes(term));
  return partition.groups
    .map((group) => ({
      group,
      name: lang === 'fr' ? group.name_fr : group.name,
      domains: partition.domains.filter((domain) => domain.group === group.id && matches(domain)),
    }))
    .filter((entry) => entry.domains.length > 0);
}

/** Whether a region is one the domains are scored on: an area of their atlas, or a sampled structure. */
export const scoredRegion = (partition: NeuropsychDomains, region: Region | undefined) =>
  (region?.atlas === partition.atlas && region.kind === 'cortex') ||
  (region?.atlas === partition.structure_atlas &&
    partition.structures.includes(region.source_name as string));

/** Every area or structure that reaches a domain, strongest first; ties keep the published order. */
export function domainAreas(
  partition: NeuropsychDomains,
  id: string,
): { region: string; z: number }[] {
  if (isTermId(id)) return (domainRecord(partition, id) as TermRecord).areas;
  return Object.entries(partition.regions)
    .flatMap(([region, members]) =>
      members.filter((member) => member.domain === id).map((member) => ({ region, z: member.z })),
    )
    .sort((a, b) => b.z - a.z);
}

/** The z-scale band a mean z falls in: the last whose start it reaches. */
export function zBand(partition: NeuropsychDomains, z: number): ZBand | undefined {
  // Array.prototype.findLast is ES2023; web/tsconfig.app.json lib is ES2022 (reported on #4).
  return partition.z_scale.reduceRight<ZBand | undefined>(
    (found, band) => found ?? (z >= band.from ? band : undefined),
    undefined,
  );
}

/**
 * The model paint for `ALL_DOMAINS`, each area in its strongest overview domain's colour, or for one
 * domain or searched term alone, each area in its z-scale band's colour.
 */
export function domainPaint(partition: NeuropsychDomains, id: string): Paint {
  if (id !== ALL_DOMAINS && !domainRecord(partition, id))
    throw new Error(`Unknown neuropsychological domain: ${id}`);
  if (id !== ALL_DOMAINS) {
    return {
      id: `function:${id}`,
      colors: new Map(
        domainAreas(partition, id).map(({ region, z }) => [region, zBand(partition, z)!.color]),
      ),
    };
  }
  const colors = new Map<string, Rgb>();
  for (const region of Object.keys(partition.regions)) {
    const shown = shownDomain(partition, region, null);
    if (shown) colors.set(region, shown.color);
  }
  return { id: `function:${id}`, colors };
}
