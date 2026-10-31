<!--
  The stage dock: one plate of worded tools, Section, Lesion, Coordinate and Display, each opening a popover
  (index.html:433-490, stage.css:311-440). APG Toolbar (deviation g2-dock-toolbar): the row is a labelled
  `role="toolbar"` with one Tab stop; ← → ↑ ↓ and Home/End move between the visible tools, Enter and Space
  open. The tract reference has none of them, so the dock is not drawn over it.
  - U5's popover keeps its trigger and its content together, so the popovers' controls sit inside the toolbar
    element. Only the tools rove (`.stage-tool`); keys inside a popover are the popover's own.
  - The popovers are placed above the whole dock on its start edge, inside the visible stage (place-popover.ts).
  - Section's popover and the section row above the tools are G4's, the Lesion's and Coordinate's bodies the
    lesion feature's: they come in as snippets. Coordinate is offered only with a body (published spaces).
  - A click on the brain places the lesion only while the reader has chosen so in the Lesion popover and it is
    open, and while it does, a press on the stage keeps it open.
  - The dock root carries `data-own-keys` (decision 7): the page's single-key shortcuts skip its controls.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { Language, SessionState } from '../../lib/types/index.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';
  import { bindRoving } from '../../lib/ui/roving.ts';
  import type { DockCommands } from './dock-commands.ts';
  import DisplayPopover from './DisplayPopover.svelte';
  import { POPOVER_WIDTH, placePopover } from './place-popover.ts';
  import StagePopover from './StagePopover.svelte';

  interface Props {
    stage: StageLayout;
    media: Pick<Media, 'phone'>;
    lang: Language;
    status: SessionState['status'];
    /** The tract reference alone is shown: it has no sections, lesion or display settings. */
    tractReference: boolean;
    /** The display settings the Display popover shows. */
    view: Pick<
      View,
      'hemisphere' | 'cortexVisible' | 'cortexOpacity' | 'internalVisible' | 'spinalCordVisible'
    >;
    /** The subject publishes a spinal cord. */
    hasSpinalCord: boolean;
    commands: Omit<DockCommands, 'chooseView' | 'reset'>;
    /** G4: the body of the Section popover, and the section row above the tools. */
    sectionPopover: Snippet<[{ close: () => void }]>;
    sectionBar?: Snippet;
    /** The Lesion popover's body, with the choice of what a click on the brain does. */
    lesionPopover: Snippet<
      [{ close: () => void; placing: boolean; setPlacing: (placing: boolean) => void }]
    >;
    /** The Coordinate popover's body; without one the tool is not offered. */
    coordinatePopover?: Snippet<[{ close: () => void }]>;
    onLesionPlacing: (placing: boolean) => void;
  }

  let {
    stage,
    media,
    lang,
    status,
    tractReference,
    view,
    hasSpinalCord,
    commands,
    sectionPopover,
    sectionBar,
    lesionPopover,
    coordinatePopover,
    onLesionPlacing,
  }: Props = $props();

  const uid = $props.id();
  const sectionLabelId = `section-tool-${uid}`;
  const lesionLabelId = `lesion-tool-${uid}`;
  const coordinateLabelId = `coordinate-tool-${uid}`;
  const displayLabelId = `display-tool-${uid}`;

  const copy = $derived(t(lang, 'viewport'));
  // The dock is not drawn while the anatomy loads, failed or lost its context (stage.css:315).
  const shown = $derived(status === 'ready' || status === 'switching');
  // A phone sheet raised over the stage covers it.
  const covered = $derived(!shown || stage.sheetFull);

  let sectionOpen = $state(false);
  let lesionOpen = $state(false);
  let coordinateOpen = $state(false);
  let displayOpen = $state(false);
  const anyOpen = $derived(sectionOpen || lesionOpen || coordinateOpen || displayOpen);
  // A click places the lesion only while the reader chose so, and only until the Lesion popover closes.
  let placing = $state(false);
  $effect(() => {
    if (!lesionOpen) placing = false;
  });
  $effect(() => onLesionPlacing(lesionOpen && placing && !tractReference));

  let dock: HTMLElement;
  let tools: HTMLElement;

  $effect(() => stage.observeDock(dock));

  function rove(group: HTMLElement) {
    const roving = bindRoving(group, { selector: '.stage-tool' });
    // Inside an open popover the Tab stop is its own tool, so Shift+Tab from its first control returns
    // to the tool with the popover still open (stage-tools.js:114-117), not to the first tool.
    const keepOpenTool = (event: FocusEvent) => {
      const open = group.querySelector<HTMLElement>('.stage-tool[aria-expanded="true"]');
      if (!open || (event.target as Element).closest('.stage-tool')) return;
      for (const tool of group.querySelectorAll<HTMLElement>('.stage-tool')) {
        tool.tabIndex = tool === open ? 0 : -1;
      }
    };
    group.addEventListener('focusin', keepOpenTool);
    return () => {
      group.removeEventListener('focusin', keepOpenTool);
      roving.dispose();
    };
  }

  /** The first tool left, or the model once the tract reference takes them all; runs before they hide. */
  function rescueFocus() {
    const next = tractReference
      ? dock.parentElement!.querySelector<HTMLElement>(':scope > canvas')
      : tools.querySelector<HTMLElement>('.stage-tool:not([hidden])');
    next?.focus({ preventScroll: true });
  }

  // Where the open popover goes: measured once the dock has moved to where the stage's variables put it.
  let spot = $state<ReturnType<typeof placePopover> | null>(null);
  $effect(() => {
    if (!anyOpen) return;
    const { visibleRect } = stage;
    void [stage.hostSize, stage.dock, stage.gutter];
    if (!visibleRect) return;
    const fill = media.phone;
    let current = true;
    tick().then(() => {
      if (!current) return;
      const origin = dock.offsetParent!.getBoundingClientRect();
      const corner = dock.getBoundingClientRect();
      const placed = placePopover({
        toolbar: { left: corner.left - origin.left, top: corner.top - origin.top },
        visible: visibleRect,
        width: POPOVER_WIDTH,
        fill,
        gutter: stage.gutter,
      });
      // `left` is measured from the dock's outer edge; CSS places it inside the dock's border.
      spot = { ...placed, left: placed.left - dock.clientLeft };
    });
    return () => {
      current = false;
    };
  });
  const popoverStyle = $derived(
    spot
      ? `left: ${spot.left}px; width: ${spot.width}px; max-height: ${spot.maxHeight}px`
      : `width: ${POPOVER_WIDTH}px`,
  );

  /** The stage's own canvas, where a press places the lesion while the reader has chosen so. */
  const onStage = (node: Node) =>
    node instanceof HTMLCanvasElement && (dock.offsetParent?.contains(node) ?? false);
</script>

<div
  bind:this={dock}
  class="stage-dock"
  data-shown={shown && !tractReference}
  {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
>
  <div
    bind:this={tools}
    class="stage-toolbar"
    role="toolbar"
    aria-label={copy.dockLabel}
    {@attach rove}
  >
    <StagePopover
      bind:open={sectionOpen}
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={sectionLabelId}
      {rescueFocus}
    >
      {#snippet name()}<span id={sectionLabelId}>{copy.sectionTool}</span>{/snippet}
      {#snippet body({ close })}{@render sectionPopover({ close })}{/snippet}
    </StagePopover>
    <StagePopover
      bind:open={lesionOpen}
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={lesionLabelId}
      {rescueFocus}
      holdsOpen={(node) => placing && onStage(node)}
    >
      {#snippet name()}<span id={lesionLabelId}>{copy.lesionTool}</span>{/snippet}
      {#snippet body({ close })}
        {@render lesionPopover({ close, placing, setPlacing: (next) => (placing = next) })}
      {/snippet}
    </StagePopover>
    <StagePopover
      bind:open={coordinateOpen}
      hidden={tractReference || !coordinatePopover}
      {covered}
      style={popoverStyle}
      dialogLabelledby={coordinateLabelId}
      {rescueFocus}
    >
      {#snippet name()}<span id={coordinateLabelId}>{copy.coordinateTool}</span>{/snippet}
      {#snippet body({ close })}{@render coordinatePopover?.({ close })}{/snippet}
    </StagePopover>
    <StagePopover
      bind:open={displayOpen}
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={displayLabelId}
      {rescueFocus}
    >
      {#snippet name()}<span id={displayLabelId}>{copy.displayTool}</span>{/snippet}
      {#snippet body()}
        <DisplayPopover
          {lang}
          hemisphere={view.hemisphere}
          cortexVisible={view.cortexVisible}
          cortexOpacity={view.cortexOpacity}
          internalVisible={view.internalVisible}
          spinalCordVisible={view.spinalCordVisible}
          {hasSpinalCord}
          onHemisphere={commands.setHemisphere}
          onCortexVisible={commands.setCortexVisible}
          onCortexOpacity={commands.setCortexOpacity}
          onInternalVisible={commands.setInternalVisible}
          onSpinalCordVisible={commands.setSpinalCordVisible}
        />
      {/snippet}
    </StagePopover>
  </div>
  {@render sectionBar?.()}
</div>

<style>
  @layer features {
    /* The dock: one plate, the tools on its bottom line and the section row above them. */
    .stage-dock {
      position: absolute;
      /* Above the markings and keys, so an open popover is never drawn under the scale bar. */
      z-index: 3;
      left: calc(var(--vis-left) + var(--stage-gutter));
      bottom: calc(var(--vis-bottom) + var(--stage-gutter));
      display: flex;
      flex-direction: column-reverse;
      width: max-content;
      max-width: calc(100% - var(--vis-left) - var(--vis-right) - 2 * var(--stage-gutter));
      background: var(--overlay-plate);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
    }
    .stage-dock[data-shown='false'] {
      visibility: hidden;
    }
    /* Static, so the popovers inside it are placed against the whole dock and open above the section row. */
    .stage-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1);
    }
    :global(.stage-tool) {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--control-height);
      margin: 0;
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-small);
      background: transparent;
      color: var(--overlay-ink);
      font-size: var(--text-stage);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    /* Pointer presses only: a key that opens a tool answers at once. */
    :global(.stage-tool:active:not(:focus-visible)) {
      transform: scale(var(--press-scale));
    }
    @media (pointer: coarse) {
      :global(.stage-tool) {
        min-height: 44px;
      }
    }
    :global(.stage-tool[hidden]) {
      display: none;
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.stage-tool:hover:not(:disabled)) {
        background: var(--overlay-plate-hover);
      }
      :global(.stage-tool[aria-expanded='true']:hover) {
        background: var(--overlay-track);
      }
    }
    :global(.stage-tool[aria-expanded='true']) {
      background: var(--overlay-track);
    }
    /* Drawn, like every disclosure chevron. It points up while its popover is open. */
    :global(.stage-tool-chevron) {
      flex: none;
      width: 6px;
      height: 6px;
      margin: -4px 0 0;
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      color: var(--overlay-ink-muted);
      transform: rotate(45deg);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    :global([aria-expanded='true'] > .stage-tool-chevron) {
      transform: translateY(4px) rotate(-135deg);
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      /* A chevron points the new way at once (a11y.css:13). */
      :global(.stage-tool-chevron) {
        transition: none;
      }
      :global(.stage-tool) {
        transition-property: background-color;
      }
      :global(.stage-tool:active) {
        transform: none;
      }
    }
    @media (forced-colors: active) {
      .stage-dock,
      :global(.popover.stage-popover) {
        border-color: CanvasText;
      }
      /* Fills are dropped here: the open tool needs a system-colour edge. */
      :global(.stage-tool[aria-expanded='true']) {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
