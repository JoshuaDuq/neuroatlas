<!--
  Everything drawn on the picture that is not a control: the hints, the orientation letters, the scale bar
  and the hover chip (index.html:427-429, 529, 581; stage.css:1-185). One non-interactive, `aria-hidden`
  layer over the stage host, which it is a child of (`<main id="viewport">`, the Stage region). It is also
  the writer of the host's layout variables, from the stage-layout store: `--vis-*` (the rectangle the
  reader can see), `--key-*` (the band a colour key takes), `--dock-height`, `data-chrome` and
  `data-dock-tall`, which the dock, the keys and the sheet read. The camera and hover events go straight
  to the parts that draw them; the viewport event reaches the store.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { Engine } from '../../lib/engine/api.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language, SessionState } from '../../lib/types/index.ts';
  import HoverChip from './HoverChip.svelte';
  import type { HoverSources, HoverView } from './hover-text.ts';
  import Orientation from './Orientation.svelte';
  import ScaleBar from './ScaleBar.svelte';
  import StageHints from './StageHints.svelte';
  import './stage-vars.css';

  interface Props {
    engine: Pick<Engine, 'on' | 'camera'>;
    stage: StageLayout;
    media: Pick<Media, 'phone' | 'coarsePointer'>;
    lang: Language;
    status: SessionState['status'];
    /** The tract reference alone is shown: it has no regions to click. */
    tractReference: boolean;
    selectedId: string | null;
    view: HoverView;
    sources: HoverSources;
  }

  let { engine, stage, media, lang, status, tractReference, selectedId, view, sources }: Props =
    $props();

  const ready = $derived(status === 'ready' || status === 'switching');

  /** Keys that move the camera while the canvas has focus (viewport-chrome.js:41). */
  const CAMERA_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-']);

  let layer: HTMLElement;
  const host = () => layer.parentElement!;

  // The rectangle the reader can see, as the engine measures it.
  $effect(() => {
    untrack(() => stage.setViewport(engine.camera.visibleRect, engine.camera.hostSize));
    return engine.on('viewport', ({ visibleRect, hostSize }) =>
      stage.setViewport(visibleRect, hostSize),
    );
  });

  // The gutter differs on a phone, so it is read again when the device class changes.
  $effect(() => {
    void media.phone;
    const gutter = parseFloat(getComputedStyle(host()).getPropertyValue('--stage-gutter'));
    if (!(gutter >= 0)) throw new Error('The stage host has no --stage-gutter.');
    stage.setGutter(gutter);
  });

  $effect(() => {
    const { visibleRect: rect, hostSize: size } = stage;
    if (!rect || !size) return;
    const style = host().style;
    style.setProperty('--vis-top', `${Math.round(rect.y)}px`);
    style.setProperty('--vis-left', `${Math.round(rect.x)}px`);
    style.setProperty('--vis-right', `${Math.round(size.width - rect.x - rect.width)}px`);
    style.setProperty('--vis-bottom', `${Math.round(size.height - rect.y - rect.height)}px`);
  });

  $effect(() => {
    const style = host().style;
    style.setProperty('--key-top', `${stage.keyInset.top}px`);
    style.setProperty('--key-right', `${stage.keyInset.right}px`);
  });

  // Until the dock is measured, the stylesheet's own height stands.
  $effect(() => {
    if (stage.dock.height) host().style.setProperty('--dock-height', `${stage.dock.height}px`);
  });

  $effect(() => {
    host().dataset.chrome = stage.chrome;
    host().dataset.dockTall = String(stage.dockTall);
  });

  // Once the reader has moved or clicked the model, the instruction has done its work, for good.
  $effect(() => {
    if (stage.hintRetired) return;
    const element = host();
    const onGesture = (event: Event) => {
      if ((event.target as Element).tagName === 'CANVAS') stage.retireHint();
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as Element).tagName === 'CANVAS' && CAMERA_KEYS.has(event.key)) {
        stage.retireHint();
      }
    };
    element.addEventListener('pointerdown', onGesture);
    element.addEventListener('wheel', onGesture, { passive: true });
    element.addEventListener('keydown', onKey);
    return () => {
      element.removeEventListener('pointerdown', onGesture);
      element.removeEventListener('wheel', onGesture);
      element.removeEventListener('keydown', onKey);
    };
  });

  // The region selected when the stage first drew; a later selection means "click to inspect" was learned.
  let firstSelection: string | null | undefined;
  $effect(() => {
    if (status === 'ready' && firstSelection === undefined) firstSelection = selectedId;
    else if (selectedId && firstSelection !== undefined && selectedId !== firstSelection) {
      untrack(() => stage.retireHint());
    }
  });
</script>

<div class="stage-overlay" bind:this={layer} aria-hidden="true">
  <StageHints {stage} {lang} coarsePointer={media.coarsePointer} {tractReference} />
  <Orientation {engine} {stage} {lang} {ready} />
  <ScaleBar {engine} {stage} {lang} {ready} />
  <HoverChip {engine} {view} {sources} />
</div>

<style>
  @layer features {
    /*
     * The stage host's variables. The --vis-* edges are the rectangle the reader can see and --key-* the band
     * a colour key takes off it; the script above writes both, and --dock-height, from the store.
     */
    :global(#viewport) {
      --vis-top: 0px;
      --vis-right: 0px;
      --vis-bottom: 0px;
      --vis-left: 0px;
      --key-top: 0px;
      --key-right: 0px;
      --dock-height: 38px;
      /* One edge for every plate on the stage. */
      --stage-edge: color-mix(in srgb, var(--overlay-border) 75%, var(--overlay-plate));
    }
    /* The host's own box, so the markings are placed against the stage and the dock beside them is not under it. */
    .stage-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  }
</style>
