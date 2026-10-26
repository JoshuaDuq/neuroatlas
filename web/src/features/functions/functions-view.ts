// What the Functions list and profile say, as plain data (viewer/ui/panels/functions.js:50-67,
// 173-318, 421-456). The components only draw it.
import { functionalName, functionalRegionOf } from '../../lib/core/catalog/functional-regions.ts';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import {
  ALL_DOMAINS,
  domainAreas,
  domainName,
  domainRecord,
  domainStudies,
  groupedDomains,
  isTermId,
  matchingTerms,
  nearestName,
  overviewDomains,
  type Domain,
  type NeuropsychDomains,
  type TermRecord,
} from '../../lib/core/catalog/neuropsych-domains.ts';
import { count, decimal } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { checkedParcels } from '../../lib/core/panels/provenance.ts';
import type { Region, Language, Rgb } from '../../lib/types/index.ts';

/** Areas listed before the rest fold under a disclosure. */
export const AREAS_SHOWN = 12;
/** Searched terms listed under the curated functions; the rest wait for a narrower query. */
export const TERMS_SHOWN = 20;

/** How many of the regions a domain reaches are areas and how many structures. */
function reachedCounts(partition: NeuropsychDomains, id: string): [number, number] {
  const reached = domainAreas(partition, id);
  const structures = reached.filter(({ region }) =>
    region.startsWith(`${partition.structure_atlas}:`),
  ).length;
  return [reached.length - structures, structures];
}

/** The areas and structures a domain reaches at the threshold, as the profile says it. */
export const areaCount = (partition: NeuropsychDomains, id: string, lang: Language): string =>
  t(lang, 'functions').areas(
    ...reachedCounts(partition, id),
    decimal(partition.threshold_z, 0, lang),
  );

/** The same count as a list row says it, beside the row's other facts. */
export const areaCountShort = (partition: NeuropsychDomains, id: string, lang: Language): string =>
  t(lang, 'functions').areasShort(...reachedCounts(partition, id));

export interface FunctionRow {
  id: string;
  name: string;
  /** Null for the overview row. */
  studies: number | null;
  /** Read, not shown: the row's name continues with it. */
  detail: string;
  /** The colour the function's areas take on the brain; a searched term has none. */
  colour: Rgb | null;
  /** A searched term is English whatever the reader's language. */
  lang: Language | null;
}

export interface FunctionGroup {
  id: string;
  name: string;
  rows: FunctionRow[];
}

export interface FunctionList {
  /** The "All functions" row, which opens the overview; absent while searching. */
  overview: FunctionRow | null;
  groups: FunctionGroup[];
  /** Searched terms follow the curated groups, clinical groups apart from the rest. */
  termGroups: FunctionGroup[];
  /** Matching terms past the `TERMS_SHOWN` listed. */
  termsMore: number;
  /** How many curated functions and how many Neurosynth terms the query matches. */
  matches: { functions: number; terms: number };
  /** The nearest name when nothing matches. */
  suggestion: string | null;
}

/** The list for `query`: curated functions under their groups, then the Neurosynth terms that match. */
export function functionList(
  domains: NeuropsychDomains,
  rawQuery: string,
  lang: Language,
): FunctionList {
  const copy = t(lang, 'functions');
  const query = rawQuery.trim();
  const curated = groupedDomains(domains, query, lang);
  const terms = matchingTerms(domains, query);
  const row = (record: Domain | TermRecord, searched: boolean): FunctionRow => {
    const studies = domainStudies(domains, record.id);
    return {
      id: record.id,
      name: searched ? record.term : domainName(record, lang),
      studies,
      detail: copy.termDetail(
        count(studies, 'study', lang),
        areaCountShort(domains, record.id, lang),
      ),
      colour: searched ? null : (record as Domain).color,
      lang: searched && lang !== 'en' ? 'en' : null,
    };
  };
  const shown = terms.slice(0, TERMS_SHOWN);
  return {
    overview: query
      ? null
      : {
          id: ALL_DOMAINS,
          name: copy.all,
          studies: null,
          detail: copy.allDetail,
          colour: null,
          lang: null,
        },
    groups: curated.map(({ group, name, domains: members }) => ({
      id: group.id,
      name,
      rows: members.map((record) => row(record, false)),
    })),
    termGroups: (['function', 'population'] as const).flatMap((kind) => {
      const rows = shown.filter((record) => record.kind === kind);
      return rows.length
        ? [
            {
              id: `terms-${kind}`,
              name: kind === 'function' ? copy.termsHeading : copy.populationsHeading,
              rows: rows.map((record) => row(record, true)),
            },
          ]
        : [];
    }),
    termsMore: Math.max(0, terms.length - TERMS_SHOWN),
    matches: {
      functions: curated.reduce((sum, entry) => sum + entry.domains.length, 0),
      terms: terms.length,
    },
    suggestion:
      query && !curated.length && !terms.length ? nearestName(domains, query, lang) : null,
  };
}

/** The result-count sentence a search says (`results`). */
export const resultsSentence = (matches: FunctionList['matches'], lang: Language): string =>
  t(lang, 'functions').results(matches.functions, matches.terms);

export interface AreaRow {
  region: string;
  /** "Name · Side". */
  name: string;
  division: string | null;
  /** The z score as the row prints it. */
  z: string;
}

export interface LesionRow {
  deficit: string;
  name: string;
  detail: string;
}

export interface OverviewLink {
  id: string;
  name: string;
  detail: string;
  colour: Rgb;
}

/** What the profile of one function shows, below its name. */
export interface FunctionProfileContent {
  all: boolean;
  searched: boolean;
  /** The function's own name, or "All functions". */
  name: string;
  /** A searched term, for the kind line; null for a curated function and the overview. */
  term: { before: string; term: string; after: string } | null;
  caveat: string;
  /** Searched clinical group: the Deficits tab's lesion profiles for the same words. */
  lesionBridge: { text: string; query: string } | null;
  overview: OverviewLink[];
  areas: AreaRow[];
  noAreas: string;
  lesions: LesionRow[] | null;
  method: string;
  citation: string;
}

type LesionCheck = Parameters<typeof checkedParcels>[0] & {
  deficit: string;
  deficit_name: Record<Language, string>;
};

/** The profile of `id`: the overview, a searched term or a curated function. */
export function functionProfile(
  {
    domains,
    anatomy,
    functionalRegions,
    deficitsMatching,
  }: {
    domains: NeuropsychDomains;
    anatomy: { get(id: string): { region: Region; label: { name: string } } | null };
    functionalRegions: FunctionalRegions | null;
    deficitsMatching: (query: string, lang: Language) => number;
  },
  id: string,
  lang: Language,
): FunctionProfileContent {
  const copy = t(lang, 'functions');
  const domainCopy = t(lang, 'domains');
  const all = id === ALL_DOMAINS;
  const searched = isTermId(id);
  const record = all ? null : domainRecord(domains, id);
  if (!all && !record) throw new Error(`Unknown function: ${id}`);
  const source = (domains.sources as Record<string, { short: string; citation: string }>)[
    domains.scores_source as string
  ];
  const sides = t(lang, 'sides').capitalized;

  const areas = all
    ? []
    : domainAreas(domains, id).map(({ region, z }): AreaRow => {
        const entry = anatomy.get(region);
        if (!entry) throw new Error(`Unknown region in function ${id}: ${region}`);
        const division =
          functionalRegionOf(functionalRegions, 'named', region) ??
          functionalRegionOf(functionalRegions, 'sections', region);
        return {
          region,
          name: `${entry.label.name} · ${sides[entry.region.hemisphere]}`,
          division: division ? functionalName(division, lang) : null,
          z: decimal(z, 1, lang),
        };
      });

  const population = record?.kind === 'population';
  const found = searched && population ? deficitsMatching((record as TermRecord).term, lang) : 0;
  const checks =
    !all && !searched ? (domains.lesion_checks as Record<string, LesionCheck[]>)[id] : null;

  let term: FunctionProfileContent['term'] = null;
  if (record) {
    // The study count arrives as words; the term, as the English it is, is marked by the caller.
    const [before, after] = copy
      .term('\u0000', count(domainStudies(domains, id), 'study', lang))
      .split('\u0000');
    term = { before, term: record.term, after };
  }

  return {
    all,
    searched,
    name: all ? copy.all : domainName(record!, lang),
    term,
    caveat: !searched ? copy.caveat : population ? copy.populationCaveat : copy.termCaveat,
    lesionBridge: found
      ? {
          text: copy.deficitBridge(found, (record as TermRecord).term),
          query: (record as TermRecord).term,
        }
      : null,
    overview: all
      ? overviewDomains(domains).map((domain) => ({
          id: domain.id,
          name: domainName(domain, lang),
          detail: areaCountShort(domains, domain.id, lang),
          colour: domain.color,
        }))
      : [],
    areas,
    noAreas: copy.none(decimal(domains.threshold_z, 0, lang)),
    lesions: checks
      ? checks.map((check) => ({
          deficit: check.deficit,
          name: check.deficit_name[lang],
          detail: `${check.references.join(', ')} · ${checkedParcels(check, lang)}`,
        }))
      : null,
    method: domainCopy.note(source.short),
    citation: source.citation,
  };
}
