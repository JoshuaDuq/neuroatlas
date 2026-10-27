<!--
  Browse the anatomy as an APG treegrid (decision 8 on #4; viewer/ui/panels/navigator.js:465-702).
  U7's Treegrid is the grid: this component supplies its rows (a heading per section, a group
  row, a region row) and its cells (the name, then one visibility eye per side). Selection follows
  Enter, Space or a click, never focus, so arrowing through 360 areas says one row per key.
-->
<script module lang="ts">
  import type { CatalogGroup, CatalogRow } from '../../lib/core/catalog/catalog.ts';
  import type { Region } from '../../lib/types/index.ts';

  type Side = Region['hemisphere'];

  /** What a node of the tree carries; the Treegrid hands it back to this component's snippets. */
  export type TreeNodeData =
    | { type: 'section'; name: string; said: string }
    | {
        type: 'group';
        group: CatalogGroup;
        label: string;
        /** The section holds a midline part, so its rows reserve the Mid slot. */
        midline: boolean;
        /** One eye per side that has regions an eye can reveal. */
        eyes: { side: Side; ids: string[] }[];
      }
    | {
        type: 'region';
        row: CatalogRow;
        midline: boolean;
        /** The accessible name of the row. */
        name: string;
        /** The reason printed on the row, when it is the row's own. */
        reason: string | null;
        /** An eye can reveal it (a region too small for the cut has none). */
        eye: boolean;
      };

  const SIDES: readonly Side[] = ['midline', 'left', 'right'];
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { count } from '../../lib/core/format.ts';
  import {
    labelledGroups,
    reasonText,
    rowStatesReason,
    sectionReasons,
    UNREVEALABLE,
  } from '../../lib/core/panels/navigator.ts';
  import type { HiddenReason } from '../../lib/core/catalog/visibility.ts';
  import { SHORTCUT_KEYS } from '../../lib/controller/keymap.ts';
  import { registerCurrentItem } from '../../lib/core/workspace.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
  import Treegrid from '../../lib/ui/Treegrid.svelte';
  import { visibleRows, type TreegridNode } from '../../lib/ui/treegrid.ts';
  import TreeGroup from './TreeGroup.svelte';
  import TreeRow from './TreeRow.svelte';
  import VisibilityEye from './VisibilityEye.svelte';
  import './tree.css';

  interface Props {
    lang: Language;
    /** The catalog's groups for the current display (`catalog.groups`). */
    groups: readonly CatalogGroup[];
    hiddenRegions: ReadonlySet<string>;
    /** Keys of the open groups. Replaced, never mutated. */
    expanded: Set<string>;
    onExpandedChange: (expanded: Set<string>) => void;
    selectedId: string | null;
    /** A region that is on screen was chosen. */
    onSelect: (id: string) => void;
    /** A region that is not on screen was chosen: undo what hides it, then select it. */
    onReveal: (reason: HiddenReason, id: string) => void;
    onHide: (ids: readonly string[], said: string) => void;
    onShow: (ids: readonly string[], said: string) => void;
  }

  let {
    lang,
    groups,
    hiddenRegions,
    expanded,
    onExpandedChange,
    selectedId,
    onSelect,
    onReveal,
    onHide,
    onShow,
  }: Props = $props();

  // The page's own single characters: a row leaves them to the keymap instead of type-ahead.
  const PAGE_KEYS: ReadonlySet<string> = new Set(
    [
      SHORTCUT_KEYS.shortcuts,
      SHORTCUT_KEYS.search,
      ...Object.values(SHORTCUT_KEYS.views),
      SHORTCUT_KEYS.focusSelection,
      SHORTCUT_KEYS.isolate,
      SHORTCUT_KEYS.cortex,
      SHORTCUT_KEYS.internal,
      SHORTCUT_KEYS.spinalCord,
      SHORTCUT_KEYS.hemisphere,
      SHORTCUT_KEYS.linkedMri,
    ].map((key) => key.toLowerCase()),
  );

  let root: HTMLElement;
  let scrolledId: string | null = null;

  function regionNode(row: CatalogRow, midline: boolean): TreegridNode<TreeNodeData> {
    const copy = t(lang, 'navigator');
    const name = row.label.name;
    const side = t(lang, 'sides').words[row.region.hemisphere];
    const eye = !UNREVEALABLE.has(row.reason);
    const reason = row.visible ? null : reasonText(row.reason, row.region.atlas, lang);
    return {
      id: row.region.id,
      label: name,
      selectable: eye,
      disabled: !eye,
      data: {
        type: 'region',
        row,
        midline,
        eye,
        reason: row.visible || !rowStatesReason(row) ? null : reason,
        name: row.visible
          ? `${name}, ${side}`
          : (eye ? copy.rowHiddenAria : copy.rowUnavailableAria)(name, side, reason!),
      },
    };
  }

  const nodes = $derived.by(() => {
    const copy = t(lang, 'navigator');
    const said = sectionReasons(groups);
    const labelled = labelledGroups(groups, lang);
    // A section with a midline part reserves the Mid slot; L and R stay anchored right down the tree.
    const midlineKinds = new Set(
      labelled
        .filter(({ group }) => group.rows.some(({ region }) => region.hemisphere === 'midline'))
        .map(({ group }) => group.kind),
    );
    const result: TreegridNode<TreeNodeData>[] = [];
    let section: string | null = null;
    for (const { group, label } of labelled) {
      if (group.kind !== section) {
        section = group.kind;
        const name =
          section === 'cortex'
            ? copy.cortex
            : section === 'tissue'
              ? copy.cutOnly
              : copy.subcortical;
        result.push({
          id: `section:${section}`,
          label: name,
          selectable: false,
          data: {
            type: 'section',
            name,
            said: (said.get(section) ?? [])
              .map((reason) => reasonText(reason, undefined, lang))
              .join(' · '),
          },
        });
      }
      const midline = midlineKinds.has(group.kind);
      result.push({
        id: group.key,
        label,
        selectable: false,
        data: {
          type: 'group',
          group,
          label,
          midline,
          eyes: SIDES.flatMap((side) => {
            const ids = group.rows
              .filter(
                ({ region, reason }) => region.hemisphere === side && !UNREVEALABLE.has(reason),
              )
              .map(({ region }) => region.id);
            return ids.length ? [{ side, ids }] : [];
          }),
        },
        children: group.rows.map((row) => regionNode(row, midline)),
      });
    }
    return result;
  });

  const anyMidline = $derived(
    groups.some((group) => group.rows.some((row) => row.region.hemisphere === 'midline')),
  );
  const rows = $derived(visibleRows(nodes, expanded));
  // The primitive moves its Tab stop to the chosen row only when the choice changes. A region under
  // a group that opens later gets the stop when it appears, as legacy `markSelection` did.
  const stopId = $derived(
    selectedId !== null && rows.some((row) => row.node.id === selectedId) ? selectedId : null,
  );

  const rowOf = (id: string) =>
    [...root.querySelectorAll<HTMLElement>('[role="row"]')].find((row) => row.dataset.id === id);

  function rowLabel(node: TreegridNode<TreeNodeData>): string {
    const { data } = node;
    if (data.type === 'section') return data.said ? `${data.name} (${data.said})` : data.name;
    if (data.type === 'group') {
      return `${data.label}, ${count(data.group.rows.length, 'region', lang)}`;
    }
    return data.name;
  }

  /** Enter, Space or a click: a group opens or closes; a region is chosen, or revealed first. */
  function activate(node: TreegridNode<TreeNodeData>) {
    const { data } = node;
    if (data.type === 'group') {
      const next = new Set(expanded);
      if (!next.delete(node.id)) next.add(node.id);
      onExpandedChange(next);
    } else if (data.type === 'region') {
      const { row } = data;
      if (row.visible) onSelect(row.region.id);
      else if (!UNREVEALABLE.has(row.reason)) onReveal(row.reason, row.region.id);
    }
  }

  /** A click anywhere on a row, outside its buttons, does what Enter does (navigator.js:386, 547). */
  function onRowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    const id = target.closest<HTMLElement>('[role="row"]')?.dataset.id;
    const node = rows.find((row) => row.node.id === id)?.node;
    if (node) activate(node);
  }

  /**
   * `V`: a focused eye is pressed; a row with one eye presses it; a group with one per side goes to
   * them to choose (navigator.js:694-695).
   */
  function toggleVisibility(node: TreegridNode<TreeNodeData>) {
    const eyes = [...(rowOf(node.id)?.querySelectorAll<HTMLElement>('.visibility-control') ?? [])];
    const focused = eyes.find((eye) => eye === document.activeElement);
    if (focused) focused.click();
    else if (eyes.length === 1) eyes[0].click();
    else eyes[0]?.focus();
  }

  /** Moves focus to the next (1) or previous (-1) row, from the one holding focus (navigator.js:652-657). */
  export function moveFocus(step: 1 | -1) {
    const all = [...root.querySelectorAll<HTMLElement>('[role="row"]')];
    const at = all.findIndex((row) => row.contains(document.activeElement));
    all[Math.max(0, Math.min(all.length - 1, at + step))]?.focus();
  }

  // The chosen row scrolls into view once per new choice, and again if it was not drawn yet.
  $effect(() => {
    if (selectedId === null) {
      scrolledId = null;
      return;
    }
    if (stopId === null || stopId === scrolledId) return;
    rowOf(stopId)?.scrollIntoView({ block: 'nearest' });
    scrolledId = stopId;
  });

  onMount(() => {
    const unregisterItem = registerCurrentItem(() =>
      root.querySelector<HTMLElement>('[role="row"][aria-selected="true"]'),
    );
    const unregisterStop = registerFocusTarget(FOCUS_TARGETS.treeStop, () =>
      root.querySelector<HTMLElement>('[tabindex="0"]'),
    );
    return () => {
      unregisterItem();
      unregisterStop();
    };
  });
</script>

<!-- A pointer affordance: the keyboard's way to the same action is the grid's own (Enter, Space). -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="anatomy-tree"
  bind:this={root}
  onclick={onRowClick}
  data-midline={anyMidline || undefined}
>
  {#if nodes.length}
    <Treegrid
      label={t(lang, 'navigator').browseAnatomy}
      {nodes}
      bind:expanded={() => expanded, onExpandedChange}
      selectedId={stopId}
      {rowLabel}
      actions={SIDES}
      onactivate={activate}
      rowKeys={{ v: toggleVisibility }}
      passKeys={PAGE_KEYS}
    >
      {#snippet primary(node, state)}
        {@const data = node.data}
        {#if data.type === 'section'}
          <div class="section-label">
            <span>{data.name}</span>
            {#if data.said}<span class="section-state">{data.said}</span>{/if}
          </div>
        {:else if data.type === 'group'}
          <TreeGroup
            name={data.label}
            count={data.group.rows.length}
            expanded={state.expanded}
            dimmed={!data.group.rows.some((row) => row.visible)}
          />
        {:else}
          <TreeRow
            name={data.row.label.name}
            reason={data.reason}
            tooltip={data.row.visible ? undefined : data.name}
            hidden={!data.row.visible}
            unavailable={!data.eye}
          />
        {/if}
      {/snippet}
      {#snippet action(node, side)}
        {@const data = node.data}
        {#if data.type === 'group'}
          {@const eye = data.eyes.find((entry) => entry.side === side)}
          {#if eye}
            <VisibilityEye
              {lang}
              ids={eye.ids}
              name={data.label}
              side={eye.side}
              {hiddenRegions}
              {onHide}
              {onShow}
            />
          {:else if side === 'midline'}
            <span class="slot-mid" data-section-midline={data.midline} aria-hidden="true"></span>
          {/if}
        {:else if data.type === 'region'}
          {#if data.row.region.hemisphere === side && data.eye}
            <VisibilityEye
              {lang}
              ids={[data.row.region.id]}
              name={data.row.label.name}
              side={data.row.region.hemisphere}
              {hiddenRegions}
              {onHide}
              {onShow}
            />
          {:else if data.row.region.hemisphere === side}
            <span class="row-side-solo" data-side={side} aria-hidden="true">
              {t(lang, 'sides').glyphs[side]}
            </span>
          {:else if side === 'midline'}
            <span class="slot-mid" data-section-midline={data.midline} aria-hidden="true"></span>
          {/if}
        {/if}
      {/snippet}
    </Treegrid>
  {:else}
    <!-- Nothing to list yet: a treegrid with no rows is invalid, so only a decoration stands in. -->
    <div class="tree-skeleton" aria-hidden="true"></div>
  {/if}
</div>
