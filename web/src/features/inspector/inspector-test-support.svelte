<!-- Fixture for the inspector tests: the real CDMD manifest and published partitions behind the panel, as I1 composes them. Not shipped. -->
<script lang="ts">
  import manifest from '../../../../public/models/cdmd/manifest.json';
  import cabNpFile from '../../../../public/models/cdmd/cab-np.json';
  import functionalFile from '../../../../public/models/cdmd/functional-regions.json';
  import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json';
  import boundaryFile from '../../../../public/models/cdmd/boundary-certainty.json';
  import receptorFile from '../../../../public/models/cdmd/receptor-fingerprints.json';
  import agreementFile from '../../../../public/models/cdmd/segmentation-agreement.json';
  import { createCatalog } from '../../lib/core/catalog/catalog.ts';
  import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
  import type { BoundaryCertainty } from '../../lib/core/catalog/boundary-certainty.ts';
  import type { ReceptorFingerprints } from '../../lib/core/catalog/receptor-fingerprints.ts';
  import type { SegmentationAgreement } from '../../lib/core/catalog/segmentation-agreement.ts';
  import type {
    ArterialTerritories,
    CerebellarFunctions,
    Explorer,
    Language,
    Region,
    Rgb,
  } from '../../lib/types/index.ts';
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
  boundaryCertainty={boundaryFile as unknown as BoundaryCertainty}
  segmentationAgreement={agreementFile as unknown as SegmentationAgreement}
  receptors={receptorFile as unknown as ReceptorFingerprints}
  territories={manifest.arterial_territories as unknown as ArterialTerritories}
  cerebellarFunctions={manifest.cerebellar_functions as unknown as CerebellarFunctions}
  onfocus={() => calls.push('focus')}
  onisolate={() => calls.push('isolate')}
  onhide={() => calls.push('hide')}
  onclear={() => calls.push('clear')}
  onregion={(id) => calls.push(`region:${id}`)}
  onselect={(id) => calls.push(`select:${id}`)}
  openLinkedMri={(options) => calls.push({ mri: options })}
  showAgreement={(code, options) => calls.push({ agreement: code, ...options })}
>
  {#snippet comparison()}<div data-slot="comparison"></div>{/snippet}
  {#snippet relatedDeficits()}{#if slots}<div data-slot="deficits"></div>{/if}{/snippet}
  {#snippet relatedCircuits()}{#if slots}<div data-slot="circuits"></div>{/if}{/snippet}
</RegionDetail>
