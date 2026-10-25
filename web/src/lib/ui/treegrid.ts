// Pure logic of the APG treegrid (https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/). Ported from
// the legacy anatomy tree, viewer/ui/panels/navigator.js:10-36 (`treeKeyAction`, `controlKeyAction`);
// the departures are in docs/decisions/deviations/u7-treegrid-keys.md.

export interface TreegridNode<T> {
  id: string;
  /** The text type-ahead matches. */
  label: string;
  data: T;
  children?: readonly TreegridNode<T>[];
}

export interface TreegridRow<T> {
  node: TreegridNode<T>;
  parentId: string | null;
  /** `aria-level`, 1-based. */
  level: number;
  /** `aria-posinset` among all siblings, and `aria-setsize` (children are rendered only while expanded). */
  posinset: number;
  setsize: number;
  expandable: boolean;
  expanded: boolean;
}

/** The rows in view, in order: children appear only under an expanded parent. */
export function visibleRows<T>(
  nodes: readonly TreegridNode<T>[],
  expanded: ReadonlySet<string>,
  parentId: string | null = null,
  level = 1,
): TreegridRow<T>[] {
  return nodes.flatMap((node, index) => {
    const expandable = (node.children?.length ?? 0) > 0;
    const open = expandable && expanded.has(node.id);
    const row: TreegridRow<T> = {
      node,
      parentId,
      level,
      posinset: index + 1,
      setsize: nodes.length,
      expandable,
      expanded: open,
    };
    return open ? [row, ...visibleRows(node.children!, expanded, node.id, level + 1)] : [row];
  });
}

/** Every parent's id: the set of "expand all". Collapse all is the empty set. */
export function expandableIds<T>(nodes: readonly TreegridNode<T>[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: readonly TreegridNode<T>[]) => {
    for (const node of list) {
      if (node.children?.length) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

export type RowAction =
  | 'next'
  | 'previous'
  | 'first'
  | 'last'
  | 'activate'
  | 'firstCell'
  | 'expand'
  | 'collapse'
  | 'parent'
  | 'expandSiblings';

/**
 * What a key does with focus on a row. Right on a collapsed parent expands it, otherwise moves to the
 * row's first cell; Left on an expanded parent collapses it, otherwise moves to the parent row.
 */
export function rowKeyAction(
  key: string,
  { expandable, expanded }: { expandable: boolean; expanded: boolean },
): RowAction | null {
  switch (key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Enter':
    case ' ':
      return 'activate';
    case 'ArrowRight':
      return expandable && !expanded ? 'expand' : 'firstCell';
    case 'ArrowLeft':
      return expandable && expanded ? 'collapse' : 'parent';
    case '*':
      return 'expandSiblings';
    default:
      return null;
  }
}

export type CellAction =
  | 'nextCell'
  | 'previousCell'
  | 'firstCell'
  | 'lastCell'
  | 'row'
  | 'next'
  | 'previous'
  | 'first'
  | 'last';

/** What a key does with focus in a cell; Enter and Space stay the cell button's own. */
export function cellKeyAction(
  key: string,
  { first, last }: { first: boolean; last: boolean },
  ctrl = false,
): CellAction | null {
  switch (key) {
    case 'ArrowRight':
      return last ? null : 'nextCell';
    case 'ArrowLeft':
      return first ? 'row' : 'previousCell';
    case 'Escape':
      return 'row';
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'previous';
    case 'Home':
      return ctrl ? 'first' : 'firstCell';
    case 'End':
      return ctrl ? 'last' : 'lastCell';
    default:
      return null;
  }
}

/** The index a row move lands on, kept inside `count` rows (past the ends the focus stays). */
export function movedIndex(
  action: 'next' | 'previous' | 'first' | 'last',
  index: number,
  count: number,
): number {
  switch (action) {
    case 'next':
      return Math.min(index + 1, count - 1);
    case 'previous':
      return Math.max(index - 1, 0);
    case 'first':
      return 0;
    case 'last':
      return count - 1;
  }
}

/** A key that extends or starts a type-ahead query: one printable character, no command modifier. */
export const isTypeAheadKey = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>,
) =>
  event.key.length === 1 &&
  event.key !== ' ' &&
  event.key !== '*' &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.metaKey;

/**
 * The row type-ahead lands on (APG tree/listbox type-ahead): the first label after `current` that
 * starts with `query`, wrapping; a query of one repeated letter cycles through that letter. -1 for none.
 */
export function typeAheadMatch(labels: readonly string[], current: number, query: string): number {
  const folded = query.toLocaleLowerCase();
  const cycling = [...folded].every((character) => character === folded[0]);
  const needle = cycling ? folded[0] : folded;
  const start = cycling ? current + 1 : Math.max(current, 0);
  for (let step = 0; step < labels.length; step += 1) {
    const index = (start + step) % labels.length;
    if (labels[index].toLocaleLowerCase().startsWith(needle)) return index;
  }
  return -1;
}

/**
 * Where the Tab stop and restored focus go when the row that held them left the view: the nearest
 * ancestor still shown, else the first row (navigator.js:224-239 `focusSelectors`, nearest first).
 */
export function survivingRowId<T>(
  rows: readonly TreegridRow<T>[],
  wanted: string | null,
  parentOf: ReadonlyMap<string, string | null>,
): string | null {
  const shown = new Set(rows.map((row) => row.node.id));
  for (let id = wanted; id !== null; id = parentOf.get(id) ?? null) {
    if (shown.has(id)) return id;
  }
  return rows[0]?.node.id ?? null;
}
