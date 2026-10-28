import type { Language, LoadProgress, SurfaceColor } from '../../types/index.ts';
import { percent } from '../format.ts';
import { atlasSwitchLabel, t } from '../i18n/index.ts';

/** The Colour field's groups, in order; the last choices stand on their own. */
const COLOUR_GROUPS: readonly (readonly [string | null, readonly SurfaceColor[]])[] = [
  ['appearance', ['tissue', 'mri']],
  ['parcellation', ['atlas']],
  ['networks', ['network', 'cab-np']],
  ['vascular', ['territory']],
];

interface NamedEntry {
  display_name?: string;
  subject?: string;
  id?: string;
}

/** The published title without its quotation marks: "SNAIL subj_1", dataset and subject together. */
export function subjectName(entry: NamedEntry | null | undefined): string {
  const name = String(entry?.display_name ?? '')
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name || entry?.subject || entry?.id || '';
}

export type SummaryPart = 'subject' | 'atlas' | 'colour' | 'detail';

/** What the collapsed masthead names, part by part: subject, atlas, colouring, internal anatomy, or the tract reference alone. */
export function dataSummary({
  subject,
  atlas,
  colour,
  detail,
  reference,
}: {
  subject?: string | null;
  atlas?: string | null;
  colour?: string | null;
  detail?: string | null;
  reference?: string | null;
}): { part: SummaryPart; text: string }[] {
  if (reference) return [{ part: 'subject', text: reference }];
  const parts: [SummaryPart, string | null | undefined][] = [
    ['subject', subject],
    ['atlas', atlas],
    ['colour', colour],
    ['detail', detail],
  ];
  return parts.flatMap(([part, text]) => (text ? [{ part, text }] : []));
}

/** The Colour field's optgroups, offering only the colourings this build publishes. */
export function colourGroups({
  networks,
  cabNp,
  territories,
}: {
  networks?: unknown;
  cabNp?: unknown;
  territories?: unknown;
}): [string | null, SurfaceColor[]][] {
  const published: Partial<Record<SurfaceColor, boolean>> = {
    network: Boolean(networks),
    'cab-np': Boolean(cabNp),
    territory: Boolean(territories),
  };
  return COLOUR_GROUPS.map((entry): [string | null, SurfaceColor[]] => [
    entry[0],
    entry[1].filter((mode) => published[mode] ?? true),
  ]).filter(([, modes]) => modes.length);
}

/** A Colour option names the atlas it switches to when it is defined on another atlas's areas. */
export function colourOption(
  lang: Language,
  mode: SurfaceColor,
  { atlas, required }: { atlas: string; required?: string | null },
): string {
  const name = t(lang, 'display').surfaceColors[mode];
  return required && required !== atlas
    ? t(lang, 'header').atlasBecomes(name, atlasSwitchLabel(required, lang))
    : name;
}

/** An Atlas option names the colouring it drops when the one shown is defined on another atlas. */
export function atlasOption(lang: Language, id: string, required?: string | null): string {
  const name = atlasSwitchLabel(id, lang);
  return required && required !== id
    ? t(lang, 'header').colourBecomes(name, t(lang, 'display').surfaceColors.atlas)
    : name;
}

/** How far a download has come, or that it has started. */
export function loadingText(lang: Language, progress?: LoadProgress | null): string {
  const copy = t(lang, 'header');
  return progress?.total
    ? copy.loadingProgress(percent(progress.loaded / progress.total, lang))
    : copy.loading;
}

/** The status bar's statement, then what is loaded, named as the masthead names it; alone until something is. */
export function colophonParts(
  lang: Language,
  {
    anatomy,
    reference,
  }: { anatomy?: NamedEntry & { individual: boolean }; reference?: { label: string } } = {},
): { description: string; statement: string } {
  const copy = t(lang, 'footer');
  const description = reference
    ? copy.referenceColophon(reference.label)
    : anatomy
      ? copy.colophon(subjectName(anatomy), anatomy.individual)
      : '';
  return { description, statement: copy.statementAlone };
}
