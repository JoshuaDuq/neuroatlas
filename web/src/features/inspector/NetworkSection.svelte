<!--
  Functional networks (inspector.js:139-160): the region's Yeo shares with a bar and a percentage,
  and the CAB-NP network that assigns the whole HCP-MMP area. Nothing selected leaves the section
  out: a chart of the whole cortex is not a selection. The section stays mounted so its open state
  survives from one selection to the next.
-->
<script lang="ts">
  import type { Language, Region, Rgb } from '../../lib/types/index.ts';
  import {
    cabNpName,
    networkBasis,
    networkCss,
    networkName,
    networksOf,
  } from '../../lib/core/catalog/networks.ts';
  import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
  import { percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    colors,
    cabNp,
  }: {
    region: Region | null;
    lang: Language;
    /** The manifest's Yeo network colours; read only for a region that has shares. */
    colors: Readonly<Record<string, Rgb>> | undefined;
    cabNp: CabNpPartition | null;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'networks'));
  const shares = $derived(networksOf(region));
  // CAB-NP assigns a whole HCP-MMP area, so its one network is the area's entire share.
  const assigned = $derived(region ? (cabNp?.regions[region.id] ?? null) : null);

  function yeoColour(network: string): string {
    const rgb = colors?.[network];
    if (!rgb) throw new Error(`No colour published for network ${network}.`);
    return networkCss(rgb);
  }
</script>

{#if shares.length || assigned}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      {#if shares.length}
        <p class="network-map">{copy.yeo}</p>
        <ul class="network-list">
          {#each shares as share (share.network)}
            <li class="network-row">
              <Swatch colour={yeoColour(share.network)} />
              <span class="network-row-name">{networkName(share.network, lang)}</span>
              <Swatch kind="bar" share={share.fraction} />
              <span class="network-share measure">{percent(share.fraction, lang)}</span>
            </li>
          {/each}
        </ul>
        <p class="detail-note">{copy.notes[networkBasis(region!)]}</p>
      {/if}
      {#if assigned}
        <p class="network-map">{copy.cabNp}</p>
        <ul class="network-list">
          <li class="network-row">
            <Swatch colour={networkCss(cabNp!.colors[assigned])} />
            <span class="network-row-name">{cabNpName(assigned, lang)}</span>
            <Swatch kind="bar" share={1} />
            <span class="network-share measure">{percent(1, lang)}</span>
          </li>
        </ul>
        <p class="detail-note">{copy.cabNpNote}</p>
      {/if}
      <p class="detail-note">{copy.caveat}</p>
    </Disclosure>
  </div>
{/if}
