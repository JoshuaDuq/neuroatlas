<!--
  Fixture for the snapshot tests: the stage host as the Stage region renders it, with the overlay (letters,
  scale bar) and the colour keys over the fake engine. Not shipped.
-->
<script lang="ts">
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { Legend } from '../../lib/core/state/paint.ts';
  import type { FakeEngine } from '../../lib/engine/fake.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type {
    FunctionalLevel,
    Language,
    LoadStatus,
    SurfaceColor,
  } from '../../lib/types/index.ts';
  import StageKeys from '../stage/StageKeys.svelte';
  import StageOverlay from '../stage/StageOverlay.svelte';
  import type { HoverSources } from '../stage/hover-text.ts';
  import type { ColoredNetworks } from '../stage/stage-keys.ts';
  import type { StageKeysModel } from './markings.ts';

  interface Props {
    engine: FakeEngine;
    stage: StageLayout;
    /** Reactive, so a test can change what the stage shows. */
    live: {
      lang: Language;
      status: LoadStatus;
      surfaceColor: SurfaceColor;
      functionalLevel: FunctionalLevel;
      networks: ColoredNetworks | null;
      functionalRegions: FunctionalRegions | null;
      legend: Legend | null;
    };
    /** Receives the keys, as the Stage region binds them for the snapshot. */
    handle: { keys?: StageKeysModel };
    width: number;
    height: number;
  }

  let { engine, stage, live, handle, width, height }: Props = $props();

  const media = { phone: false, coarsePointer: false };
  const sources: HoverSources = {
    regions: new Map(),
    functionalRegions: null,
    cabNp: null,
    domains: null,
    catalogName: () => undefined,
    canSelect: () => true,
  };
</script>

<main id="viewport" tabindex="-1" style:width="{width}px" style:height="{height}px">
  <canvas id="stage-canvas" tabindex="0" aria-label="Brain model"></canvas>
  <StageOverlay
    {engine}
    {stage}
    {media}
    lang={live.lang}
    status={live.status}
    tractReference={false}
    selectedId={null}
    view={{
      lang: live.lang,
      surfaceColor: live.surfaceColor,
      functionalLevel: live.functionalLevel,
      paint: null,
      selectedFunction: null,
    }}
    {sources}
  />
  <StageKeys
    bind:this={handle.keys}
    {stage}
    {media}
    lang={live.lang}
    status={live.status}
    surfaceColor={live.surfaceColor}
    functionalLevel={live.functionalLevel}
    networks={live.networks}
    cabNp={null}
    functionalRegions={live.functionalRegions}
    legend={live.legend}
    directionShown={false}
    onFunctionalLevel={() => {}}
    onPaintPick={() => {}}
  />
</main>

<style>
  @layer features {
    main {
      position: relative;
      overflow: hidden;
      background: var(--scene-background);
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
</style>
