<!--
  The anatomical letter at each edge of the picture (viewport-chrome.js:465-471, 834-838; stage.css:111-150).
  Type with a halo, not a plate, and silent: the letters have no non-visual equivalent by decision 10b on #4.
  They come from the engine's `camera` event; a language change re-words the letters the camera last
  reported and never reads the camera again, because a framing plan may have turned it toward somewhere it
  has not gone yet. Written straight into the text nodes, only where a letter changed.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { CameraView, Engine } from '../../lib/engine/api.ts';
  import type { Edge, StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    engine: Pick<Engine, 'on' | 'camera'>;
    stage: StageLayout;
    lang: Language;
    /** The anatomy is on screen (status `ready` or `switching`). */
    ready: boolean;
  }

  let { engine, stage, lang, ready }: Props = $props();

  const EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

  const nodes = {} as Record<Edge, HTMLElement>;
  // The letters the camera last reported; the engine is the stage's for its whole life.
  let edges: CameraView['edges'] = untrack(() => engine.camera.view.edges);

  function paint() {
    const letters = t(lang, 'orientation');
    for (const edge of EDGES) {
      const text = letters[edges[edge]];
      if (nodes[edge].textContent !== text) nodes[edge].textContent = text;
    }
  }

  // Re-worded when the language changes, from the letters already held.
  $effect(paint);

  $effect(() =>
    engine.on('camera', (camera) => {
      edges = camera.edges;
      paint();
    }),
  );

  function register(node: HTMLElement) {
    stage.registerOrientation(node);
    return () => stage.registerOrientation(null);
  }
</script>

<div id="orientation" class="orientation" hidden={!ready} {@attach register}>
  {#each EDGES as edge (edge)}
    <span data-edge={edge} {@attach (node) => void (nodes[edge] = node)}></span>
  {/each}
</div>

<style>
  @layer features {
    /* The letters frame what framing frames: the visible stage less a colour key's band. */
    .orientation {
      position: absolute;
      inset: calc(var(--vis-top) + var(--key-top)) calc(var(--vis-right) + var(--key-right))
        var(--vis-bottom) var(--vis-left);
      pointer-events: none;
    }
    /*
     * L/R/A/P/S/I are the picture's own markings: type with a halo, not plates. An opaque rim drawn under
     * the fill holds the edge over bright tissue, and stacked dark shadows widen it into a halo that keeps
     * the letter readable where the rim alone left white tissue touching the glyph. snapshot.js draws the
     * same rim and halo onto an exported image.
     */
    .orientation > span {
      position: absolute;
      z-index: 2;
      color: var(--overlay-ink);
      -webkit-text-stroke: 3px var(--overlay-halo-core);
      paint-order: stroke fill;
      text-shadow:
        0 0 1px var(--overlay-halo-core),
        0 0 2px var(--overlay-halo-core),
        0 0 4px var(--overlay-halo-core),
        0 0 8px var(--overlay-halo);
      font-size: var(--text-stage);
      font-weight: 600;
      line-height: var(--lh-caption);
      letter-spacing: 0.06em;
    }
    [data-edge='top'] {
      top: var(--space-3);
      left: 50%;
      transform: translateX(-50%);
    }
    /* The dock owns the bottom line; the letter clears the whole plate. */
    [data-edge='bottom'] {
      bottom: calc(var(--stage-gutter) + var(--dock-height) + var(--space-2));
      left: 50%;
      transform: translateX(-50%);
    }
    /* Level with the anatomy, which is framed in the stage above the dock. */
    [data-edge='left'],
    [data-edge='right'] {
      top: calc(50% - (var(--dock-height) + var(--stage-gutter)) / 2);
      transform: translateY(-50%);
    }
    [data-edge='left'] {
      left: var(--space-3);
    }
    [data-edge='right'] {
      right: var(--space-3);
    }
    /* Past the middle of a short stage the bottom letter would read as the top one, so it goes. */
    :global(#viewport[data-dock-tall='true']) [data-edge='bottom'] {
      visibility: hidden;
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .orientation {
        transition-property: opacity;
      }
    }
    /* The stage stays dark in every mode, so its markings keep the overlay ink and halo. */
    @media (forced-colors: active) {
      .orientation > span {
        forced-color-adjust: none;
      }
    }
  }
</style>
