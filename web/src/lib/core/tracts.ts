import type { TractBundle as LoadedBundle } from '../engine/api.ts';
import type { Language } from '../types/index.ts';
import type { TractBundle } from './diffusion/catalogs.ts';
import { decimal, percent, withUnit } from './format.ts';

/** The length filter's range in millimetres; `max` is the legacy slider's (native-ui.js:55). */
export const MINIMUM_LENGTH = { min: 1, max: 250, step: 1 } as const;

const SIDES: readonly string[] = ['left', 'right'];

export interface TractRow {
  key: string;
  sided: boolean;
  members: { bundle: TractBundle; part: string }[];
}

/** One row per tract: a bundle's left and right files pair up, numbered segments share a row. */
export function tractRows(bundles: readonly TractBundle[]): TractRow[] {
  const rows = new Map<string, TractRow>();
  for (const bundle of bundles) {
    const match = bundle.id.match(/^(.+)-(left|right|\d+)$/);
    if (!match) throw new Error(`Tract bundle ${bundle.id} names neither a side nor a segment.`);
    const [, key, part] = match as unknown as [string, string, string];
    let row = rows.get(key);
    if (!row) {
      row = { key, sided: SIDES.includes(part), members: [] };
      rows.set(key, row);
    }
    if (row.sided !== SIDES.includes(part)) {
      throw new Error(`Tract ${key} mixes sides and segments.`);
    }
    row.members.push({ bundle, part });
  }
  for (const row of rows.values()) {
    if (row.sided) row.members.sort((a, b) => SIDES.indexOf(a.part) - SIDES.indexOf(b.part));
  }
  return [...rows.values()];
}

/** What the members' names share: the tract before " · side", or before the segment number. */
export function tractRowName(row: TractRow, lang: Language): string {
  const stems = row.members.map(({ bundle }) => {
    const name = bundle.name[lang];
    const cut = name.lastIndexOf(' · ');
    if (cut < 0) throw new Error(`Tract name "${name}" has no qualifier.`);
    return row.sided ? name.slice(0, cut) : name.replace(/\s*\d+$/, '');
  });
  if (new Set(stems).size !== 1) {
    throw new Error(`Tract ${row.key} members disagree on a name: ${stems.join(' / ')}`);
  }
  return stems[0]!;
}

/** Lower case with the accents folded, so "arque" finds "Arqué" (decision 42 on #4). */
export function foldForSearch(text: string, lang: Language): string {
  return text.toLocaleLowerCase(lang).normalize('NFD').replace(/\p{M}/gu, '');
}

/** The text a query is matched against: the row's name and every member's name. */
export function tractSearchText(row: TractRow, lang: Language): string {
  return foldForSearch(
    [tractRowName(row, lang), ...row.members.map(({ bundle }) => bundle.name[lang])].join(' '),
    lang,
  );
}

/** Mean with its range, as a paper writes it, in the reader's notation (decimal comma in French). */
export function lengthSummary(
  { mean, min, max }: Pick<LoadedBundle, 'mean' | 'min' | 'max'>,
  text: { mean: string; range: string },
  lang: Language,
): string {
  const mm = (value: number | null) => decimal(value, 1, lang);
  return `${text.mean} ${withUnit(mm(mean), 'mm', lang)} (${text.range} ${mm(min)}–${mm(max)})`;
}

/** The closed settings disclosure still says what it holds: opacity, then the length filter. */
export function settingsReadout(opacity: number, minimum: number, lang: Language): string {
  return `${percent(opacity, lang)} · ≥${withUnit(decimal(minimum, 0, lang), 'mm', lang)}`;
}

export const LENGTHS_CSV_FILENAME = 'planum-streamline-lengths.csv';

/**
 * The lengths of the bundles loaded so far, one CSV row each (the native viewer's `snapshot()`), in
 * English whatever the interface language. A hidden bundle counts as zero shown, with blank metrics.
 */
export function buildLengthsCsv(bundles: readonly LoadedBundle[], minimum: number): string {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    'bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm',
  ];
  for (const bundle of bundles) {
    // A leading = + - @ would be run as a formula by a spreadsheet.
    const name = /^[=+\-@]/.test(bundle.name) ? `'${bundle.name}` : bundle.name;
    const shown = bundle.visible ? bundle.shown : 0;
    rows.push(
      [
        quote(name),
        bundle.total,
        shown,
        minimum,
        ...[bundle.mean, bundle.min, bundle.max].map((value) => (shown ? value : '')),
      ].join(','),
    );
  }
  return `${rows.join('\n')}\n`;
}
