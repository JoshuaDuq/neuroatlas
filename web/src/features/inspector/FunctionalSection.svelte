<!--
  Functional division (inspector.js:185-204): the HCP-MMP area's section, and its named region where
  a source names one. Only an area of the HCP-MMP atlas has one. The section stays mounted so its
  open state survives from one selection to the next.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import {
    functionalName,
    functionalRegionOf,
    type FunctionalRegion,
    type FunctionalRegions,
  } from '../../lib/core/catalog/functional-regions.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    functionalRegions,
  }: {
    region: Region | null;
    lang: Language;
    functionalRegions: FunctionalRegions | null;
  } = $props();

  interface Contested {
    section: number | string;
    text_section: number | string;
  }

  let open = $state(false);

  const copy = $derived(t(lang, 'functional'));
  const section = $derived(
    region ? functionalRegionOf(functionalRegions, 'sections', region.id) : null,
  );
  const named = $derived(region ? functionalRegionOf(functionalRegions, 'named', region.id) : null);
  const rows = $derived(
    [
      named && { record: named, kind: copy.named },
      section && { record: section, kind: copy.section(section.number as number) },
    ].filter((row) => row != null),
  );
  // The build checked that every HCP-MMP name reads `L_<area>_ROI` or `R_<area>_ROI`.
  const contested = $derived(
    section
      ? (functionalRegions!.contested as Record<string, Contested | undefined>)[
          region!.source_name!.slice(2, -4)
        ]
      : undefined,
  );
  const note = $derived(
    [
      !named && copy.unnamed,
      contested && copy.contested(contested.section, contested.text_section),
      copy.note,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const sourceName = (record: FunctionalRegion) =>
    (functionalRegions!.sources[record.source] as { short: string }).short;
</script>

{#if section}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <ul class="network-list">
        {#each rows as { record, kind } (record.id)}
          <li class="network-row functional-row">
            <Swatch colour={networkCss(record.color)} />
            <span class="network-row-name">
              <span>{functionalName(record, lang)}</span>
              <span class="functional-row-meta">
                {[kind, sourceName(record), copy.areas(record.areas.join(' '))].join(' · ')}
              </span>
            </span>
          </li>
        {/each}
      </ul>
      <p class="detail-note">{note}</p>
    </Disclosure>
  </div>
{/if}
