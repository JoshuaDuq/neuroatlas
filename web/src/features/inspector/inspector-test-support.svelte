<!-- Fixture for the inspector tests: the real CDMD manifest and published partitions behind the panel, as I1 composes them. Not shipped. -->
<script lang="ts">
  import manifest from '../../../../public/models/cdmd/manifest.json';
  import cabNpFile from '../../../../public/models/cdmd/cab-np.json';
  import functionalFile from '../../../../public/models/cdmd/functional-regions.json';
  import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json';
  import { createCatalog } from '../../lib/core/catalog/catalog.ts';
  import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
  import type { Explorer, Language, Region, Rgb } from '../../lib/types/index.ts';
  import Tooltip from '../../lib/ui/Tooltip.svelte';
  import RegionDetail from './RegionDetail.svelte';

  let {
    regionId = null,
    lang = 'en',
    explorer = 'anatomy',
    cortexVisible = true,
    isolated = false,
    landmarkSelected,
    underProfile,
    slots = true,
    calls = [],
  }: {
    regionId?: string | null;
    lang?: Language;
    explorer?: Explorer;
    cortexVisible?: boolean;
    isolated?: boolean;
    landmarkSelected?: boolean;
    underProfile?: boolean;
    slots?: boolean;
    calls?: unknown[];
  } = $props();

  const regions = manifest.regions as unknown as Region[];
  const catalog = createCatalog({ regions }, 'en', cabNpFile as unknown as CabNpPartition);
  $effect.pre(() => catalog.setLanguage(lang));
  const region = $derived(
    regionId ? (regions.find((entry) => entry.id === regionId) ?? null) : null,
  );
  const label = (id: string) => catalog.label(id, { lang } as never);
</script>

<Tooltip />
<RegionDetail
  {lang}
  {region}
  {explorer}
  {cortexVisible}
  {isolated}
  {landmarkSelected}
  {underProfile}
  catalog={{ get: (id) => catalog.get(id), label }}
  centroidOf={(id) => (id === 'aseg:left:8' ? null : [-12.34, 56.78, -9])}
  networkColors={manifest.networks.colors as unknown as Record<string, Rgb>}
  cabNp={cabNpFile as unknown as CabNpPartition}
  functionalRegions={functionalFile as unknown as FunctionalRegions}
  domains={domainsFile as unknown as NeuropsychDomains}
  onfocus={() => calls.push('focus')}
  onisolate={() => calls.push('isolate')}
  onhide={() => calls.push('hide')}
  onclear={() => calls.push('clear')}
  onregion={(id) => calls.push(`region:${id}`)}
  openLinkedMri={(options) => calls.push({ mri: options })}
>
  {#snippet comparison()}<div data-slot="comparison"></div>{/snippet}
  {#snippet relatedDeficits()}{#if slots}<div data-slot="deficits"></div>{/if}{/snippet}
  {#snippet relatedCircuits()}{#if slots}<div data-slot="circuits"></div>{/if}{/snippet}
</RegionDetail>
