<!--
  The two lines of instruction at the top left of the picture (viewport-chrome.js:56-61, 478-489,
  600-620; stage.css:67-87). Type on the picture, like its markings: no plate, not interactive, and
  repeated in the canvas's own label for assistive technology. The navigation hint retires for good
  once the reader has rotated, zoomed or clicked the model (StageOverlay hears the gestures); the
  keyboard hint shows only while the canvas has focus (stage-vars.css; the canvas's own outline would
  run under the dock). A hint that would not fit one line clear of the top letter or a key is not drawn.
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    stage: StageLayout;
    lang: Language;
    /** A finger rather than a mouse: the hints name touch gestures (decision 21 on #4). */
    coarsePointer: boolean;
    /** The tract reference alone is shown: it has no regions to click. */
    tractReference: boolean;
  }

  let { stage, lang, coarsePointer, tractReference }: Props = $props();

  // TODO(C1): `viewport.navigationHintTouch` and `navigationHintTractsTouch` (requested on #4).
  const TOUCH = {
    en: {
      navigation: 'Drag to rotate · Pinch to zoom · Tap to inspect',
      tracts: 'Drag to rotate · Pinch to zoom',
    },
    fr: {
      navigation: 'Glisser\u202f: tourner · Pincer\u202f: zoom · Toucher\u202f: inspecter',
      tracts: 'Glisser\u202f: tourner · Pincer\u202f: zoom',
    },
  } as const;

  const copy = $derived(t(lang, 'viewport'));
  const navigation = $derived(
    coarsePointer
      ? TOUCH[lang][tractReference ? 'tracts' : 'navigation']
      : tractReference
        ? copy.navigationHintTracts
        : copy.navigationHint,
  );

  let navigationNode: HTMLElement;
  let focusNode: HTMLElement;
  let navigationFits = $state(true);
  let focusFits = $state(true);

  // Each wording is measured once: its width does not change until its words do.
  const widths = new Map<string, number>();
  const fits = (node: HTMLElement, room: number) => {
    const text = node.textContent!;
    if (!widths.has(text)) widths.set(text, node.offsetWidth);
    return widths.get(text)! <= room;
  };

  $effect(() => {
    void navigation;
    void copy.keyboardHint;
    const room = stage.hintRoom;
    if (room === null) return;
    navigationFits = fits(navigationNode, room);
    focusFits = fits(focusNode, room);
  });
</script>

<p
  id="viewport-help"
  class="viewport-help"
  bind:this={navigationNode}
  data-dismissed={stage.hintRetired}
  data-room={navigationFits}
>
  {navigation}
</p>
<p
  id="viewport-focus-hint"
  class="viewport-help viewport-focus-hint"
  bind:this={focusNode}
  data-room={focusFits}
>
  {copy.keyboardHint}
</p>

<style>
  @layer features {
    .viewport-help {
      position: absolute;
      z-index: 2;
      top: calc(var(--vis-top) + var(--stage-gutter));
      left: calc(var(--vis-left) + var(--stage-gutter));
      margin: 0;
      color: var(--overlay-ink-muted);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      white-space: nowrap;
      text-shadow:
        0 0 2px var(--overlay-halo-core),
        0 0 4px var(--overlay-halo-core),
        0 0 8px var(--overlay-halo);
      pointer-events: none;
      transition: opacity var(--camera-transition) var(--ease-ui);
    }
    /* Faded out, then out of every box: a retired hint is neither measured nor read. */
    .viewport-help[data-dismissed='true'] {
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--camera-transition) var(--ease-ui),
        visibility 0s linear var(--camera-transition);
    }
    /* No room for one line clear of the top letter. */
    .viewport-help[data-room='false'] {
      visibility: hidden;
    }
    .viewport-focus-hint {
      opacity: 0;
      color: var(--overlay-accent);
      transition: none;
    }
    :global(#viewport:has(> canvas:focus-visible)) .viewport-focus-hint {
      opacity: 1;
    }
    :global(#viewport:has(> canvas:focus-visible)) #viewport-help {
      opacity: 0;
    }
  }
</style>
