<!-- Fixture for SearchCombobox.svelte.test.ts: a small catalogue with disabled rows and notes. -->
<script lang="ts">
  import SearchCombobox, { type SearchGroup } from './SearchCombobox.svelte';

  let { picks, showShortcut = true }: { picks: string[]; showShortcut?: boolean } = $props();

  const all = [
    { group: 'Limbic', value: 'amygdala', label: 'Amygdala' },
    { group: 'Limbic', value: 'hippocampus', label: 'Hippocampus', disabled: true },
    { group: 'Limbic', value: 'hypothalamus', label: 'Hypothalamus' },
    { group: 'Deep', value: 'thalamus', label: 'Thalamus' },
    { group: 'Deep', value: 'putamen', label: 'Putamen', disabled: true },
    { group: 'Deep', value: 'caudate', label: 'Caudate' },
  ];
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

<SearchCombobox
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
  {#snippet option(item)}<span>{item.label}</span>{/snippet}
  {#snippet notes()}
    {#if query.trim() !== '' && found.length === 0}
      <p>No match for {query}.</p>
    {/if}
    <button type="button">Switch atlas</button>
  {/snippet}
</SearchCombobox>
