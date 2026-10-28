<!--
  Typical arterial supply: the share of the selected region in each arterial territory the
  registered Liu et al. (2023) atlas draws, by its pial vertices for a cortical area and its voxels
  otherwise. A region the atlas does not reach has no section; it stays mounted so its open state
  survives from one selection to the next.
-->
<script lang="ts">
  import type { ArterialTerritories, Language, Region } from '../../lib/types/index.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import { percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    territories,
  }: {
    region: Region | null;
    lang: Language;
    territories: ArterialTerritories | null;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'territories'));
  const shares = $derived(territories ? (region?.territories ?? []) : []);
  const rest = $derived(region?.territory_unassigned ?? 0);

  function territory(id: string) {
    const found = territories!.territories.find((entry) => entry.id === id);
    if (!found) throw new Error(`No arterial territory ${id} is published.`);
    return found;
  }
</script>

{#if shares.length}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <ul class="network-list">
        {#each shares as share (share.territory)}
          {@const entry = territory(share.territory)}
          <li class="network-row">
            <Swatch colour={networkCss(entry.color)} />
            <span class="network-row-name">{lang === 'fr' ? entry.name_fr : entry.name}</span>
            <Swatch kind="bar" share={share.fraction} />
            <span class="network-share measure">{percent(share.fraction, lang)}</span>
          </li>
        {/each}
      </ul>
      <p class="detail-note">
        {copy.basis[region!.kind === 'cortex' ? 'vertices' : 'voxels']}
        {#if rest >= 0.005}{copy.unassigned(percent(rest, lang))}{/if}
      </p>
      <p class="detail-note">{copy.caveat}</p>
    </Disclosure>
  </div>
{/if}
