<!--
  The region inspector's Neuropsychology section (clinical.js:332-350), for R1's `relatedDeficits`
  slot: the deficits mapped on the selected region or on anatomy it shares (`involved`). Not titled
  when it has nothing to report. The section is labelled by its own heading, not a landmark (D6).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { relatedRegionVisible } from '../../lib/core/panels/clinical.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { DeficitsExplorer } from './explorer.svelte.ts';
  import LinkRow from './LinkRow.svelte';

  let { explorer, view }: { explorer: DeficitsExplorer; view: View } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const involved = $derived(explorer.deps.involved);
  const lang = $derived(view.lang);
  const deficits = $derived(
    view.selectedRegion
      ? [
          ...new Set(
            [...involved(view.selectedRegion.id)].flatMap((id) =>
              clinical.forRegion(id).map((association) => association.deficit),
            ),
          ),
        ]
      : [],
  );
  const visible = $derived(relatedRegionVisible(view.selectedRegion, deficits.length));
</script>

<section class="related" hidden={!visible}>
  {#if visible}
    <h3>{t(lang, 'clinical').related}</h3>
    <ul>
      {#each deficits as id (id)}
        {@const deficit = clinical.get(id)}
        <li>
          <LinkRow
            name={deficit.name[lang]}
            secondary={deficit.domain[lang]}
            onclick={() => explorer.openDeficit(id)}
          />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  @layer features {
    /* clinical.css:291-296: the region's own body, then the same open section rhythm. */
    .related {
      margin-block: var(--space-6);
      padding-inline: var(--panel-inset);
    }
    h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  }
</style>
