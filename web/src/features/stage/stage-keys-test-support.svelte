<!--
  Fixture for the stage keys tests: the stage host as the Stage region renders it, with the variables
  the overlay writes, and the keys. Not shipped.
-->
<script lang="ts">
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { Legend } from '../../lib/core/state/paint.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type {
    FunctionalLevel,
    Language,
    LoadStatus,
    SurfaceColor,
  } from '../../lib/types/index.ts';
  import StageKeys from './StageKeys.svelte';
  import type { ColoredNetworks } from './stage-keys.ts';

  interface Props {
    stage: StageLayout;
    /** Reactive, so a test can change what the stage shows. */
    live: {
      lang: Language;
      status: LoadStatus;
      surfaceColor: SurfaceColor;
      functionalLevel: FunctionalLevel;
      networks: ColoredNetworks | null;
      cabNp: ColoredNetworks | null;
      functionalRegions: FunctionalRegions | null;
      legend: Legend | null;
      directionShown: boolean;
      media: Pick<Media, 'phone' | 'coarsePointer'>;
    };
    onFunctionalLevel?: (level: FunctionalLevel) => void;
    onPaintPick?: (id: string | null) => void;
    /** The stage's size in CSS pixels. */
    width?: number;
    height?: number;
    /** Receives `keys.model`, which the snapshot reads (G6). */
    handle?: { model?: StageKeys['model'] };
  }

  let keys: StageKeys;

  let {
    stage,
    live,
    onFunctionalLevel = () => {},
    onPaintPick = () => {},
    width = 1200,
    height = 800,
    handle,
  }: Props = $props();

  $effect(() => {
    if (handle) handle.model = () => keys.model();
  });
</script>

<main
  id="viewport"
  tabindex="-1"
  style:width="{width}px"
  style:height="{height}px"
  style:--stage-gutter="12px"
  style:--vis-top="0px"
  style:--vis-right="0px"
  style:--vis-bottom="0px"
  style:--vis-left="0px"
  style:--dock-height="38px"
>
  <canvas id="stage-canvas" tabindex="0" aria-label="Brain model"></canvas>
  <StageKeys
    bind:this={keys}
    {stage}
    media={live.media}
    lang={live.lang}
    status={live.status}
    surfaceColor={live.surfaceColor}
    functionalLevel={live.functionalLevel}
    networks={live.networks}
    cabNp={live.cabNp}
    functionalRegions={live.functionalRegions}
    legend={live.legend}
    directionShown={live.directionShown}
    {onFunctionalLevel}
    {onPaintPick}
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
