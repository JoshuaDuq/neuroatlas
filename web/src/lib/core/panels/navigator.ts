import type { Language, Region } from '../../types/index.ts';
import type { RegionLabel } from '../catalog/labels.ts';
import { t } from '../i18n/index.ts';

/** What the tree's naming and ordering read of a catalog group. */
interface NamedGroup {
  name: string;
  kind: string;
  rows: readonly { region: Pick<Region, 'id' | 'kind' | 'atlas'> }[];
}

type TreeGroup = NamedGroup & { key: string };

export type Vocabulary = 'system' | 'network' | 'lobe';

/** Reasons that mean "in a different atlas" rather than "hidden here". */
export const OTHER_ATLAS: ReadonlySet<unknown> = new Set(['other-atlas', 'other-cut-atlas']);
/** Reasons no control can undo: the row explains, and activating it does nothing. */
export const UNREVEALABLE: ReadonlySet<unknown> = new Set(['below-cut-resolution']);
/** Reasons a display setting gives many rows at once: said on the section caption, not on each row. */
const SETTING_REASONS: ReadonlySet<unknown> = new Set([
  'hemisphere',
  'cortex-hidden',
  'internal-hidden',
  'spinal-cord-hidden',
  'isolated',
  'no-cut',
  'other-system',
]);

/**
 * The next row an arrow key can arm.
 *
 * Disabled rows explain themselves and do nothing, so the key moves past
 * them. Past the ends of the list the armed row stays where it is.
 */
export function nextEnabledIndex(
  disabled: readonly boolean[],
  index: number,
  delta: number,
): number {
  const rowCount = disabled.length;
  if (!rowCount || !delta) return index;
  for (let step = 1; step <= rowCount; step += 1) {
    const next = index + delta * step;
    if (next < 0 || next >= rowCount) return index;
    if (!disabled[next]) return next;
  }
  return index;
}

/** The vocabulary a region's group name comes from. */
export function vocabularyOf(region: Pick<Region, 'kind' | 'atlas'>): Vocabulary {
  if (region.kind === 'structure' || region.kind === 'tissue-region') return 'system';
  return region.atlas === 'hcp-mmp' ? 'network' : 'lobe';
}

/** Group names that two vocabularies use at once, such as a Limbic lobe beside the Limbic system. */
export function sharedGroupNames(groups: readonly NamedGroup[]): Set<string> {
  const vocabularies = new Map<string, Set<Vocabulary>>();
  for (const group of groups) {
    const vocabulary = vocabularyOf(group.rows[0].region);
    vocabularies.set(group.name, (vocabularies.get(group.name) ?? new Set()).add(vocabulary));
  }
  return new Set([...vocabularies].filter(([, used]) => used.size > 1).map(([name]) => name));
}

/** A shared name says which vocabulary it is from; any other name is shown as the atlas gives it. */
export function groupDisplayName(
  name: string,
  region: Pick<Region, 'kind' | 'atlas'>,
  shared: ReadonlySet<string>,
  lang: Language,
): string {
  return shared.has(name) ? t(lang, 'navigator').groupIn[vocabularyOf(region)](name) : name;
}

/** Groups with their shown names, alphabetical by that name within each family, families kept in order. */
export function labelledGroups<G extends NamedGroup>(
  groups: readonly G[],
  lang: Language,
): { group: G; label: string }[] {
  const shared = sharedGroupNames(groups);
  const families = [...new Set(groups.map((group) => group.kind))];
  return groups
    .map((group) => ({
      group,
      label: groupDisplayName(group.name, group.rows[0].region, shared, lang),
    }))
    .sort(
      (a, b) =>
        families.indexOf(a.group.kind) - families.indexOf(b.group.kind) ||
        a.label.localeCompare(b.label, lang),
    );
}

/** The tree group that holds a region, named as the tree names it; null when the tree does not list it. */
export function regionGroup(
  groups: readonly TreeGroup[],
  id: string,
  lang: Language,
): { key: string; label: string } | null {
  const found = labelledGroups(groups, lang).find(({ group }) =>
    group.rows.some((row) => row.region.id === id),
  );
  return found ? { key: found.group.key, label: found.label } : null;
}

/**
 * Matches another atlas draws, under the first atlas (in manifest order) that draws each, so a
 * switch offered for them is one that shows them. `drawnBy` lists the atlases that draw a region.
 */
export function matchesElsewhere<R extends { region: Region }, A extends { id: string }>(
  rows: readonly R[],
  atlases: readonly A[],
  current: string,
  drawnBy: (region: Region) => readonly (string | null | undefined)[],
): { atlas: A; rows: R[] }[] {
  const others = atlases.filter((atlas) => atlas.id !== current);
  const homes = rows.map((row) => {
    const home = others.find((atlas) => drawnBy(row.region).includes(atlas.id));
    if (!home) throw new Error(`No other atlas draws ${row.region.id}`);
    return home;
  });
  return others
    .map((atlas) => ({ atlas, rows: rows.filter((_, index) => homes[index] === atlas) }))
    .filter((group) => group.rows.length);
}

interface StatedRow {
  visible: boolean;
  reason: string | null;
}

/** The display settings hiding rows of each section (kind → reasons, in the order met), said once on its caption. */
export function sectionReasons(
  groups: readonly { kind: string; rows: readonly StatedRow[] }[],
): Map<string, string[]> {
  const said = new Map<string, string[]>();
  for (const group of groups) {
    for (const { visible, reason } of group.rows) {
      if (visible || reason === null || !SETTING_REASONS.has(reason)) continue;
      const reasons = said.get(group.kind) ?? [];
      if (!reasons.includes(reason)) said.set(group.kind, [...reasons, reason]);
    }
  }
  return said;
}

/**
 * Whether a hidden tree row says why on the row itself. A setting's reason is on the section
 * caption and a removed part's struck eye says it, so only a reason of the row's own is printed.
 */
export function rowStatesReason(row: StatedRow): boolean {
  return !row.visible && row.reason !== 'removed' && !SETTING_REASONS.has(row.reason);
}

/** Shown, hidden, or partly hidden: a group eye stays in view while anything under it is hidden. */
export function visibilityStateOf(
  ids: readonly string[],
  hiddenRegions: ReadonlySet<string>,
): 'shown' | 'hidden' | 'partial' {
  const hiddenCount = ids.filter((id) => hiddenRegions.has(id)).length;
  if (hiddenCount === ids.length && ids.length) return 'hidden';
  return hiddenCount ? 'partial' : 'shown';
}

/** Accent-, case- and diacritic-blind form of a name, as search compares it. */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A run of a name, and whether the search query matched it. */
export interface MatchSegment {
  text: string;
  match: boolean;
}

/** A name split around the first accent- and case-insensitive occurrence of the query. */
export function matchSegments(text: string, query: string): MatchSegment[] {
  if (!query) return [{ text, match: false }];
  const index = fold(text).indexOf(fold(query));
  if (index === -1) return [{ text, match: false }];
  return [
    { text: text.slice(0, index), match: false },
    { text: text.slice(index, index + query.length), match: true },
    { text: text.slice(index + query.length), match: false },
  ].filter((segment) => segment.text);
}

/**
 * The code or alias that explains why a row matched when its name does not contain the query;
 * the code first, then the first alias that contains it. Null when the name itself matches.
 */
export function matchedAlias(
  label: Pick<RegionLabel, 'name' | 'code' | 'aliases'>,
  query: string,
): string | null {
  const folded = fold(query);
  if (fold(label.name).includes(folded)) return null;
  if (label.code && fold(label.code).includes(folded)) return label.code;
  return label.aliases.find((alias) => fold(alias).includes(folded)) ?? null;
}
