<!--
  What a profile says under its heading and meta line (clinical.js:267-295). Mounted once per open
  deficit, so the evidence the reader opened survives a language change and does not carry over to
  another deficit.
-->
<script lang="ts">
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import type { ClinicalDeficit } from '../../lib/core/clinical/types.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language, Rgb } from '../../lib/types/index.ts';
  import Association from './Association.svelte';
  import type { DeficitsExplorer } from './explorer.svelte.ts';
  import LinkRow from './LinkRow.svelte';

  let {
    explorer,
    deficit,
    lang,
    side,
    colours,
  }: {
    explorer: DeficitsExplorer;
    deficit: ClinicalDeficit;
    lang: Language;
    /** The one side every finding shares, said under the heading; null when they differ. */
    side: string | null;
    colours: ReadonlyMap<string, Rgb>;
  } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const anatomy = $derived(explorer.deps.anatomy);
  const text = $derived(t(lang, 'clinical'));
  const found = $derived(clinical.forDeficit(deficit.id));
  const maps = $derived(explorer.checkedMaps(deficit.id, lang));

  let expanded = $state<Record<string, boolean>>({});
</script>

<p class="kind">{text.evidenceKind(found.length)}</p>
<p class="summary">{deficit.summary[lang]}</p>
<p class="note caveat">{text.referenceOnly}</p>
<section class="section">
  <h3 class="section-heading">{text.associations}</h3>
  {#each found as association (association.id)}
    <Association
      {association}
      {lang}
      color={colours.get(association.id)!}
      sideOnRow={!side}
      bind:open={
        () => expanded[association.id] ?? false, (open) => (expanded[association.id] = open)
      }
      opening={explorer.opening}
      {clinical}
      {anatomy}
      onregion={(id) => explorer.openRegion(id)}
    />
  {/each}
</section>
{#if maps.length}
  <section class="section">
    <h3 class="section-heading">{text.checkedMaps}</h3>
    <ul>
      {#each maps as map (map.id)}
        <li>
          <LinkRow
            name={map.name}
            colour={networkCss(map.color)}
            onclick={() => explorer.openFunction(map.id)}
          />
        </li>
      {/each}
    </ul>
  </section>
{/if}
<p class="note sources">{text.sources} · {text.revised}: {clinical.revised}</p>

<style>
  @layer features {
    p,
    ul {
      margin: 0;
    }
    .kind {
      margin-top: var(--space-4);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .summary {
      margin-top: var(--space-2);
    }
    .note {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .caveat {
      margin-top: var(--space-2);
    }
    .sources {
      margin-top: var(--space-5);
      color: var(--text-tertiary);
    }
    .section {
      margin-top: var(--space-6);
    }
    .section-heading {
      margin: 0 0 var(--space-2);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
      color: var(--text-primary);
    }
    ul {
      padding: 0;
      list-style: none;
    }
  }
</style>
