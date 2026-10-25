<!--
  The scale bar (viewport-chrome.js:445-463; stage.css:152-179): a rule in true millimetres on a 1-2-5
  sequence, from the engine's `camera` event. Its rule and label are written straight into the DOM on every
  camera move; only its width goes to the stage-layout store, where it decides whether the dock and the bar
  share a line. The label's width is read once per wording, so a fit during a sheet drag forces no layout.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { decimal, withUnit } from '../../lib/core/format.ts';
  import type { CameraView, Engine } from '../../lib/engine/api.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    engine: Pick<Engine, 'on' | 'camera'>;
    stage: StageLayout;
    lang: Language;
    /** The anatomy is on screen (status `ready` or `switching`). */
    ready: boolean;
  }

  let { engine, stage, lang, ready }: Props = $props();

  let bar: HTMLElement;
  let rule: HTMLElement;
  let label: HTMLElement;
  // The scale the camera last reported; the engine is the stage's for its whole life.
  let scale: CameraView['scale'] = untrack(() => engine.camera.view.scale);
  const labelWidths = new Map<string, number>();

  function paint() {
    bar.hidden = !(ready && scale);
    if (bar.hidden) {
      stage.setScaleBarWidth(0);
      return;
    }
    const { millimetres, pixels } = scale!;
    const ruleWidth = Math.round(pixels);
    const text = withUnit(decimal(millimetres, 1, lang, { trim: true }), 'mm', lang);
    const width = `${ruleWidth}px`;
    if (rule.style.width !== width) rule.style.width = width;
    if (label.textContent !== text) label.textContent = text;
    if (!labelWidths.has(text)) labelWidths.set(text, bar.scrollWidth - ruleWidth);
    // The bar is as wide as the camera makes it, so the fit is asked again whenever it changes.
    stage.setScaleBarWidth(ruleWidth + labelWidths.get(text)!);
  }

  // Re-worded and re-shown when the language or the status changes, from the scale already held.
  $effect(paint);

  $effect(() =>
    engine.on('camera', (camera) => {
      scale = camera.scale;
      paint();
    }),
  );

  function register(node: HTMLElement) {
    stage.registerScaleBar(node);
    return () => stage.registerScaleBar(null);
  }
</script>

<div id="scale-bar" class="scale-bar" bind:this={bar} hidden {@attach register}>
  <span class="scale-bar-rule" bind:this={rule}></span>
  <span class="measure" bind:this={label}></span>
</div>

<style>
  @layer features {
    .scale-bar {
      position: absolute;
      z-index: 2;
      right: calc(var(--vis-right) + var(--stage-gutter));
      /* Centred on the tools' line: the dock's border and inset, then half what a tool has over the words. */
      bottom: calc(
        var(--vis-bottom) + var(--stage-gutter) + 1px + var(--space-1) +
          (var(--control-height) - var(--lh-caption)) / 2
      );
      display: flex;
      align-items: center;
      gap: var(--space-2);
      pointer-events: none;
      color: var(--overlay-ink);
      -webkit-text-stroke: 3px var(--overlay-halo-core);
      paint-order: stroke fill;
      text-shadow:
        0 0 1px var(--overlay-halo-core),
        0 0 2px var(--overlay-halo-core),
        0 0 4px var(--overlay-halo-core),
        0 0 8px var(--overlay-halo);
      font-size: var(--text-stage);
      line-height: var(--lh-caption);
    }
    .scale-bar-rule {
      height: 6px;
      border: 1px solid var(--overlay-ink);
      border-top: 0;
      filter: drop-shadow(0 0 1px var(--overlay-halo-core))
        drop-shadow(0 0 1px var(--overlay-halo-core));
    }
    /* When the dock and the bar cannot share the bottom line, the bar sits above the dock. */
    :global(#viewport:is([data-chrome='tight'], [data-chrome='stacked'])) .scale-bar {
      bottom: calc(var(--vis-bottom) + var(--stage-gutter) + var(--dock-height) + var(--space-2));
      right: calc(var(--vis-right) + var(--space-3));
    }
    /* Too wide to sit beside the bottom letter: one line higher. */
    :global(#viewport[data-chrome='stacked']) .scale-bar {
      bottom: calc(
        var(--vis-bottom) + var(--stage-gutter) + var(--dock-height) + 2 * var(--space-2) + 16px
      );
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .scale-bar {
        transition-property: opacity;
      }
    }
    /* The stage stays dark in every mode, so its markings keep the overlay ink and halo. */
    @media (forced-colors: active) {
      .scale-bar,
      .scale-bar-rule {
        forced-color-adjust: none;
      }
    }
  }
</style>
