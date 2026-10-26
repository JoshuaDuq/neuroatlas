<!--
  The Deficits list (clinical.js:352-445), for the workspace's list slot: a search field over deficits
  grouped by domain. A list of buttons, not a listbox: rows open a profile, they are not options. Each
  row stays a Tab stop and the arrow keys are a convenience (U6's `listNav`, decision 38 on #4).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { registerCurrentItem } from '../../lib/core/workspace.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import { createDebouncedAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import DrillRow from '../../lib/ui/DrillRow.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import { listNav } from '../../lib/ui/list-nav.ts';
  import SearchBridge from '../../lib/ui/SearchBridge.svelte';
  import DeficitSearch from './DeficitSearch.svelte';
  import type { DeficitsExplorer } from './explorer.svelte.ts';

  let {
    explorer,
    view,
    showShortcut,
  }: {
    explorer: DeficitsExplorer;
    view: View;
    /** Shows the `/` hint; false when single-key shortcuts are off. */
    showShortcut: boolean;
  } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const uid = $props.id();
  const lang = $derived(view.lang);
  const text = $derived(t(lang, 'clinical'));
  const navigator = $derived(t(lang, 'navigator'));
  const query = $derived(view.clinicalQuery.trim());
  const groups = $derived(clinical.grouped(query, lang));
  const count = $derived(groups.reduce((sum, entry) => sum + entry.deficits.length, 0));
  const functions = $derived(query ? explorer.deps.functionsMatching(query, lang) : 0);
  const near = $derived(groups.length === 0 ? clinical.nearest(query, lang) : null);

  // The count is said after typing pauses, for every settled query, a cleared one included, and
  // again when a different query settles on the same count (deviation x2-results-announcement).
  // A language change says nothing, so the sentence is read without tracking the language.
  const announcer = createDebouncedAnnouncer();
  $effect(() => () => announcer.dispose());
  let announcedQuery: string | null = null;
  $effect(() => {
    const settled = query;
    if (announcedQuery === null) {
      announcedQuery = settled;
      return;
    }
    if (settled === announcedQuery) return;
    announcedQuery = settled;
    announcer.reset();
    announcer.say(untrack(() => text.results(count)));
  });

  let list = $state<HTMLElement>();
  $effect(() => {
    explorer.refs.list = list ?? null;
    return () => (explorer.refs.list = null);
  });
  $effect(() =>
    registerCurrentItem(
      () => list?.querySelector<HTMLElement>('.row[aria-current="true"]') ?? null,
    ),
  );
  $effect(() => {
    const field = explorer.refs.search;
    if (!list || !field) return;
    const nav = listNav(list, { field, rows: '.row, .search-bridge' });
    return () => nav.destroy();
  });
</script>

<div class="deficit-head">
  <DeficitSearch
    {explorer}
    query={view.clinicalQuery}
    label={text.searchLabel}
    placeholder={text.search}
    clearLabel={navigator.clearSearch}
    {showShortcut}
    controls="{uid}-list"
    onquery={(value) => explorer.deps.onQuery(value)}
  />
</div>
<div class="deficit-body">
  <div id="{uid}-list" role="group" aria-label={text.deficits} bind:this={list}>
    {#each groups as { group, deficits } (group.id)}
      <div class="group" role="group" aria-labelledby="{uid}-group-{group.id}">
        <h3 id="{uid}-group-{group.id}" class="group-heading">{group.name[lang]}</h3>
        {#each deficits as deficit (deficit.id)}
          <div class="item" data-deficit={deficit.id}>
            <DrillRow
              name={deficit.name[lang]}
              secondary={deficit.domain[lang]}
              current={view.selectedDeficit === deficit.id}
              onclick={() => explorer.openDeficit(deficit.id)}
            />
          </div>
        {/each}
      </div>
    {/each}
    {#if groups.length === 0}
      <EmptyState title={navigator.noMatch(query)} message={text.noResults} />
      {#if near}
        <SearchBridge
          text={t(lang, 'functions').suggest(near)}
          onclick={() => {
            explorer.deps.onQuery(near);
            explorer.refs.search?.focus();
          }}
        />
      {/if}
    {/if}
    {#if functions}
      <SearchBridge
        text={text.functionBridge(functions, query)}
        onclick={() => explorer.deps.onSearchFunctions(query)}
      />
    {/if}
  </div>
  <!-- The collection's scope stands under the whole list; a search shows no scope. -->
  {#if !query}
    <p class="scope-note">
      {text.coverage.replace('{count}', String(clinical.search('', lang).length))}
    </p>
  {/if}
</div>

<style>
  @layer features {
    /* The search is the task's starting point: its controls share one rhythm (layout.css:122-130). */
    .deficit-head {
      flex: none;
      padding: var(--space-3) var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .group {
      isolation: isolate;
    }
    .group + .group {
      margin-top: var(--space-2);
    }
    /* Stuck 1px above the top, a caption's own rule slips under the list's edge (clinical.css:20-35). */
    .group-heading {
      position: sticky;
      top: -1px;
      z-index: 1;
      margin: 0;
      padding: var(--space-4) var(--panel-inset) var(--space-1);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .group:first-child > .group-heading {
      padding-top: var(--space-3);
      border-top: 0;
    }
    /* The wrapper adds no box; DrillRow has no selected look of its own (navigator.css:31). */
    .item {
      display: contents;
    }
    /* Arrow navigation keeps the focused row below its sticky group heading (clinical.css:44). */
    .item :global(.row) {
      scroll-margin-block-start: calc(var(--lh-caption) + var(--space-6));
    }
    .item :global(.row[data-selected='true']) {
      background: var(--accent-wash);
      color: var(--accent);
      font-weight: 600;
    }
    .item :global(.row[data-selected='true'] .secondary) {
      color: inherit;
      font-weight: 400;
    }
    @media (hover: hover) and (pointer: fine) {
      .item :global(.row[data-selected='true']:hover) {
        background: var(--accent-wash);
      }
    }
    /* A list's scope: one tertiary line at its foot (clinical.css:50-60). */
    .scope-note {
      margin: 0;
      padding: var(--space-3) var(--panel-inset) var(--space-4);
      border-top: 1px solid var(--border-subtle);
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-wrap: pretty;
    }
  }
</style>
