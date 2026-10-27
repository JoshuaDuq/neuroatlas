<script lang="ts" generics="T">
  // Hand-rolled WAI-ARIA APG treegrid (Bits UI has none; decision 0002). One Tab stop: the focused
  // row or cell. A row is a cell for the primary control (name/select) followed by one cell per
  // action, so each button sits in its own cell and none is nested inside another control.
  // Contract: an action cell holds exactly one control. The primary cell's first control is its
  // keyboard stop; any further control in it (a chevron) is pointer-only and must duplicate a key
  // (Right/Left expand and collapse, `rowKeys`). Cells with no control, or a disabled one, are skipped.
  import { onMount, untrack, type Snippet } from 'svelte';
  import {
    cellKeyAction,
    isTypeAheadKey,
    movedIndex,
    rowKeyAction,
    survivingRowId,
    type TreegridRow,
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
    /**
     * The chosen row (`aria-selected` on rows whose node is `selectable`); leave undefined for a grid
     * whose rows are not selectable. The Tab stop is the focused row, else this one, else the first.
     */
    selectedId?: string | null;
    /** The accessible name of a row, instead of the text of its cells. */
    rowLabel?: (node: TreegridNode<T>) => string;
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
    /**
     * Lower-case single characters left to the page when pressed on a row (its own shortcuts).
     * Like `rowKeys`, such a key starts no type-ahead query but extends one being typed.
     */
    passKeys?: ReadonlySet<string>;
  }

  let {
    label,
    nodes,
    expanded = $bindable(new Set<string>()),
    selectedId,
    rowLabel,
    actions = [],
    primary,
    action,
    onactivate,
    rowKeys = {},
    passKeys = new Set<string>(),
  }: Props = $props();

  const CONTROL = 'button, a[href], input, select, textarea, [tabindex]';
  const TYPE_AHEAD_MS = 500;

  let grid: HTMLElement;
  const rows = $derived(visibleRows(nodes, expanded));
  // Each top-level row and what is open under it, in one plain wrapper: a container for a row to be
  // sticky within, which a flat list does not give. It has no role, so rows stay the grid's own.
  const blocks = $derived(
    rows.reduce<TreegridRow<T>[][]>((all, row) => {
      if (row.level === 1) all.push([row]);
      else all.at(-1)!.push(row);
      return all;
    }, []),
  );
  const parents = new Map<string, string | null>();
  // The Tab stop: a row (`cell` null) or one of its cells.
  let stop: { id: string | null; cell: number | null } = { id: null, cell: null };
  let focusWithin = false;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  let query = '';
  let queryTimer: ReturnType<typeof setTimeout> | undefined;

  const rowElement = (id: string) =>
    [...grid.querySelectorAll<HTMLElement>('[role="row"]')].find((row) => row.dataset.id === id);
  const selectable = (node: TreegridNode<T>) =>
    selectedId !== undefined && node.selectable !== false;
  const controlOf = (cell: HTMLElement) => cell.querySelector<HTMLElement>(CONTROL);
  const usable = (cell: HTMLElement) => {
    const control = controlOf(cell);
    return control !== null && !control.matches(':disabled');
  };
  /** Every cell of a row, in DOM order: a cell's index is its column. */
  const cellsOf = (row: HTMLElement) => [
    ...row.querySelectorAll<HTMLElement>(':scope > [role="gridcell"]'),
  ];
  /** The columns of a row that can take focus. */
  const usableColumns = (row: HTMLElement) =>
    cellsOf(row).flatMap((cell, column) => (usable(cell) ? [column] : []));

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
    if (id === null) return;
    const row = rowElement(id)!;
    const cell = stop.cell === null ? undefined : cellsOf(row)[stop.cell];
    const control = cell && usable(cell) ? controlOf(cell) : null;
    if (stop.cell !== null && !control) stop = { id, cell: null };
    (control ?? row).tabIndex = 0;
  }

  function focusRow(id: string) {
    stop = { id, cell: null };
    sync();
    rowElement(id)!.focus();
  }

  function focusCell(id: string, cell: number) {
    stop = { id, cell };
    sync();
    controlOf(cellsOf(rowElement(id)!)[cell])!.focus();
  }

  function onfocusin(event: FocusEvent) {
    clearTimeout(leaveTimer);
    focusWithin = true;
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('[role="row"]');
    if (!row) return;
    const cell = target === row ? null : target.closest<HTMLElement>('[role="gridcell"]');
    const column = cell ? cellsOf(row).indexOf(cell) : -1;
    stop = { id: row.dataset.id!, cell: column === -1 ? null : column };
    sync();
  }

  function onfocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    // Focus went to another control: the grid has been left, and no rebuild may pull it back.
    if (next && !grid.contains(next)) {
      clearTimeout(leaveTimer);
      focusWithin = false;
      return;
    }
    // A control that is removed or replaced loses focus without a destination, and the rebuild that
    // did it is observed in a microtask: leaving the grid is only counted once that has run.
    if (!next) leaveTimer = setTimeout(() => (focusWithin = false));
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

    // A key the page owns is not for type-ahead, unless a query is already being typed.
    if (onRow && query === '' && isTypeAheadKey(event) && passKeys.has(key.toLowerCase())) return;
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
          {
            const [first] = usableColumns(rowElementUnderFocus);
            if (first !== undefined) focusCell(row.node.id, first);
          }
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

    const column = cellsOf(rowElementUnderFocus).indexOf(
      target.closest<HTMLElement>('[role="gridcell"]')!,
    );
    const columns = usableColumns(rowElementUnderFocus);
    const act = cellKeyAction(
      key,
      { first: !columns.some((c) => c < column), last: !columns.some((c) => c > column) },
      event.ctrlKey,
    );
    if (!act) return;
    handled();
    switch (act) {
      case 'nextCell':
        focusCell(
          row.node.id,
          columns.find((c) => c > column)!,
        );
        break;
      case 'previousCell':
        focusCell(row.node.id, columns.filter((c) => c < column).at(-1)!);
        break;
      case 'firstCell':
        focusCell(row.node.id, columns[0]);
        break;
      case 'lastCell':
        focusCell(row.node.id, columns.at(-1)!);
        break;
      case 'row':
        focusRow(row.node.id);
        break;
      default: {
        // The same column in the adjacent row, else its nearest cell that can take focus; a row
        // with none (a heading, a disabled row) takes focus itself, as a row does.
        const destination = rows[movedIndex(act, index, rows.length)].node.id;
        const nearest = usableColumns(rowElement(destination)!).reduce<number | undefined>(
          (best, c) =>
            best === undefined || Math.abs(c - column) < Math.abs(best - column) ? c : best,
          undefined,
        );
        if (nearest !== undefined) focusCell(destination, nearest);
        else focusRow(destination);
      }
    }
  }

  // The Tab stop moves to the chosen row at once, unless the reader is moving through the grid
  // (navigator.js `markSelection`; APG Tree View: focus enters a single-select tree on its selection).
  $effect(() => {
    const id = selectedId;
    untrack(() => {
      if (grid.contains(document.activeElement)) return;
      if (id != null && rows.some((row) => row.node.id === id)) {
        stop = { id, cell: null };
        sync();
      }
    });
  });

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
  {#each blocks as block (block[0].node.id)}
    <div class="treegrid-block">
      {#each block as row (row.node.id)}
        {@const toggle = () => {
          if (row.expandable) setExpanded([row.node.id], !row.expanded);
        }}
        <div
          role="row"
          class="row"
          data-id={row.node.id}
          data-selected={selectable(row.node) ? selectedId === row.node.id : undefined}
          aria-label={rowLabel?.(row.node)}
          aria-level={row.level}
          aria-posinset={row.posinset}
          aria-setsize={row.setsize}
          aria-expanded={row.expandable ? row.expanded : undefined}
          aria-selected={selectable(row.node) ? selectedId === row.node.id : undefined}
          aria-disabled={row.node.disabled || undefined}
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
      .row:hover:not([data-selected='true'], [aria-disabled='true']) {
        background: var(--surface-hover);
      }
    }
  }
</style>
