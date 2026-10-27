<!--
  The source label row of the datasheet (inspector.js:237-262): the source atlas and its label ids.
  Past eight ids the row counts them and a native disclosure holds the full list. The caller keys
  this component by region and language, so an open list survives display changes only.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { sourceLabel } from '../../lib/core/panels/inspector.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';

  let { region, lang }: { region: Region & { atlas: string }; lang: Language } = $props();

  const label = $derived(sourceLabel(region, lang));
  const stacked = $derived(label.stacked || Boolean(label.all));
</script>

<dt class={['fact-source-label', stacked && 'stacked']}>{t(lang, 'inspector').sourceLabel}</dt>
<dd class={['fact-source', stacked && 'stacked']}>
  {#if label.all}
    <div class="source-labels">
      <Disclosure summary={label.atlas}>
        <p class="code">{label.all}</p>
      </Disclosure>
    </div>
  {:else if label.ids}
    {label.atlas} · <span class="code">{label.ids}</span>
  {:else}
    {label.atlas}
  {/if}
</dd>
