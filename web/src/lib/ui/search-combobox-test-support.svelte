<!-- Fixture for SearchCombobox.svelte.test.ts: a small catalogue with disabled rows and notes. -->
<script lang="ts">
  import SearchCombobox, { type SearchGroup } from './SearchCombobox.svelte';

  let {
    picks,
    showShortcut = true,
    tall = false,
  }: { picks: string[]; showShortcut?: boolean; tall?: boolean } = $props();

  const all = [
    { group: 'Limbic', value: 'amygdala', label: 'Amygdala' },
    { group: 'Limbic', value: 'hippocampus', label: 'Hippocampus', disabled: true },
    { group: 'Limbic', value: 'hypothalamus', label: 'Hypothalamus' },
    { group: 'Deep', value: 'thalamus', label: 'Thalamus', current: true },
    { group: 'Deep', value: 'putamen', label: 'Putamen', disabled: true },
    { group: 'Deep', value: 'caudate', label: 'Caudate' },
  ];
  let combobox: SearchCombobox;
  export const move = (delta: number) => combobox.move(delta);

  let query = $state('');
  const found = $derived(
    query.trim() === ''
      ? []
      : all.filter((row) => row.label.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const groups = $derived<SearchGroup[]>(
    ['Limbic', 'Deep']
      .map((heading) => ({ heading, options: found.filter((row) => row.group === heading) }))
      .filter((group) => group.options.length > 0),
  );
</script>

<div data-scroller style:overflow="auto" style:height={tall ? '300px' : undefined}>
  <SearchCombobox
    bind:this={combobox}
    bind:query
    {groups}
    {showShortcut}
    label="Search regions"
    placeholder="Search"
    listLabel="Matching regions"
    clearLabel="Clear search"
    status={`${found.length} matches.`}
    onselect={(value) => picks.push(value)}
  >
    {#snippet option(item)}<span style:display="block" style:min-height={tall ? '200px' : undefined}
        >{all.find((row) => row.value === item.value)?.label}</span
      >{/snippet}
    {#snippet notes()}
      {#if query.trim() !== '' && found.length === 0}
        <p>No match for {query}.</p>
      {/if}
      <button type="button" style:color="inherit" style:background="transparent"
        >Switch atlas</button
      >
    {/snippet}
  </SearchCombobox>
</div>

<style>
  @layer components {
    /* In the app the field sits outside the scrolling list; keep it in view so typing never scrolls it back. */
    div :global(.search-box) {
      position: sticky;
      top: 0;
      z-index: 1;
    }
  }
</style>
