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
  import { t } from '../../lib/core/i18n/index.ts';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import CoordinateReport from '../lesion/CoordinateReport.svelte';
  import LesionReport from '../lesion/LesionReport.svelte';
  import { clinicalLayers } from '../../lib/core/state/clinical-navigation.ts';
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

  const {
    engine,
    view,
    regions,
    catalog,
    anatomy,
    excursions,
    lesion,
    clinical,
    session,
    commands,
  } = $derived(world);
  const current = $derived(view.current);
  const {
    manifest,
    cabNp,
    functionalRegions,
    domains,
    boundaryCertainty,
    segmentationAgreement,
    receptors,
  } = $derived(engine.model);
  // The comparison file is published beside the manifest the engine opened (boot.ts).
  const manifestUrl = $derived(`${ASSET_BASE}models/${manifest.anatomy.id}/manifest.json`);
  // A function's or deficit's profile above makes the region a smaller second subject (clinical.css:172-173, 299-300).
  const underProfile = $derived(
    (current.explorer === 'functions' && current.selectedFunction !== null) ||
      (current.explorer === 'deficits' && current.selectedDeficit !== null),
  );
  // A placed lesion is Anatomy's detail once no region is selected.
  const lesionShown = $derived(
    current.explorer === 'anatomy' && !current.selectedRegion && lesion.sphere !== null,
  );
  // The cortex is listed on the atlas on screen first, then the other.
  const lesionAtlases = $derived.by(() => {
    const short = t(current.lang, 'header').atlasShort as Record<string, string>;
    return [...manifest.atlases]
      .sort((a, b) => Number(b.id === current.atlas) - Number(a.id === current.atlas))
      .map(({ id }) => ({ id, name: short[id] ?? id }));
  });
  const bundles = $derived(tractCatalog(manifest.anatomy.id).bundles);
  // A coordinate's networks gather the parcels of the atlas the network layer assigns.
  const coordinateNetworks = $derived.by(() => {
    const layer = manifest.networks as
      { id: string; parcellation: { annotation: string } } | undefined;
    const atlas =
      layer && manifest.atlases.find((entry) => entry.annotation === layer.parcellation.annotation);
    return layer && atlas ? { id: layer.id, atlas: atlas.id } : null;
  });

  // The lesion's functions are named and grouped as the Functions tab names them.
  const domainNames = $derived(new Map(domains!.domains.map((row) => [row.id, row])));
  const groupNames = $derived(new Map(domains!.groups.map((group) => [group.id, group])));
  const named = (record: { name: string; name_fr: string } | undefined, id: string) => {
    if (!record) throw new Error(`No published name for ${id}.`);
    return current.lang === 'fr' ? record.name_fr : record.name;
  };
  // Under a masthead colour the brain shows the lesion alone, whatever was asked.
  const lesionMode = $derived(current.paintLifted ? 'lesion' : lesion.mode);

  /** Colour the brain by the lesion's functions or findings, on the atlas their regions are drawn on. */
  function chooseLesionMode(next: typeof lesion.mode) {
    lesion.setMode(next);
    if (next === 'lesion') return;
    session.showPaint();
    const cited = (lesion.findings?.shown ?? []).flatMap(({ association }) =>
      association.mappings.map(({ region }) => region),
    );
    const target =
      next === 'functions' ? domains!.atlas : clinicalLayers(engine.model, cited).atlas;
    if (target && target !== current.atlas) void commands.chooseAtlas(target);
  }

  async function openFinding(deficit: string, finding: string) {
    await deficits.openDeficit(deficit);
    session.setFinding(finding);
  }
</script>

<div class="detail-body">
  <div class="tab-group">
    <CircuitProfile model={circuits} />
    <CircuitStatus model={circuits} />
    <FunctionProfile model={functions} />
    <DeficitProfile explorer={deficits} view={current} />
    {#if lesionShown && lesion.coordinate}
      <CoordinateReport
        {lesion}
        lang={current.lang}
        spaces={manifest.coordinate_spaces!}
        anatomy={manifest.anatomy.id}
        atlases={lesionAtlases}
        networks={coordinateNetworks}
        territories={manifest.arterial_territories?.id ?? null}
        label={(id) => catalog.label(id).name}
        bundleName={(id) => bundles.find((bundle) => bundle.id === id)!.name[current.lang]}
        networksOf={(id) => engine.model.regions.get(id)?.networks}
      />
    {:else if lesionShown}
      <LesionReport
        {lesion}
        lang={current.lang}
        atlases={lesionAtlases}
        label={(id) => catalog.label(id).name}
        bundleName={(id) => bundles.find((bundle) => bundle.id === id)!.name[current.lang]}
        deficitName={(id) => clinical.get(id).name[current.lang]}
        functionName={(id) => named(domainNames.get(id), id)}
        groupName={(id) => named(groupNames.get(id), id)}
        mode={lesionMode}
        onMode={chooseLesionMode}
        onFunction={(id) => void functions.openFunction(id)}
        onDeficit={(id) => void deficits.openDeficit(id)}
        onFinding={(deficit, finding) => void openFinding(deficit, finding)}
      />
    {:else}
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
        {boundaryCertainty}
        {segmentationAgreement}
        {receptors}
        territories={manifest.arterial_territories ?? null}
        cerebellarFunctions={manifest.cerebellar_functions ?? null}
        onfocus={() => anatomy.focusSelection()}
        onisolate={anatomy.isolateSelection}
        onhide={() => void anatomy.hideSelection()}
        onclear={() => void anatomy.clearSelection()}
        onregion={(id) => void anatomy.openConstituent(id)}
        onselect={(id) => anatomy.selectRegion(id)}
        openLinkedMri={excursions.openLinkedMri}
        showAgreement={async (code, { instant }) => {
          await engine.sections.setAgreement(code);
          await excursions.openLinkedMri({ atRegion: true, instant });
        }}
      >
        {#snippet comparison()}
          <AtlasComparison
            {engine}
            {manifest}
            {manifestUrl}
            region={current.selectedRegion}
            lang={current.lang}
            outlineAvailable={!current.cutActive && !isIndependentTractReference(current)}
            {functionalRegions}
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
    {/if}
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
