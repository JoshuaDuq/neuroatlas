import type { Language, Manifest } from '../../types/index.ts';
import type { Translated } from '../clinical/types.ts';
import { domainName, type NeuropsychDomains } from '../catalog/neuropsych-domains.ts';
import { percent } from '../format.ts';
import { t } from '../i18n/index.ts';

export interface ProvenanceLink {
  href: string;
  text: string;
  mono?: boolean;
}

/** One fact of the provenance sheet: a name, a note under it, and the citation that backs it. */
export interface ProvenanceItem {
  text?: string;
  note?: string | null;
  mono?: boolean;
  link?: ProvenanceLink | null;
}

export interface ProvenanceRow {
  label: string;
  items: ProvenanceItem[];
}

/** The fields of a published section the sheet reads. */
interface Described {
  label?: string;
  citation?: string;
  license?: string;
  license_url?: string;
  license_file?: string;
  citations?: string[];
}

/** One lesion check of a domain (`neuropsych-domains.json`'s `lesion_checks`). */
interface LesionCheck {
  deficit_name: Translated;
  references: string[];
  mappings: { source_name: string; region: string; coverage: number | null }[];
}

/** A URL as a reader scans it: no scheme, no trailing slash. */
export const shortUrl = (url: unknown): string =>
  String(url)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

const link = (href: string | undefined) => (href ? { href, text: shortUrl(href) } : null);

/** How much of each parcel one lesion check maps a domain's coloured areas cover. */
export function checkedParcels(check: LesionCheck, lang: Language): string {
  const copy = t(lang, 'domains');
  const glyphs: Record<string, string | undefined> = t(lang, 'sides').glyphs;
  return check.mappings
    .map((mapping) => {
      // Bilateral findings name one parcel twice; the side tells them apart.
      const parcel = `${mapping.source_name} (${glyphs[mapping.region.split(':')[1]]})`;
      return mapping.coverage === null
        ? copy.parcelOffSurface(parcel)
        : copy.parcelCoverage(parcel, percent(mapping.coverage, lang));
    })
    .join(', ');
}

/** Every lesion check of a domain, as one note. */
function lesionCheck(checks: readonly LesionCheck[], lang: Language): string {
  const copy = t(lang, 'domains');
  if (!checks.length) return copy.noLesionCheck;
  return copy.lesionCheck(
    checks.map((check) =>
      copy.lesionItem(
        check.deficit_name[lang],
        check.references.join(', '),
        checkedParcels(check, lang),
      ),
    ),
  );
}

/**
 * What the loaded anatomy's own published records say about where it came from,
 * as labelled rows. Only fields present in the index entry and manifest appear.
 */
export function provenanceRows(
  manifest: Partial<Manifest>,
  {
    lang = 'en',
    manifestUrl,
    indexUrl,
    domains = null,
  }: {
    lang?: Language;
    manifestUrl?: string;
    indexUrl?: string;
    domains?: NeuropsychDomains | null;
  } = {},
): ProvenanceRow[] {
  const copy = t(lang, 'footer');
  const names: Record<string, string | undefined> = t(lang, 'atlases');
  const anatomy = manifest.anatomy;
  const rows: ProvenanceRow[] = [];
  const add = (label: string, items: (ProvenanceItem | null | undefined | false | '')[]) => {
    const kept = items.filter((item): item is ProvenanceItem => Boolean(item));
    if (kept.length) rows.push({ label, items: kept });
  };

  add(copy.subject, [
    anatomy?.display_name && {
      text: anatomy.display_name,
      note: typeof anatomy.individual === 'boolean' ? copy.kind(anatomy.individual) : null,
    },
  ]);
  add(copy.sourceData, [anatomy?.source_url && { link: link(anatomy.source_url) }]);
  add(copy.reconstruction, [
    anatomy?.reconstruction && { text: anatomy.reconstruction, mono: true },
  ]);
  // A licence the manifest publishes beside its own directory; the href resolves `..` when followed.
  const licence = (file: string | undefined) =>
    file &&
    manifestUrl && {
      link: {
        href: manifestUrl.replace(/[^/]*$/, '') + file,
        text: file.split('/').pop()!,
        mono: true,
      },
    };
  add(
    copy.atlases,
    (manifest.atlases ?? []).flatMap((atlas) => [
      {
        text: names[atlas.id] ?? atlas.label,
        note:
          atlas.id === 'hcp-mmp' && anatomy?.hcp_projected_from
            ? copy.projectedFrom(anatomy.hcp_projected_from)
            : null,
        link: link(atlas.citation),
      },
      licence(atlas.license_file),
    ]),
  );
  const networks = manifest.networks as Described | undefined;
  const cabNp = manifest.cab_np as Described | undefined;
  add(copy.networks, [
    networks?.label && { text: networks.label, link: link(networks.citation) },
    cabNp && { text: cabNp.label, note: cabNp.license, link: link(cabNp.citation) },
    cabNp && licence(cabNp.license_file),
  ]);
  const functional = manifest.functional_regions as Described | undefined;
  add(
    copy.functional,
    functional
      ? [
          { text: functional.label },
          ...functional.citations!.map((citation) => ({ link: link(citation) })),
        ]
      : [],
  );
  const domainCopy = t(lang, 'domains');
  const published = manifest.neuropsych_domains as Described | undefined;
  add(
    copy.domains,
    published
      ? [
          { text: published.label, note: published.license, link: link(published.license_url) },
          ...published.citations!.map((citation) => ({ link: link(citation) })),
          // Each domain's term, and how much of each lesion-mapped parcel its coloured areas cover.
          ...(domains?.domains ?? []).map((domain) => ({
            text: domainCopy.termOf(domainName(domain, lang), domain.term),
            note: lesionCheck(domains!.lesion_checks[domain.id] as LesionCheck[], lang),
          })),
        ]
      : [],
  );
  add(
    copy.supplemental,
    (manifest.supplemental_layers ?? []).map((layer) => ({
      text: names[layer.id] ?? layer.label,
      note: [layer.license, layer.attribution].filter(Boolean).join(' · ') || null,
      link: link(layer.citation),
    })),
  );

  const sources =
    (manifest.provenance as { sources?: { sha256?: string }[] } | undefined)?.sources ?? [];
  const checksummed = sources.filter((source) => source.sha256).length;
  add(copy.files, [
    manifestUrl && {
      link: { href: manifestUrl, text: 'manifest.json', mono: true },
      note: sources.length
        ? copy.sourceFiles(sources.length, checksummed === sources.length)
        : null,
    },
    indexUrl && { link: { href: indexUrl, text: 'anatomies.json', mono: true }, note: copy.index },
  ]);
  return rows;
}

/** The tract reference is another subject: its rows come from the tract panel's own links. */
export function referenceRows(
  reference: { label: string; links: readonly ProvenanceLink[] },
  lang: Language = 'en',
): ProvenanceRow[] {
  const copy = t(lang, 'footer');
  return [
    { label: copy.tractReference, items: [{ text: reference.label }] },
    ...(reference.links.length
      ? [{ label: copy.sources, items: reference.links.map((entry) => ({ link: entry })) }]
      : []),
  ];
}
