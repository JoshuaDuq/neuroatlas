<!--
  Neuropsychological domains (inspector.js:207-235): the domains an HCP-MMP area or a sampled
  structure reaches the threshold for, strongest first, each with its z. A scored region that
  reaches none says so. The section stays mounted so its open state survives from one selection
  to the next.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import {
    domainName,
    domainsOf,
    scoredRegion,
    type NeuropsychDomains,
  } from '../../lib/core/catalog/neuropsych-domains.ts';
  import { decimal } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    domains,
  }: { region: Region | null; lang: Language; domains: NeuropsychDomains | null } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'domains'));
  const scored = $derived(domains !== null && region !== null && scoredRegion(domains, region));
  const found = $derived(scored ? domainsOf(domains, region!.id) : []);
  const note = $derived.by(() => {
    if (!scored) return '';
    const sources = domains!.sources as Record<string, { short: string }>;
    const source = sources[domains!.scores_source as string]!.short;
    const basis = region!.atlas === domains!.atlas ? copy.note : copy.noteStructure;
    return [!found.length && copy.none(decimal(domains!.threshold_z, 0, lang)), basis(source)]
      .filter(Boolean)
      .join(' ');
  });
</script>

{#if scored}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <ul class="network-list">
        {#each found as record (record.id)}
          <li class="network-row functional-row">
            <Swatch colour={networkCss(record.color)} />
            <span class="network-row-name">
              <span>{domainName(record, lang)}</span>
              <span class="functional-row-meta"
                >{copy.score(record.term, decimal(record.z, 1, lang))}</span
              >
            </span>
          </li>
        {/each}
      </ul>
      <p class="detail-note">{note}</p>
    </Disclosure>
  </div>
{/if}
