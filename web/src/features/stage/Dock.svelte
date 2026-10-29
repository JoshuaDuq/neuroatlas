<!--
  The stage dock: one plate of three worded tools, View, Section and Display, each opening a popover
  (index.html:433-490, stage.css:311-440). APG Toolbar (deviation g2-dock-toolbar): while three or more tools
  are shown the row is a labelled `role="toolbar"` with one Tab stop; ← → ↑ ↓ and Home/End move between the
  visible tools, Enter and Space open. Over the tract reference only View is left, and a lone button is
  not a toolbar.
  - U5's popover keeps its trigger and its content together, so the popovers' controls sit inside the toolbar
    element. Only the tools rove (`.stage-tool`); keys inside a popover are the popover's own.
  - The popovers are placed above the whole dock on its start edge, inside the visible stage (place-popover.ts).
  - Section's popover and the section row above the tools are G4's: they come in as snippets. The lesion's
    controls come last in the Section popover: a click on the brain places the lesion only while the reader has
    chosen so there and the popover is open, and while it does, a press on the stage keeps it open.
  - The View tool names the held preset, and keeps the width of the widest name so the other tools never move.
  - The dock root carries `data-own-keys` (decision 7): the page's single-key shortcuts skip its controls.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Engine, OrbitTurn } from '../../lib/engine/api.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import { VIEW_NAMES } from '../../lib/types/index.ts';
  import type { Language, SessionState, ViewName } from '../../lib/types/index.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';
  import { bindRoving } from '../../lib/ui/roving.ts';
  import type { DockCommands } from './dock-commands.ts';
  import DisplayPopover from './DisplayPopover.svelte';
  import { POPOVER_WIDTH, placePopover } from './place-popover.ts';
  import StagePopover from './StagePopover.svelte';
  import ViewPopover from './ViewPopover.svelte';

  interface Props {
    engine: Pick<Engine, 'on'> & { camera: Pick<Engine['camera'], 'viewHeld' | 'orbitBy'> };
    stage: StageLayout;
    media: Pick<Media, 'phone'>;
    lang: Language;
    status: SessionState['status'];
    /** The tract reference alone is shown: it has no sections or display settings. */
    tractReference: boolean;
    /** The session's named view, and the display settings the Display popover shows. */
    view: Pick<
      View,
      | 'view'
      | 'hemisphere'
      | 'cortexVisible'
      | 'cortexOpacity'
      | 'internalVisible'
      | 'spinalCordVisible'
    >;
    /** The subject publishes a spinal cord. */
    hasSpinalCord: boolean;
    commands: DockCommands;
    /** G4: the body of the Section popover, and the section row above the tools. */
    sectionPopover: Snippet<[{ close: () => void }]>;
    sectionBar?: Snippet;
    /** The lesion's controls under the Section popover's, with the choice of what a click on the brain does. */
    lesionControls: Snippet<
      [{ close: () => void; placing: boolean; setPlacing: (placing: boolean) => void }]
    >;
    onLesionPlacing: (placing: boolean) => void;
  }

  let {
    engine,
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
    lesionControls,
    onLesionPlacing,
  }: Props = $props();

  const uid = $props.id();
  const viewCaptionId = `view-caption-${uid}`;
  const sectionLabelId = `section-tool-${uid}`;
  const displayLabelId = `display-tool-${uid}`;

  const copy = $derived(t(lang, 'viewport'));
  const viewNames = $derived(t(lang, 'views'));
  // The dock is not drawn while the anatomy loads, failed or lost its context (stage.css:315).
  const shown = $derived(status === 'ready' || status === 'switching');
  // A phone sheet raised over the stage covers it.
  const covered = $derived(!shown || stage.sheetFull);
  const toolCount = $derived(tractReference ? 1 : 3);
  const toolbar = $derived(toolCount >= 3);

  // Whether the camera still sits on the named view; the engine says when it stops (viewport-chrome.js:560).
  let held = $state(false);
  $effect(() => {
    held = engine.camera.viewHeld;
    return engine.on('viewHeld', (event) => (held = event.held));
  });

  const heldName = $derived((held ? view.view : '') as ViewName | '');

  let viewOpen = $state(false);
  let sectionOpen = $state(false);
  let displayOpen = $state(false);
  const anyOpen = $derived(viewOpen || sectionOpen || displayOpen);
  // A click places the lesion only while the reader chose so, and only until the Section popover closes.
  let placing = $state(false);
  $effect(() => {
    if (!sectionOpen) placing = false;
  });
  $effect(() => onLesionPlacing(sectionOpen && placing && !tractReference));

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

  function focusFirstTool() {
    tools.querySelector<HTMLElement>('.stage-tool:not([hidden])')?.focus({ preventScroll: true });
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

  function turn(step: OrbitTurn) {
    stage.retireHint();
    engine.camera.orbitBy(step);
  }

  function chooseView(name: ViewName) {
    stage.retireHint();
    commands.chooseView(name);
  }
</script>

<div bind:this={dock} class="stage-dock" data-shown={shown} {...{ [OWN_KEYS_ATTRIBUTE]: '' }}>
  <div
    bind:this={tools}
    class="stage-toolbar"
    role={toolbar ? 'toolbar' : undefined}
    aria-label={toolbar ? copy.dockLabel : undefined}
    {@attach rove}
  >
    <StagePopover
      bind:open={viewOpen}
      hidden={false}
      {covered}
      class="view-tool"
      ariaLabel={heldName ? copy.viewToolAria(viewNames[heldName]) : copy.viewAria}
      style={popoverStyle}
      dialogLabelledby={viewCaptionId}
      rescueFocus={focusFirstTool}
    >
      {#snippet name()}
        <!-- Every name in one grid cell: the widest sets the tool's width, and only the current one shows. -->
        <span class="view-tool-label">
          {#each ['', ...VIEW_NAMES] as preset (preset)}
            <span data-current={preset === heldName ? '' : undefined}>
              {preset ? viewNames[preset as ViewName] : copy.viewTool}
            </span>
          {/each}
        </span>
      {/snippet}
      {#snippet body({ close })}
        <ViewPopover
          {lang}
          viewName={view.view}
          {held}
          captionId={viewCaptionId}
          {close}
          onView={chooseView}
          onReset={commands.reset}
          onTurn={turn}
        />
      {/snippet}
    </StagePopover>
    <StagePopover
      bind:open={sectionOpen}
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={sectionLabelId}
      rescueFocus={focusFirstTool}
      holdsOpen={(node) => placing && onStage(node)}
    >
      {#snippet name()}<span id={sectionLabelId}>{copy.sectionTool}</span>{/snippet}
      {#snippet body({ close })}
        <!-- On a phone the cut's controls fold away while placing, so the popover leaves the brain to click. -->
        <div hidden={placing && media.phone}>{@render sectionPopover({ close })}</div>
        {@render lesionControls({ close, placing, setPlacing: (next) => (placing = next) })}
      {/snippet}
    </StagePopover>
    <StagePopover
      bind:open={displayOpen}
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={displayLabelId}
      rescueFocus={focusFirstTool}
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
    /*
     * The chevron follows the current name; the hidden names, padded by the chevron's room, span the row
     * behind them, so the tool keeps the widest localized preset's width and never moves the others.
     */
    :global(.stage-tool.view-tool) {
      display: inline-grid;
      grid-template-columns: minmax(0, auto) auto 1fr;
      column-gap: 0;
    }
    .view-tool-label {
      display: contents;
    }
    .view-tool-label > span {
      grid-area: 1 / 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
    }
    .view-tool-label > span:not([data-current]) {
      grid-column: 1 / -1;
      padding-right: calc(var(--space-2) + 6px);
      visibility: hidden;
    }
    :global(.stage-tool.view-tool > .stage-tool-chevron) {
      grid-area: 1 / 2;
      margin-left: var(--space-2);
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
