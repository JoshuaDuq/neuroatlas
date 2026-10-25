<!-- Fixture for the stage overlay tests: the stage host as the Stage region renders it, a canvas, and the overlay. Not shipped. -->
<script lang="ts">
  import type { FakeEngine } from '../../lib/engine/fake.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language, SessionState } from '../../lib/types/index.ts';
  import type { HoverSources, HoverView } from './hover-text.ts';
  import StageOverlay from './StageOverlay.svelte';

  interface Props {
    engine: FakeEngine;
    stage: StageLayout;
    /** Reactive, so a test can change the language, the status or the device class. */
    live: {
      lang: Language;
      status: SessionState['status'];
      tractReference: boolean;
      selectedId: string | null;
      view: HoverView;
      media: Pick<Media, 'phone' | 'coarsePointer'>;
    };
    sources: HoverSources;
  }

  let { engine, stage, live, sources }: Props = $props();
</script>

<main id="viewport" tabindex="-1">
  <canvas id="stage-canvas" tabindex="0" aria-label="Brain model"></canvas>
  <StageOverlay
    {engine}
    {stage}
    media={live.media}
    lang={live.lang}
    status={live.status}
    tractReference={live.tractReference}
    selectedId={live.selectedId}
    view={live.view}
    {sources}
  />
</main>

<style>
  @layer features {
    main {
      position: relative;
      overflow: hidden;
      width: 900px;
      height: 600px;
      background: var(--scene-background);
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
</style>
