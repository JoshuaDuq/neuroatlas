<!--
  Functional regions of the cerebellum: for a lobule, its share in each region of the registered
  Nettekoven et al. (2024) group atlas, by its voxels; for one of those regions chosen on a cut, what
  the paper found it does. A region the atlas does not reach has no section; it stays mounted so its
  open state survives from one selection to the next.
-->
<script lang="ts">
  import type { CerebellarFunctions, Language, Region } from '../../lib/types/index.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import { percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    functions,
  }: {
    region: Region | null;
    lang: Language;
    functions: CerebellarFunctions | null;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'cerebellarFunctions'));
  const sides = $derived(t(lang, 'sides').words);
  const shares = $derived(functions ? (region?.cerebellar_functions ?? []) : []);
  const rest = $derived(region?.cerebellar_functions_unassigned ?? 0);
  // A vermal lobule reaches both sides' regions, which then say which side they are.
  const bothSides = $derived(new Set(shares.map((share) => share.region.split(':')[1])).size > 1);
  const chosen = $derived(
    functions && region?.atlas === 'nettekoven' ? entryOf(region.id.split(':')[2]!) : null,
  );

  function entryOf(id: string) {
    const found = functions!.regions.find((entry) => entry.id === id);
    if (!found) throw new Error(`No cerebellar functional region ${id} is published.`);
    return found;
  }
  const nameOf = (entry: { name: string; name_fr: string }) =>
    lang === 'fr' ? entry.name_fr : entry.name;
</script>

{#if shares.length || chosen}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      {#if chosen}
        <p class="cerebellar-domain">{nameOf(functions!.domains[chosen.domain]!)}</p>
        <p class="detail-note">{lang === 'fr' ? chosen.description_fr : chosen.description}</p>
      {:else}
        <ul class="network-list">
          {#each shares as share (share.region)}
            {@const [, side, id] = share.region.split(':') as [string, 'left' | 'right', string]}
            {@const entry = entryOf(id)}
            <li class="network-row">
              <Swatch colour={networkCss(entry.color)} />
              <span class="network-row-name">
                {nameOf(entry)}{bothSides ? ` · ${sides[side]}` : ''}
                <span class="cerebellar-domain-note"
                  >{nameOf(functions!.domains[entry.domain]!)}</span
                >
              </span>
              <Swatch kind="bar" share={share.fraction} />
              <span class="network-share measure">{percent(share.fraction, lang)}</span>
            </li>
          {/each}
        </ul>
        <p class="detail-note">
          {copy.basis}
          {#if rest >= 0.005}{copy.unassigned(percent(rest, lang))}{/if}
        </p>
      {/if}
      <p class="detail-note">{copy.caveat}</p>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    .cerebellar-domain {
      margin: 0 0 var(--space-1);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
    }
    .cerebellar-domain-note {
      display: block;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-tertiary);
    }
  }
</style>
