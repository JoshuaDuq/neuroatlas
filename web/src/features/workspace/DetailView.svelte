<!--
  The workspace's detail view (index.html:339-424): one reading surface, in legacy's order: the lesson's
  profile and its action status, the function and deficit profiles, the region, the deficits related to
  it, the lesson's notes and the lessons through it. Each part draws itself only where it applies. The
  legacy sibling rules on the region are its `landmarkSelected` and `underProfile` props.
-->
<script lang="ts">
  import type { World } from '../../app/application.svelte.ts';
  import { ASSET_BASE } from '../../../build/site.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import type { Rgb } from '../../lib/types/index.ts';
  import CircuitNotes from '../circuits/CircuitNotes.svelte';
  import CircuitProfile from '../circuits/CircuitProfile.svelte';
  import CircuitStatus from '../circuits/CircuitStatus.svelte';
  import type { CircuitExplorer } from '../circuits/circuits-explorer.svelte.ts';
  import RelatedCircuits from '../circuits/RelatedCircuits.svelte';
  import DeficitProfile from '../deficits/DeficitProfile.svelte';
  import type { DeficitsExplorer } from '../deficits/explorer.svelte.ts';
  import RelatedDeficits from '../deficits/RelatedDeficits.svelte';
  import FunctionProfile from '../functions/FunctionProfile.svelte';
  import type { FunctionExplorer } from '../functions/functions-explorer.svelte.ts';
  import AtlasComparison from '../inspector/AtlasComparison.svelte';
  import RegionDetail from '../inspector/RegionDetail.svelte';

  let {
    world,
    functions,
    deficits,
    circuits,
  }: {
    world: World;
    functions: FunctionExplorer;
    deficits: DeficitsExplorer;
    circuits: CircuitExplorer;
  } = $props();

  const { engine, view, regions, catalog, anatomy, excursions } = $derived(world);
  const current = $derived(view.current);
  const { manifest, cabNp, functionalRegions, domains } = $derived(engine.model);
  // The comparison file is published beside the manifest the engine opened (boot.ts).
  const manifestUrl = $derived(`${ASSET_BASE}models/${manifest.anatomy.id}/manifest.json`);
  // A function's or deficit's profile above makes the region a smaller second subject (clinical.css:172-173, 299-300).
  const underProfile = $derived(
    (current.explorer === 'functions' && current.selectedFunction !== null) ||
      (current.explorer === 'deficits' && current.selectedDeficit !== null),
  );
</script>

<div class="detail-body">
  <div class="tab-group">
    <CircuitProfile model={circuits} />
    <CircuitStatus model={circuits} />
    <FunctionProfile model={functions} />
    <DeficitProfile explorer={deficits} view={current} />
    <RegionDetail
      lang={current.lang}
      region={current.selectedRegion}
      explorer={current.explorer}
      cortexVisible={current.cortexVisible}
      isolated={current.isolatedRegion !== null}
      landmarkSelected={circuits.landmarkSelected}
      {underProfile}
      catalog={{ get: regions.get, label: catalog.label }}
      centroidOf={(id) => engine.model.centroidOf(id)}
      networkColors={manifest.networks?.colors as Readonly<Record<string, Rgb>> | undefined}
      {cabNp}
      {functionalRegions}
      {domains}
      onfocus={() => anatomy.focusSelection()}
      onisolate={anatomy.isolateSelection}
      onhide={() => void anatomy.hideSelection()}
      onclear={() => void anatomy.clearSelection()}
      onregion={(id) => void anatomy.openConstituent(id)}
      openLinkedMri={excursions.openLinkedMri}
    >
      {#snippet comparison()}
        <AtlasComparison
          {engine}
          {manifest}
          {manifestUrl}
          region={current.selectedRegion}
          lang={current.lang}
          outlineAvailable={!current.cutActive && !isIndependentTractReference(current)}
        />
      {/snippet}
      {#snippet relatedDeficits()}
        <RelatedDeficits explorer={deficits} view={current} />
      {/snippet}
      {#snippet relatedCircuits()}
        <!-- The lesson's notes come before the lessons through the region, as in legacy; never both at once. -->
        <CircuitNotes model={circuits} />
        <RelatedCircuits model={circuits} />
      {/snippet}
    </RegionDetail>
  </div>
</div>

<style>
  @layer features {
    /* One reading surface from its record through its supporting evidence (layout.css:140-154). */
    .detail-body {
      /* Keep absolutely positioned accessibility text inside its scrolling panel. */
      position: relative;
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      /* A classic scrollbar arriving with a little overflow would narrow every row; the gutter is held instead. */
      scrollbar-gutter: stable;
      background: var(--surface-base);
    }
    .tab-group {
      padding-bottom: var(--space-4);
      background: var(--surface-base);
    }

    /* The phone sheet: H6's #inspector carries the home-indicator padding, so there is one rule (phone.css:226-231). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .detail-body {
        -webkit-overflow-scrolling: touch;
      }
    }
  }
</style>
