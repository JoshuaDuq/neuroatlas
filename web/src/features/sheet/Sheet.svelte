<!--
  The phone sheet (viewer/ui/chrome/sheet.js, index.html:187-205, styles/phone.css:62-229, 288-363): the
  task panel becomes a sheet over the full-bleed stage that rests at peek, half or full. It reports how much
  of the canvas it covers rather than resizing it, because a resize would reallocate the composer target on
  every frame of a drag, and an inset costs a projection shift. The workspace owns the mode tabs and the list
  and detail switch; the sheet owns how much of the panel is on screen, and the grip, which names the
  selection beside the handle even at peek.

  A non-modal region (decision 0006): no dialog role, no focus trap, the stage stays operable. The grip's
  handle is a button that steps peek, half, full, peek, which is the WCAG 2.5.7 alternative to the drag.
  Nothing moves in the DOM (decision 0007): the grip, then the workspace's one tablist, notice and panels,
  which `#workspace-panel { display: contents }` makes this sheet's own flex items (a grid sideways).

  The box's size is written straight to its style, never through $state or a custom property: a drag is
  one write per pointer move, and a property every descendant inherits restyled the whole panel.
-->
<script lang="ts">
  import { onMount, tick, untrack, type Snippet } from 'svelte';
  import {
    SIDEWAYS_DETENTS,
    UPRIGHT_DETENTS,
    clampDrag,
    detentHeights,
    releaseVelocity,
    settleDetent,
    stepDetent,
    type Detent,
    type DetentHeights,
    type SpanSample,
  } from '../../lib/core/detents.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    selectionName,
    type ContextSelection,
    type WorkspaceView,
  } from '../../lib/core/workspace.ts';
  import type { ChromeInsets } from '../../lib/engine/api.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
  import IconButton, { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';

  type Props = {
    lang: Language;
    media: Pick<Media, 'phone' | 'sideways'>;
    /** The stage's layout: a full sheet covers its dock, so the framing leaves no room for either. */
    stage: { sheetFull: boolean };
    /** The workspace's view (`Workspace`'s `onViewChange`): a detail names itself, so the grip stops naming it. */
    view: WorkspaceView;
    /** What the workspace's strip names; the grip names it too, so the name is on screen at peek. */
    selection: ContextSelection;
    /** The stage's host: a side sheet starts at its top, and the upright rests are fractions of its height. */
    viewport: () => HTMLElement;
    /**
     * How much of the canvas the sheet covers, and the safe areas on the stage's other edges: the
     * target span, not the box, since framing must fit where the sheet will land. `settle` says the
     * sheet is moving there on its own curve rather than under the finger. All zero off the phone.
     */
    onInsets: (insets: ChromeInsets, motion: { settle: boolean }) => void;
    /** The sheet came to rest on a detent: a held view reframes to the room it has. */
    onDetent: (detent: Detent) => void;
    /** The strip was activated: show the selection's detail. */
    onSelection: () => void;
    onClear: () => void;
    /** The panel `<aside>` with the workspace in it. */
    children: Snippet;
  };

  let {
    lang,
    media,
    stage,
    view,
    selection,
    viewport,
    onInsets,
    onDetent,
    onSelection,
    onClear,
    children,
  }: Props = $props();

  /** Movement that turns a press on the grip into a drag rather than a tap. */
  const DRAG_THRESHOLD_PX = 8;
  /** The last few spans of a drag, from which the throw at release is read. */
  const SAMPLES_KEPT = 8;
  /** What a press starts a drag on: the grip's own row, the tabs and the notice (legacy's `.sheet-grip`). */
  const GRIP_SELECTOR = '.sheet-grip-row, [role="tablist"], .notice';

  interface Press {
    id: number;
    /** The pointer's coordinate on the sheet's axis when it went down. */
    origin: number;
    /** The sheet's span then. */
    span: number;
    /** The rests do not move during a drag, so they are measured once. */
    heights: DetentHeights;
    dragging: boolean;
    samples: SpanSample[];
  }

  let root: HTMLElement;
  let gripRow: HTMLElement;
  let handle: HTMLButtonElement;
  let probe: HTMLElement;

  // The one reactive piece of state: the handle's name follows it. Everything else is written to the DOM.
  let detent = $state<Detent>('peek');
  // The span last written, so a re-measured peek that has not moved writes nothing.
  let applied: number | null = null;
  let press: Press | null = null;
  let safe = { right: 0, bottom: 0, left: 0 };

  const copy = $derived(t(lang, 'sheet'));
  const label = $derived(selection.label ?? '');
  const stripName = $derived(selectionName(selection));

  /** The workspace the sheet holds, found in its own subtree (the tablist and the panel in front). */
  function workspace() {
    const tabs = root.querySelector<HTMLElement>('[role="tablist"]');
    const panel = root.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');
    if (!tabs || !panel) throw new Error('The sheet holds no workspace.');
    return { tabs, panel };
  }

  /** The device's safe areas (notch, home indicator) are only readable from a box `env()` sizes. */
  function measureSafe() {
    const style = getComputedStyle(probe);
    safe = {
      right: parseFloat(style.paddingRight),
      bottom: parseFloat(style.paddingBottom),
      left: parseFloat(style.paddingLeft),
    };
  }

  /*
   * Peek hugs the grip in both orientations, so a drag from rest starts where the sheet is. Upright it
   * ends where the grip does, which is where the panel in front begins, with the home indicator's band it
   * pads only at peek; sideways it is as wide as the one row of tabs, from the sheet's safe-area edge.
   */
  function peekSpan(sideways: boolean): number {
    const { tabs, panel } = workspace();
    const box = root.getBoundingClientRect();
    if (!sideways) return Math.round(panel.getBoundingClientRect().top - box.top + safe.bottom);
    const last = tabs.lastElementChild!.getBoundingClientRect();
    const row = last.right + parseFloat(getComputedStyle(tabs).paddingRight) - box.left;
    return Math.ceil(
      Math.max(
        SIDEWAYS_DETENTS.peek + safe.left,
        row + parseFloat(getComputedStyle(root).borderRightWidth),
      ),
    );
  }

  function heights(): DetentHeights {
    const sideways = media.sideways;
    const peek = peekSpan(sideways);
    return sideways
      ? detentHeights(innerWidth, { ...SIDEWAYS_DETENTS, peek })
      : detentHeights(viewport().getBoundingClientRect().height, { ...UPRIGHT_DETENTS, peek });
  }

  function report(span: number) {
    const settle = !press?.dragging;
    if (!media.phone) {
      onInsets({ top: 0, right: 0, bottom: 0, left: 0 }, { settle });
      return;
    }
    onInsets(
      media.sideways
        ? { top: 0, right: safe.right, bottom: safe.bottom, left: span }
        : { top: 0, right: safe.right, bottom: span, left: safe.left },
      { settle },
    );
  }

  function applySpan(pixels: number) {
    applied = Math.round(pixels);
    const span = `${applied}px`;
    if (media.sideways) {
      // The viewport does not move during a drag; reading it there would force a layout.
      if (!press?.dragging)
        root.style.top = `${Math.round(viewport().getBoundingClientRect().top)}px`;
      root.style.width = span;
      root.style.removeProperty('height');
    } else {
      root.style.height = span;
      root.style.removeProperty('width');
      root.style.removeProperty('top');
    }
    report(applied);
  }

  /** Upright peek is the grip alone; the side rail at peek is already as wide as its tabs, so it keeps the panel. */
  const panelHiddenAt = (rest: Detent) => rest === 'peek' && !media.sideways;

  /** `quick` writes `data-instant`: no glide for the sheet or the stage chrome that follows it. */
  function setDetent(next: Detent, { notify = true, quick = false, say = false } = {}) {
    // A drag that springs back to where it began has changed nothing to announce.
    const changed = next !== detent;
    // A panel that is about to hide takes its focus with it, so the handle takes it first (deviations/h6-peek-focus.md).
    const active = document.activeElement;
    if (
      panelHiddenAt(next) &&
      active &&
      root.contains(active) &&
      active.closest('[role="tabpanel"]')
    ) {
      handle.focus({ preventScroll: true });
    }
    detent = next;
    root.dataset.detent = next;
    root.dataset.panel = panelHiddenAt(next) ? 'hidden' : 'shown';
    root.toggleAttribute('data-instant', quick);
    // Written before the span is reported: the framing that follows reads it as it runs.
    stage.sheetFull = next === 'full';
    applySpan(heights()[next]);
    if (notify) onDetent(next);
    if (say && changed) announce(copy.detent[next]);
  }

  /** Content chosen with the sheet at rest should be seen; a raised sheet stays where it was put. */
  export function raise({ instant = false } = {}) {
    if (media.phone && panelHiddenAt(detent)) setDetent('half', { quick: instant });
  }

  // ---- dragging ----------------------------------------------------------------------------

  function cancelPress() {
    press = null;
    root.dataset.dragging = 'false';
  }

  function onPointerDown(event: PointerEvent) {
    // A second finger mid-drag would make the sheet jump to it.
    if (!media.phone || press || !event.isPrimary || event.button !== 0) return;
    if (!(event.target as Element).closest(GRIP_SELECTOR)) return;
    const sideways = media.sideways;
    const box = root.getBoundingClientRect();
    const span = sideways ? box.width : box.height;
    press = {
      id: event.pointerId,
      origin: sideways ? event.clientX : event.clientY,
      span,
      heights: heights(),
      dragging: false,
      samples: [{ at: event.timeStamp, span }],
    };
  }

  function onPointerMove(event: PointerEvent) {
    if (!press || event.pointerId !== press.id) return;
    const sideways = media.sideways;
    const point = sideways ? event.clientX : event.clientY;
    // Sideways the sheet grows rightward, so a rightward drag grows it; upright it grows upward,
    // so the sign flips.
    const travel = sideways ? point - press.origin : press.origin - point;
    if (!press.dragging) {
      if (Math.abs(travel) < DRAG_THRESHOLD_PX) return;
      press.dragging = true;
      root.dataset.dragging = 'true';
    }
    const span = clampDrag(press.span + travel, press.heights);
    press.samples.push({ at: event.timeStamp, span });
    if (press.samples.length > SAMPLES_KEPT) press.samples.shift();
    applySpan(span);
    if (event.cancelable) event.preventDefault();
  }

  function onPointerUp(event: PointerEvent) {
    if (!press || event.pointerId !== press.id) return;
    const { dragging, samples } = press;
    const span = samples[samples.length - 1]!.span;
    const velocity = releaseVelocity(samples, event.timeStamp);
    cancelPress();
    if (!dragging) return;
    // The press ends on a button; without this the release would also switch tabs or step the handle.
    const swallow = (click: Event) => {
      click.stopPropagation();
      click.preventDefault();
    };
    const sheet = root;
    sheet.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => sheet.removeEventListener('click', swallow, { capture: true }), 0);
    setDetent(settleDetent(detent, span, heights(), velocity), { say: true });
  }

  // A release outside the app may never reach the window after it loses focus.
  function onBlur() {
    if (!press) return;
    cancelPress();
    if (media.phone) setDetent(detent);
  }

  function onPointerCancel(event: PointerEvent) {
    if (press?.id === event.pointerId) onBlur();
  }

  // ---- the grip's buttons ------------------------------------------------------------------

  // Three rests are not expanded or not, so the handle is named for what a press does.
  function onHandle(event: MouseEvent) {
    setDetent(detent === 'full' ? 'peek' : stepDetent(detent, 1), {
      quick: isKeyboardActivation(event),
      say: true,
    });
  }

  async function openSelection(event: MouseEvent) {
    const focused = event.currentTarget === document.activeElement;
    raise({ instant: isKeyboardActivation(event) });
    onSelection();
    if (!focused) return;
    // The raised detail hides the grip's title, so the control that had focus would be gone.
    await tick();
    root.querySelector<HTMLElement>('.detail-back')!.focus({ preventScroll: true });
  }

  // The name and its clear vanish with the selection; the tab in front is always on screen.
  async function clear() {
    onClear();
    await tick();
    requestFocus(FOCUS_TARGETS.activeTab);
  }

  function onTabClick(event: MouseEvent) {
    if ((event.target as Element).closest('[role="tab"]')) {
      raise({ instant: isKeyboardActivation(event) });
    }
  }

  // ---- shell ------------------------------------------------------------------------------

  /** Hand the panel back to the grid. */
  function teardown() {
    root.removeAttribute('data-instant');
    root.style.removeProperty('height');
    root.style.removeProperty('width');
    root.style.removeProperty('top');
    delete root.dataset.detent;
    delete root.dataset.panel;
    delete root.dataset.dragging;
    applied = null;
    stage.sheetFull = false;
    report(0);
  }

  function setup() {
    const active = document.activeElement;
    const panelFocused = !!active && root.contains(active) && !!active.closest('[role="tabpanel"]');
    root.dataset.dragging = 'false';
    // Peek hides the panels, so a control already in use keeps its panel exposed on the new shell.
    setDetent(panelFocused && panelHiddenAt(detent) ? 'half' : detent, {
      notify: false,
      quick: panelFocused,
    });
  }

  // The phone shell, and which side the sheet is on, change together or apart. A press measured in the
  // old shell or orientation cannot continue in the new one.
  $effect(() => {
    const phone = media.phone;
    void media.sideways;
    untrack(() => {
      cancelPress();
      measureSafe();
      if (phone) setup();
      else teardown();
    });
  });

  function onResize() {
    cancelPress();
    measureSafe();
    if (media.phone) applySpan(heights()[detent]);
  }

  onMount(() => {
    // A rotation can move the safe areas after its resize event; the probe's own box says when. Observing
    // reports its box once, after layout, which is the first report made from a laid-out grip.
    const safeObserver = new ResizeObserver(onResize);
    safeObserver.observe(probe, { box: 'border-box' });

    // The grip and the tabs are sized by their text, which arrives after setup and changes with the
    // language, the selection and the notice; a peek that follows them glides like any other change of rest.
    const topObserver = new ResizeObserver(() => {
      if (!media.phone || detent !== 'peek' || press?.dragging) return;
      const peek = heights().peek;
      if (peek !== applied) applySpan(peek);
    });
    const watch = () => {
      topObserver.disconnect();
      const { tabs } = workspace();
      for (const part of [gripRow, tabs, ...tabs.children, ...root.querySelectorAll('.notice')]) {
        topObserver.observe(part);
      }
    };
    watch();
    // A notice comes and goes in the grip.
    const mutations = new MutationObserver(watch);
    mutations.observe(workspace().tabs.parentElement!, { childList: true });

    return () => {
      safeObserver.disconnect();
      topObserver.disconnect();
      mutations.disconnect();
      stage.sheetFull = false;
    };
  });
</script>

<!--
  The press starts on the grip but the finger leaves it at once, so the moves are watched on the window.
  Capturing the pointer on the grip would keep them here, but it also retargets the release, and the tap
  that chooses a tab would then land on the grip instead of the tab.
-->
<svelte:window
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerCancel}
  onblur={onBlur}
  onresize={onResize}
/>

<div
  id="sheet"
  {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
  bind:this={root}
  data-view={view}
  onpointerdown={onPointerDown}
  onclick={onTabClick}
>
  <div class="sheet-grip-row" bind:this={gripRow} data-selection={Boolean(selection.label)}>
    <button
      type="button"
      class="sheet-handle"
      aria-controls="workspace-panel"
      aria-label={detent === 'full' ? copy.collapse : copy.expand}
      bind:this={handle}
      onclick={onHandle}
    >
      <span class="sheet-handle-bar"></span>
    </button>
    {#if selection.label}
      <button type="button" class="sheet-selection" aria-label={stripName} onclick={openSelection}>
        <span class="sheet-selection-text">
          <span class="sheet-selection-name">{label}</span>
          <span class="sheet-selection-side">{selection.side ?? ''}</span>
        </span>
        {@render iconGraphic('chevron-right')}
      </button>
      {#if selection.clearable}
        <IconButton
          class="sheet-selection-clear"
          icon="close"
          label={t(lang, 'inspector').clearSelection}
          onclick={clear}
        />
      {/if}
    {/if}
    <p class="sheet-disclaimer">{t(lang, 'footer').statementAlone}</p>
  </div>

  {@render children()}

  <div class="sheet-probe" bind:this={probe} aria-hidden="true"></div>
</div>

<style>
  @layer features {
    /* Off the phone the panel belongs to the page grid, and the sheet is not a box of its own. */
    #sheet {
      display: contents;
    }
    /* Only the phone has a grip; there is no state to wait for when the window changes shape. */
    .sheet-grip-row {
      display: none;
    }

    /* Measured, never seen: env() can only be read from the box it sizes. */
    .sheet-probe {
      position: fixed;
      visibility: hidden;
      pointer-events: none;
      padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }

    /* The phone shell is the twin of PHONE_QUERY (phone.css:15). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      #sheet {
        display: flex;
        flex-direction: column;
        position: fixed;
        z-index: 30;
        left: 0;
        right: 0;
        bottom: 0;
        height: 132px;
        /* Everything in the sheet clears the screen's own edges; only its ground runs to them. */
        padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
        background: var(--surface-base);
        border-top: 1px solid var(--border-subtle);
        border-radius: var(--radius-panel) var(--radius-panel) 0 0;
        overscroll-behavior: contain;
      }
      /* Only a settled sheet animates, peek included; a dragged one tracks the finger. */
      #sheet[data-dragging='false'] {
        transition: height var(--camera-transition) var(--ease-sheet);
      }
      /* What stands on the sheet's edge moves with it: on its curve when it settles, with the finger while dragged. */
      :global(#app:has(#sheet[data-dragging='false']) :is(.stage-dock, .orientation, .scale-bar)) {
        transition:
          inset var(--camera-transition) var(--ease-sheet),
          width var(--camera-transition) var(--ease-sheet);
      }
      :global(#app:has(#sheet[data-instant]) :is(.stage-dock, .orientation, .scale-bar)) {
        transition: none;
      }

      /* Peek is the grip: handle, selection, tabs, disclaimer, and the home indicator's band. */
      #sheet[data-detent='peek'] {
        padding-bottom: env(safe-area-inset-bottom);
      }
      #sheet[data-panel='hidden'] :global(#navigator),
      #sheet[data-panel='hidden'] :global(#inspector) {
        visibility: hidden;
        pointer-events: none;
        flex: 0 0 0;
        min-height: 0;
        padding: 0;
        overflow: hidden;
      }
      /* Nothing follows the tabs at rest, so their rule would only underline the screen edge. */
      #sheet[data-panel='hidden'] :global(.workspace-tabs) {
        border-bottom-color: transparent;
      }

      /*
       * The grip is the drag surface; the panel below it scrolls instead. Its parts are the sheet's own
       * flex items: the row of the handle, the strip and the statement, then the workspace's tabs and notice.
       */
      #sheet .sheet-grip-row,
      #sheet :global([role='tablist']),
      #sheet :global(.notice) {
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }

      /*
       * The grip: the handle's bar centred on a line of its own at the top, then the selected name and the
       * "not clinical anatomy" statement, the clear command beside them. The handle is the whole grip, so
       * taps on the words reach it; later children paint over it.
       */
      .sheet-grip-row {
        /* The handle's own line, which the name beside it leaves free: WCAG 2.5.8 asks 24px, legacy gave 20 (deviations/h6-handle-target.md). */
        --handle-row: 24px;
        position: relative;
        flex: none;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 44px;
        grid-template-rows: var(--handle-row) auto;
      }
      .sheet-grip-row[data-selection='true'] {
        grid-template-rows: var(--handle-row) var(--lh-ui) auto var(--space-2);
      }
      .sheet-handle {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        width: 100%;
        height: 100%;
        /* The bar centred in the top line. */
        padding: calc((var(--handle-row) - 4px) / 2) 0 0;
        border: 0;
        border-radius: var(--radius-panel) var(--radius-panel) 0 0;
        background: none;
        cursor: pointer;
      }
      .sheet-handle-bar {
        width: 36px;
        height: 4px;
        border-radius: var(--radius-mark);
        background: var(--border-control);
      }

      .sheet-selection {
        position: relative;
        grid-column: 1;
        grid-row: 2 / 5;
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        min-width: 0;
        height: auto;
        padding: 0 var(--space-2) 0 var(--panel-inset);
        border: 0;
        border-radius: 0;
        background: none;
        text-align: left;
        cursor: pointer;
      }
      .sheet-handle:focus-visible,
      .sheet-selection:focus-visible,
      .sheet-grip-row :global(.sheet-selection-clear:focus-visible) {
        outline-offset: -2px;
      }
      /* Side and chevron follow the name on its line, so nothing floats in a column beside the clear. */
      .sheet-selection-text {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        min-width: 0;
      }
      .sheet-selection-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-title);
        font-weight: 600;
        line-height: var(--lh-ui);
      }
      .sheet-selection-side {
        flex: none;
        color: var(--text-secondary);
        font-size: var(--text-caption);
        font-weight: 400;
        line-height: var(--lh-ui);
      }
      .sheet-selection :global(svg) {
        flex: none;
        align-self: flex-start;
        margin-top: 7px;
        color: var(--text-secondary);
      }
      /* In the detail view the name heads what the panel shows; it no longer leads anywhere. */
      #sheet[data-view='detail'] .sheet-selection :global(svg) {
        display: none;
      }
      .sheet-grip-row :global(.sheet-selection-clear) {
        position: relative;
        grid-column: 2;
        grid-row: 2 / 5;
        color: var(--text-tertiary);
      }

      /* A safety statement, so never in the overflow menu with the settings; it wraps rather than truncates. */
      .sheet-disclaimer {
        position: relative;
        grid-column: 1;
        grid-row: 2;
        margin: 0;
        padding: 0 var(--space-2) var(--space-2) var(--panel-inset);
        font-size: var(--text-caption);
        line-height: var(--lh-caption);
        color: var(--text-secondary);
        pointer-events: none;
      }
      .sheet-grip-row[data-selection='true'] .sheet-disclaimer {
        grid-column: 1;
        grid-row: 3;
        align-self: start;
        padding: 0 var(--space-2) 0 var(--panel-inset);
        text-align: left;
      }

      /* The detail owns its complete title; the grip keeps the statement, and the clear beside it. */
      #sheet[data-view='detail']:not([data-panel='hidden']) .sheet-grip-row {
        grid-template-rows: var(--handle-row) auto;
      }
      #sheet[data-view='detail']:not([data-panel='hidden']) .sheet-selection {
        display: none;
      }
      /* Centred on the statement's line; its 44px reaches past that line without making it taller. */
      #sheet[data-view='detail']:not([data-panel='hidden'])
        .sheet-grip-row
        :global(.sheet-selection-clear) {
        grid-row: 2;
        align-self: start;
        margin-block: calc((var(--lh-caption) - var(--control-height)) / 2);
      }
      #sheet[data-view='detail']:not([data-panel='hidden']) .sheet-disclaimer {
        grid-row: 2;
        padding: 0 var(--space-2) var(--space-2) var(--panel-inset);
      }

      /* The labels run from the sheet's column to its right edge, so the first stands under the words above it. */
      #sheet :global(.workspace-tabs) {
        justify-content: space-between;
        gap: 0;
        padding-inline: calc(var(--panel-inset) - var(--space-1));
        background: var(--surface-base);
      }
      /* Each label is its tab, as legacy's sheet tabs were: no pull-in margin, the underline as wide as the label, long labels wrap. */
      #sheet :global(.workspace-tab) {
        flex: 0 1 auto;
        min-width: 0;
        margin-inline: 0;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      #sheet :global(.workspace-tab[aria-selected='true'])::before {
        inset: auto 0 0;
      }
      /* In the grip the notice is on screen at every rest; its ground, not a rule, sets it off. */
      #sheet :global(.notice) {
        border-bottom: 0;
      }

      /* The panels inside the sheet scroll under the grip, clear of the home indicator. */
      #sheet :global(#navigator),
      #sheet :global(#inspector) {
        flex: 1;
        min-height: 0;
        border: 0;
        border-radius: 0;
        background: none;
        padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));
      }
    }

    /*
     * Landscape: a sheet at the foot of a 375px-tall screen would leave the anatomy a strip, so it moves
     * to the side. The shell is the same sheet with the same rests, measured across instead of up. The
     * grip's parts and the workspace's become one grid: the name above the statement, the clear and the
     * handle in columns, then the one row of tabs, the notice and the panel.
     */
    @media (max-height: 480px) and (orientation: landscape) {
      #sheet {
        /* Set from the viewport's own offset: a side sheet anchored at zero would cover the wordmark and the atlas switch. */
        top: 0;
        right: auto;
        bottom: 0;
        height: auto;
        width: 56px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto 44px;
        grid-template-rows: auto auto auto auto minmax(0, 1fr);
        /* Its right edge is the stage's, not the screen's. */
        padding-right: 0;
        border-top: 0;
        border-right: 1px solid var(--border-subtle);
        border-radius: 0 var(--radius-panel) var(--radius-panel) 0;
      }
      #sheet[data-dragging='false'] {
        transition: width var(--camera-transition) var(--ease-sheet);
      }
      .sheet-grip-row {
        display: contents;
      }
      /* The name above the statement, as upright. */
      .sheet-selection {
        grid-column: 1;
        grid-row: 1;
        align-items: center;
        /* A finger's target, as every control of the phone shell: the name is one line in a 44px row. */
        min-height: var(--control-height);
        padding: var(--space-1) var(--space-2) var(--space-1) var(--space-4);
      }
      .sheet-selection :global(svg) {
        align-self: center;
        margin-top: 0;
      }
      /* Width is what the rail lacks, so a long name takes a second line, its side letter after the last word. */
      .sheet-selection-text {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
      }
      .sheet-selection-name {
        white-space: normal;
      }
      .sheet-selection-side {
        margin-left: var(--space-2);
      }
      .sheet-grip-row :global(.sheet-selection-clear),
      #sheet[data-view='detail']:not([data-panel='hidden'])
        .sheet-grip-row
        :global(.sheet-selection-clear) {
        grid-column: 2;
        grid-row: 1 / 3;
        align-self: center;
        margin-block: 0;
      }
      #sheet .sheet-disclaimer {
        grid-column: 1 / 3;
        grid-row: 2;
        align-self: end;
        padding: 0 var(--space-2) var(--space-2) var(--space-4);
      }
      /* Alone, the statement is the handle's 44px line; so it is beside an open detail, which names itself. */
      #sheet .sheet-grip-row:not([data-selection='true']) .sheet-disclaimer,
      #sheet[data-view='detail']:not([data-panel='hidden']) .sheet-disclaimer {
        grid-row: 1 / 3;
        align-self: center;
        padding-block: 14px;
      }
      #sheet .sheet-handle {
        position: static;
        grid-column: 3;
        grid-row: 1 / 3;
        align-items: center;
        height: auto;
        padding: 0;
        border-radius: 0;
      }
      .sheet-handle-bar {
        width: 4px;
        height: 36px;
      }
      /*
       * Measure the labels at their natural width so peek never squeezes words into fragments. The first
       * label stands on the column above it, and the rule beneath runs to the sheet's edge once it is wider.
       */
      #sheet :global(.workspace-tabs) {
        grid-column: 1 / -1;
        grid-row: 3;
        width: max-content;
        min-width: 100%;
        flex-wrap: nowrap;
        justify-content: flex-start;
        padding-inline: calc(var(--panel-inset) - var(--space-3));
      }
      #sheet :global(.workspace-tab) {
        flex: 0 0 auto;
        padding-inline: var(--space-3);
        white-space: nowrap;
        overflow-wrap: normal;
      }
      /* The underline overhangs its label by 4px, as upright. */
      #sheet :global(.workspace-tab[aria-selected='true'])::before {
        inset: auto calc(var(--space-3) - var(--space-1)) 0;
      }
      #sheet :global(.notice) {
        grid-column: 1 / -1;
        grid-row: 4;
      }
      #sheet :global(#navigator),
      #sheet :global(#inspector) {
        grid-column: 1 / -1;
        grid-row: 5;
      }
    }
  }

  @layer a11y {
    /* The sheet jumps to its rest; the stage chrome beside it keeps its own opacity-only rule (G1). */
    @media (prefers-reduced-motion: reduce) {
      #sheet {
        transition-property: opacity;
      }
    }
    /* A drawn bar is a background, which forced colours would replace with the page's own: the handle is its only cue. */
    @media (forced-colors: active) {
      .sheet-handle-bar {
        background: ButtonText;
      }
    }
  }
</style>
