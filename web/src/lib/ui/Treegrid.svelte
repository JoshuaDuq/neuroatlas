<script lang="ts" generics="T">
  // Hand-rolled WAI-ARIA APG treegrid (Bits UI has none; decision 0002). One Tab stop: the focused
  // row or cell. A row is a cell for the primary control (name/select) followed by one cell per
  // action, so each button sits in its own cell and none is nested inside another control.
  // Only the first control of a cell is in the arrow-key order; the rest are pointer-only.
  import { onMount, type Snippet } from 'svelte';
  import {
    cellKeyAction,
    isTypeAheadKey,
    movedIndex,
    rowKeyAction,
    survivingRowId,
    typeAheadMatch,
    visibleRows,
    type TreegridNode,
  } from './treegrid.ts';

  interface Props {
    /** The grid's accessible name. */
    label: string;
    nodes: readonly TreegridNode<T>[];
    /** Ids of the expanded parents. Replaced, never mutated. */
    expanded?: Set<string>;
    /** The chosen row (`aria-selected`); leave undefined for a grid whose rows are not selectable. */
    selectedId?: string | null;
    /** Ids of the trailing action cells, in order. */
    actions?: readonly string[];
    /** The first cell. `toggle` expands or collapses the row, for a pointer control. */
    primary: Snippet<
      [node: TreegridNode<T>, state: { expanded: boolean; level: number; toggle: () => void }]
    >;
    /** The content of one action cell. */
    action?: Snippet<[node: TreegridNode<T>, id: string]>;
    /** Enter or Space on a row. */
    onactivate?: (node: TreegridNode<T>) => void;
    /** Single-key shortcuts on a row or in a cell, by lower-case key (the legacy `V` for visibility). */
    rowKeys?: Record<string, (node: TreegridNode<T>) => void>;
  }

  let {
    label,
    nodes,
    expanded = $bindable(new Set<string>()),
    selectedId,
    actions = [],
    primary,
    action,
    onactivate,
    rowKeys = {},
  }: Props = $props();

  const CONTROL = 'button, a[href], input, select, textarea, [tabindex]';
  const TYPE_AHEAD_MS = 500;

  let grid: HTMLElement;
  const rows = $derived(visibleRows(nodes, expanded));
  const parents = new Map<string, string | null>();
  // The Tab stop: a row (`cell` null) or one of its cells.
  let stop: { id: string | null; cell: number | null } = { id: null, cell: null };
  let focusWithin = false;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  let query = '';
  let queryTimer: ReturnType<typeof setTimeout> | undefined;

  const rowElement = (id: string) =>
    [...grid.querySelectorAll<HTMLElement>('[role="row"]')].find((row) => row.dataset.id === id);
  const cellTarget = (cell: HTMLElement) => cell.querySelector<HTMLElement>(CONTROL) ?? cell;
  /** The cells of a row that can take focus, in DOM order. */
  const cellsOf = (row: HTMLElement) =>
    [...row.querySelectorAll<HTMLElement>(':scope > [role="gridcell"]')].filter(
      (cell) => !cellTarget(cell).matches(':disabled'),
    );

  function rememberParents(list: readonly TreegridNode<T>[], parent: string | null) {
    for (const node of list) {
      parents.set(node.id, parent);
      if (node.children) rememberParents(node.children, node.id);
    }
  }

  /** The Tab stop is the focused row or cell; if it left the view, the nearest row still shown. */
  function sync() {
    rememberParents(nodes, null);
    const id = survivingRowId(rows, stop.id, parents);
    if (id !== stop.id) stop = { id, cell: null };
    for (const element of grid.querySelectorAll<HTMLElement>(`[role="row"], ${CONTROL}`)) {
      element.tabIndex = -1;
    }
    for (const cell of grid.querySelectorAll<HTMLElement>('[role="gridcell"]')) {
      if (cellTarget(cell) === cell) cell.tabIndex = -1;
    }
    if (id === null) return;
    const row = rowElement(id)!;
    const cell = stop.cell === null ? undefined : cellsOf(row)[stop.cell];
    if (stop.cell !== null && !cell) stop = { id, cell: null };
    (cell ? cellTarget(cell) : row).tabIndex = 0;
  }

  function focusRow(id: string) {
    stop = { id, cell: null };
    sync();
    rowElement(id)!.focus();
  }

  function focusCell(id: string, cell: number) {
    stop = { id, cell };
    sync();
    cellTarget(cellsOf(rowElement(id)!)[cell]).focus();
  }

  function onfocusin(event: FocusEvent) {
    clearTimeout(leaveTimer);
    focusWithin = true;
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('[role="row"]');
    if (!row) return;
    const cell = target === row ? null : target.closest<HTMLElement>('[role="gridcell"]');
    stop = { id: row.dataset.id!, cell: cell ? cellsOf(row).indexOf(cell) : null };
    if (stop.cell === -1) stop.cell = null;
    sync();
  }

  function onfocusout(event: FocusEvent) {
    // A control that is removed or replaced loses focus without a destination, and the rebuild that
    // did it is observed in a microtask: leaving the grid is only counted once that has run.
    if (!event.relatedTarget) leaveTimer = setTimeout(() => (focusWithin = false));
  }

  function typeAhead(key: string) {
    clearTimeout(queryTimer);
    queryTimer = setTimeout(() => (query = ''), TYPE_AHEAD_MS);
    query += key;
    const current = rows.findIndex((row) => row.node.id === stop.id);
    const match = typeAheadMatch(
      rows.map((row) => row.node.label),
      current,
      query,
    );
    if (match !== -1) focusRow(rows[match].node.id);
  }

  function setExpanded(ids: Iterable<string>, open: boolean) {
    const next = new Set(expanded);
    for (const id of ids) {
      if (open) next.add(id);
      else next.delete(id);
    }
    expanded = next;
  }

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const rowElementUnderFocus = target.closest<HTMLElement>('[role="row"]');
    if (!rowElementUnderFocus || event.altKey || event.metaKey) return;
    const onRow = target === rowElementUnderFocus;
    // A field inside a cell keeps its own keys.
    if (!onRow && target.matches('input, select, textarea')) return;
    const index = rows.findIndex((row) => row.node.id === rowElementUnderFocus.dataset.id);
    const row = rows[index];
    const { key } = event;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    // A shortcut key starts a query only if one is not already being typed: "v" toggles, "ve" finds.
    if (onRow && isTypeAheadKey(event) && (query !== '' || !rowKeys[key.toLowerCase()])) {
      handled();
      typeAhead(key);
      return;
    }
    if (onRow && key === ' ' && query !== '') {
      handled();
      typeAhead(key);
      return;
    }
    if (isTypeAheadKey(event) && rowKeys[key.toLowerCase()]) {
      handled();
      rowKeys[key.toLowerCase()](row.node);
      return;
    }
    if (event.shiftKey && key.length > 1) return;
    if (event.ctrlKey && key !== 'Home' && key !== 'End') return;

    if (onRow) {
      const act = rowKeyAction(key, row);
      if (!act) return;
      handled();
      switch (act) {
        case 'next':
        case 'previous':
        case 'first':
        case 'last':
          focusRow(rows[movedIndex(act, index, rows.length)].node.id);
          break;
        case 'activate':
          onactivate?.(row.node);
          break;
        case 'firstCell':
          if (cellsOf(rowElementUnderFocus).length) focusCell(row.node.id, 0);
          break;
        case 'expand':
          setExpanded([row.node.id], true);
          break;
        case 'collapse':
          setExpanded([row.node.id], false);
          break;
        case 'parent':
          if (row.parentId !== null) focusRow(row.parentId);
          break;
        case 'expandSiblings': {
          const siblings = rows.filter(
            (other) => other.parentId === row.parentId && other.expandable,
          );
          setExpanded(
            siblings.map((sibling) => sibling.node.id),
            true,
          );
          break;
        }
      }
      return;
    }

    const cells = cellsOf(rowElementUnderFocus);
    const cell = cells.indexOf(target.closest<HTMLElement>('[role="gridcell"]')!);
    const act = cellKeyAction(
      key,
      { first: cell <= 0, last: cell === cells.length - 1 },
      event.ctrlKey,
    );
    if (!act) return;
    handled();
    switch (act) {
      case 'nextCell':
        focusCell(row.node.id, cell + 1);
        break;
      case 'previousCell':
        focusCell(row.node.id, cell - 1);
        break;
      case 'firstCell':
        focusCell(row.node.id, 0);
        break;
      case 'lastCell':
        focusCell(row.node.id, cells.length - 1);
        break;
      case 'row':
        focusRow(row.node.id);
        break;
      default: {
        // The same cell in the adjacent row, or the last one it has.
        const destination = rows[movedIndex(act, index, rows.length)].node.id;
        const count = cellsOf(rowElement(destination)!).length;
        if (count) focusCell(destination, Math.min(cell, count - 1));
        else focusRow(destination);
      }
    }
  }

  // onMount, not $effect: the observer must outlive every change of rows it is there to catch.
  onMount(() => {
    grid.addEventListener('keydown', onkeydown);
    grid.addEventListener('focusin', onfocusin);
    grid.addEventListener('focusout', onfocusout);
    // A rebuild (children shown or hidden, a button replaced in place) can drop the focused
    // element: put focus back on the Tab stop (navigator.js:224-239, 570-598).
    const observer = new MutationObserver(() => {
      sync();
      if (focusWithin && !grid.contains(document.activeElement)) {
        if (stop.id === null) return;
        if (stop.cell === null) focusRow(stop.id);
        else focusCell(stop.id, stop.cell);
      }
    });
    observer.observe(grid, { childList: true, subtree: true });
    sync();
    return () => {
      observer.disconnect();
      grid.removeEventListener('keydown', onkeydown);
      grid.removeEventListener('focusin', onfocusin);
      grid.removeEventListener('focusout', onfocusout);
      clearTimeout(queryTimer);
      clearTimeout(leaveTimer);
    };
  });
</script>

<div role="treegrid" aria-label={label} class="treegrid" bind:this={grid}>
  {#each rows as row (row.node.id)}
    {@const toggle = () => {
      if (row.expandable) setExpanded([row.node.id], !row.expanded);
    }}
    <div
      role="row"
      class="row"
      data-id={row.node.id}
      data-selected={selectedId === undefined ? undefined : selectedId === row.node.id}
      aria-level={row.level}
      aria-posinset={row.posinset}
      aria-setsize={row.setsize}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-selected={selectedId === undefined ? undefined : selectedId === row.node.id}
      style:--level={row.level}
    >
      <div role="gridcell" class="cell primary">
        {@render primary(row.node, { expanded: row.expanded, level: row.level, toggle })}
      </div>
      {#each actions as id (id)}
        <div role="gridcell" class="cell action">{@render action?.(row.node, id)}</div>
      {/each}
    </div>
  {/each}
</div>

<style>
  @layer components {
    .row {
      display: flex;
      align-items: center;
      min-height: var(--row-height);
      padding-inline-start: calc((var(--level) - 1) * var(--space-4));
    }
    .row:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .row[data-selected='true'] {
      background: var(--accent-wash);
      color: var(--accent);
    }
    .primary {
      flex: 1;
      min-width: 0;
    }
    @media (hover: hover) and (pointer: fine) {
      .row:hover:not([data-selected='true']) {
        background: var(--surface-hover);
      }
    }
  }
</style>
