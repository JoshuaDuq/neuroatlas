<!--
  The Anatomy explorer (index.html:225-300; navigator.js:742-791): the search field above, and
  below it either the search's results or the tree with its scope. A search replaces the tree (and
  its header) in place and a chosen result brings it back; the tree stays mounted while hidden, so
  its open groups and its place survive. A3's system picker comes in as a snippet: features do not
  mount each other, I1 composes them.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { CatalogGroup, CatalogRow } from '../../lib/core/catalog/catalog.ts';
  import type { HiddenReason } from '../../lib/core/catalog/visibility.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import AnatomySearch from './AnatomySearch.svelte';
  import AnatomyTree from './AnatomyTree.svelte';
  import TreeHeader from './TreeHeader.svelte';

  interface Props {
    lang: Language;
    /** The field's text; it is the session's and is not in the link. */
    query: string;
    search: (query: string) => { rows: CatalogRow[]; total: number };
    /** The catalog's groups for the current display (`catalog.groups`). */
    groups: readonly CatalogGroup[];
    hiddenRegions: ReadonlySet<string>;
    expanded: Set<string>;
    onExpandedChange: (expanded: Set<string>) => void;
    selectedId: string | null;
    atlases: readonly { id: string; label: string }[];
    atlas: string;
    cutAtlases: readonly { id: string; label: string }[];
    cutAtlas: string;
    /** Inside the anatomy: the cortex is hidden and the list is of one internal system. */
    inside: boolean;
    /** An atlas or detail level is loading: the scope cannot change meanwhile. */
    switching: boolean;
    /** The other scope was chosen. */
    onScope: () => void;
    onSelect: (id: string) => void;
    onReveal: (reason: HiddenReason, id: string) => void;
    onHide: (ids: readonly string[]) => void;
    onShow: (ids: readonly string[]) => void;
    /** A rejection is the caller's to report: it is not caught here. */
    onAtlas: (id: string) => void | Promise<void>;
    onCutAtlas: (id: string) => void | Promise<void>;
    /** A3's picker of one internal system, shown while inside the anatomy. */
    systemPicker?: Snippet;
  }

  let {
    lang,
    query = $bindable(),
    search,
    groups,
    hiddenRegions,
    expanded,
    onExpandedChange,
    selectedId,
    atlases,
    atlas,
    cutAtlases,
    cutAtlas,
    inside,
    switching,
    onScope,
    onSelect,
    onReveal,
    onHide,
    onShow,
    onAtlas,
    onCutAtlas,
    systemPicker,
  }: Props = $props();

  const copy = $derived(t(lang, 'navigator'));
  const searching = $derived(query.trim().length > 0);
  const scope = $derived(inside ? 'system' : 'whole');

  let explorer: HTMLElement;
  // The pinned field and its ground cover the top of the scroller: what scrolls into view
  // (the armed result) must stop below them, at any text size.
  $effect(() => {
    const box = explorer.querySelector<HTMLElement>('.search-box')!;
    const measure = () => {
      const margin = parseFloat(getComputedStyle(box).marginTop);
      explorer.style.setProperty('--field-clearance', `${box.offsetHeight + 2 * margin}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  });

  let finder: ReturnType<typeof AnatomySearch>;
  let tree: ReturnType<typeof AnatomyTree>;

  /** Focuses the field and selects its text (the `/` key). */
  export const focusSearch = () => finder.focusSearch();

  /**
   * Up and Down from outside the list: the next row of the tree, or while searching the field, where
   * the armed result is announced (deviations/a2-arrows-focus-field.md).
   */
  export function moveFocus(step: 1 | -1) {
    if (searching) finder.focusSearch({ select: false });
    else tree.moveFocus(step);
  }
</script>

<div class="explorer" bind:this={explorer} data-searching={searching || undefined}>
  <h2 class="visually-hidden">{copy.title}</h2>
  <AnatomySearch
    bind:this={finder}
    bind:query
    {lang}
    {search}
    {groups}
    {selectedId}
    {atlases}
    {atlas}
    {cutAtlases}
    {cutAtlas}
    {onSelect}
    {onReveal}
    {onAtlas}
    {onCutAtlas}
  />
  <div class="browse" hidden={searching}>
    <div class="tree-head">
      <TreeHeader {lang} {groups} {expanded} {onExpandedChange}>
        <ChoiceGroup
          class="tree-scope"
          label={copy.scope}
          options={[
            { value: 'whole', label: copy.scopeWhole },
            { value: 'system', label: copy.scopeSystem },
          ]}
          ariaDisabled={switching}
          bind:value={() => scope, () => onScope()}
        />
      </TreeHeader>
      {#if inside}{@render systemPicker?.()}{/if}
    </div>
    <div class="tree-pane">
      <AnatomyTree
        bind:this={tree}
        {lang}
        {groups}
        {hiddenRegions}
        {expanded}
        {onExpandedChange}
        {selectedId}
        {onSelect}
        {onReveal}
        {onHide}
        {onShow}
      />
    </div>
  </div>
</div>

<style>
  @layer features {
    /* The panel gives this its height. Browsing: the field and scope stay put and the tree scrolls. */
    .explorer {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    /* Searching: results and notes scroll under the pinned field. */
    .explorer[data-searching] {
      display: block;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      scroll-padding-block-start: var(--field-clearance, 0px);
    }
    /*
     * The field is the head of the panel (layout.css:120-132): on the inset, with a ground behind it
     * that runs edge to edge so results scroll under it, not through it.
     */
    .explorer :global(.search-box) {
      position: sticky;
      top: var(--space-3);
      z-index: 2;
      flex: none;
      margin: var(--space-3) var(--panel-inset) var(--space-2);
      width: auto;
    }
    .explorer :global(.search-box)::before {
      content: '';
      position: absolute;
      z-index: -1;
      inset: calc(-1 * var(--space-3)) calc(-1 * var(--panel-inset)) calc(-1 * var(--space-2));
      background: var(--surface-base);
    }
    .explorer[data-searching] :global(.search-box)::before {
      inset-block-end: calc(-1 * var(--space-3));
      border-bottom: 1px solid var(--border-subtle);
    }
    .explorer :global(.search-box input[type='search']) {
      height: auto;
      min-height: var(--control-height);
    }
    .explorer :global(.search-shortcut) {
      right: 6px;
      padding: 0 6px;
    }
    /* A result is a row like the tree's: edge to edge, names on the inset (navigator.css:2-59). */
    .explorer :global(.search-option) {
      min-height: var(--row-height);
      padding: var(--space-2) var(--panel-inset);
      font-size: var(--text-ui);
      color: var(--text-primary);
      cursor: pointer;
    }
    .explorer :global(.search-option:has(.result[data-selected])) {
      background: var(--accent-wash);
      color: var(--accent);
    }
    .explorer :global(.search-option[aria-disabled='true']) {
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .explorer
        :global(.search-option:hover:not([aria-disabled='true'], :has(.result[data-selected]))) {
        background: var(--surface-hover);
      }
    }
    .browse {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }
    .browse[hidden] {
      display: none;
    }
    /* The scope and the one command over the tree, ruled off from it (layout.css:120). */
    .tree-head {
      display: flex;
      flex: none;
      flex-direction: column;
      gap: var(--space-2);
      padding: 0 var(--panel-inset) var(--space-3);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .tree-pane {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      padding-bottom: var(--space-3);
    }
    /* Browse scope: 13px at its words' widths so Expand all fits beside it (navigator.css:226-228). */
    .tree-head :global(.tree-scope) {
      flex: none;
    }
    .tree-head :global(.tree-scope [role='radio']) {
      height: auto;
      min-height: calc(var(--control-height) - 4px);
      padding-inline: var(--space-2);
      font-size: var(--text-caption);
    }
    @media (pointer: coarse) {
      .tree-head :global(.tree-scope [role='radio']) {
        min-height: 44px;
      }
    }
  }
</style>
