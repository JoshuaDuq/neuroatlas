<!--
  The header over the tree (index.html:247-250): the browse scope beside it (A3's picker, as
  `children`), and the one command that opens or closes every group (app.js:643-653).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { CatalogGroup } from '../../lib/core/catalog/catalog.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    lang: Language;
    groups: readonly Pick<CatalogGroup, 'key'>[];
    /** Keys of the open groups, as the tree holds them. */
    expanded: ReadonlySet<string>;
    onExpandedChange: (expanded: Set<string>) => void;
    children?: Snippet;
  }

  let { lang, groups, expanded, onExpandedChange, children }: Props = $props();

  const copy = $derived(t(lang, 'navigator'));
  const allExpanded = $derived(groups.length > 0 && groups.every(({ key }) => expanded.has(key)));
</script>

<div class="tree-header">
  {@render children?.()}
  <button
    type="button"
    class="tree-toggle-all"
    onclick={() =>
      onExpandedChange(allExpanded ? new Set() : new Set(groups.map(({ key }) => key)))}
  >
    {allExpanded ? copy.collapseAll : copy.expandAll}
  </button>
</div>
