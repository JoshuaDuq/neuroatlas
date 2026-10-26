<!--
  The task panel's frame (viewer/ui/chrome/workspace.js:120-314, index.html:204-226, layout.css:13-122):
  one tablist of the five modes, the notice, the selection strip, and the two always-mounted panels,
  the list (`#navigator`) and the drill-in detail (`#inspector`) with its location bar. The tablist is
  one instance in both shells, placed by CSS (decision 0007). The lists and the detail's content are
  the features' own, given as snippets.

  APG Tabs with manual activation (decision 0004): arrows, Home and End move focus, Enter, Space or a
  click choose, because choosing Tracts can swap the whole scene. It is hand-written because U3's
  ModeTabs puts a stub tabpanel per mode in the page and reports no activation of the mode already
  chosen, which here means Back (deviations/h5-tabpanel-semantics.md).
-->
<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { regionGroup } from '../../lib/core/panels/navigator.ts';
  import {
    currentItem,
    detailAvailable,
    locationCrumbs,
    MODES,
    onScreen,
    revealSelected,
    stripVisible,
    viewAfterUpdate,
    type ContextSelection,
    type DetailState,
    type WorkspaceView,
  } from '../../lib/core/workspace.ts';
  import type { Explorer, Language, Notice as NoticeState } from '../../lib/types/index.ts';
  import { FOCUS_TARGETS, registerFocusTarget, requestFocus } from '../../lib/ui/focus.ts';
  import LocationBar from './LocationBar.svelte';
  import NoticeBar from './Notice.svelte';
  import SelectionStrip from './SelectionStrip.svelte';

  type Props = {
    lang: Language;
    /** The view's slice the panel follows: mode, selections, lesson, and the anatomy and its tract reference. */
    snapshot: DetailState;
    /** What the strip names (app.js:1574-1597). */
    selection: ContextSelection;
    /** Where in its mode the detail sits: a lesson's circuit (app.js:1598). */
    place: string | null;
    /** The tree's groups, to name the group of a region read from Anatomy. */
    groups: Parameters<typeof regionGroup>[0];
    notice: NoticeState | null;
    /** `rails` owns the selection strip; the sheet has its own in its grip (H6). */
    shell?: 'rails' | 'sheet';
    list?: Snippet;
    detail?: Snippet;
    /** The circuit stepper (X3), in the location bar. */
    stepper?: Snippet;
    /** The restore action (S3), in the location bar. */
    trailing?: Snippet;
    onMode: (mode: Explorer) => void;
    onClear: () => void;
    /** The reader stepped back to the list, as opposed to the list shown because the context went away. */
    onReturn: () => void;
    /** Opens the selected region's place in the tree, before its group crumb returns there. */
    onLocate: () => void;
    /** The layout changed with the view. */
    onViewChange: (view: WorkspaceView) => void;
    onNoticeAction: (action: NonNullable<NoticeState['action']>) => void;
    onDismiss: () => void;
  };

  let {
    lang,
    snapshot,
    selection,
    place,
    groups,
    notice,
    shell = 'rails',
    list,
    detail,
    stepper,
    trailing,
    onMode,
    onClear,
    onReturn,
    onLocate,
    onViewChange,
    onNoticeAction,
    onDismiss,
  }: Props = $props();

  const copy = $derived(t(lang, 'workspace'));
  const mode = $derived(snapshot.explorer);
  const reference = $derived(isIndependentTractReference(snapshot));
  const available = $derived(detailAvailable(snapshot));
  const selectedId = $derived(snapshot.selectedRegion?.id ?? null);
  const group = $derived(
    mode === 'anatomy' && selectedId ? regionGroup(groups, selectedId, lang) : null,
  );
  const crumbs = $derived(locationCrumbs({ mode, place, group, labels: copy.modes }));

  let view = $state<WorkspaceView>('list');
  const panelId = $derived(view === 'detail' ? 'inspector' : 'navigator');
  const tabId = (m: Explorer) => `workspace-tab-${m}`;

  let tabs = $state<Partial<Record<Explorer, HTMLButtonElement>>>({});
  let listPanel = $state<HTMLElement>();
  let detailPanel = $state<HTMLElement>();
  let backButton = $state<HTMLButtonElement | null>(null);
  let stripButton = $state<HTMLButtonElement | null>(null);

  // The tab in front is where focus goes when the control that had it is gone.
  $effect(() => registerFocusTarget(FOCUS_TARGETS.activeTab, () => tabs[mode] ?? null));

  // ---- list and detail ---------------------------------------------------------------------

  /** The control that opened the detail, which Back returns to. */
  let opener: HTMLElement | null = null;
  /** Where focus was when the view changed, read before the page changes under it. */
  let handoff: { active: HTMLElement | null; fromList: boolean; fromDetail: boolean } | null = null;
  let settled: WorkspaceView = 'list';

  let wasAvailable = false;
  let previousSelection: string | null = null;
  // A new region selection drills in; losing the last context returns to the list.
  $effect.pre(() => {
    const next = viewAfterUpdate({
      view: untrack(() => view),
      reference,
      wasAvailable,
      available,
      previousSelection,
      selection: selectedId,
    });
    wasAvailable = available;
    previousSelection = selectedId;
    untrack(() => move(next));
  });

  function move(next: WorkspaceView) {
    if (next === untrack(() => view)) return;
    const active = document.activeElement as HTMLElement | null;
    handoff ??= {
      active,
      fromList:
        active !== null &&
        (!!listPanel?.contains(active) || (shell === 'rails' && active === stripButton)),
      fromDetail: active !== null && !!detailPanel?.contains(active),
    };
    view = next;
  }

  // Once the page has changed: focus follows the view, and the layout is told.
  $effect(() => {
    const now = view;
    untrack(() => {
      const moved = handoff;
      handoff = null;
      if (now === settled) return;
      settled = now;
      if (!moved) throw new Error('The view changed without its focus handoff.');
      if (now === 'detail') {
        opener = moved.fromList ? moved.active : null;
        if (moved.fromList) backButton?.focus({ preventScroll: true });
      } else {
        // A detail hid the list while its selection changed, so the current item may be out of view.
        revealSelected();
        if (moved.fromDetail) restoreFocus();
        else opener = null;
      }
      onViewChange(now);
    });
  });

  /** Back in the list: the control that opened the detail, else the current item, else the tab in front. */
  function restoreFocus() {
    const target = onScreen(opener) ? opener : currentItem();
    opener = null;
    if (target) target.focus({ preventScroll: true });
    else requestFocus(FOCUS_TARGETS.activeTab);
  }

  function returnToList() {
    if (view !== 'detail') return;
    move('list');
    onReturn();
  }

  // Choosing the mode already in front steps back to its list, like Back.
  function choose(next: Explorer) {
    if (next === mode) {
      returnToList();
      return;
    }
    opener = null;
    move('list');
    onMode(next);
  }

  // From Anatomy the group crumb returns to the region's own row: its group open, the row in view
  // and focused. Elsewhere the place is the list itself, which comes back showing its current item.
  async function locate() {
    if (mode !== 'anatomy') {
      returnToList();
      return;
    }
    // The row is focused below, once, so the old opener must not take focus first.
    opener = null;
    onLocate();
    returnToList();
    await tick();
    const row = currentItem();
    if (!row) return;
    row.scrollIntoView({ block: 'center' });
    // A click need not have focused the crumb (Safari), and then the return moves no focus.
    if (document.activeElement !== row) row.focus({ preventScroll: true });
  }

  const showStrip = $derived(shell === 'rails' && stripVisible({ view, mode, selection }));

  // ---- tab keys ----------------------------------------------------------------------------

  function onTabKeydown(event: KeyboardEvent, index: number) {
    // Alt+Arrow is the browser's history, Ctrl/Cmd+Arrow the platform's: not ours to take.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const last = MODES.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    tabs[MODES[next]]?.focus();
  }

  /** Whether focus is inside the detail view, where Escape means Back. */
  export function focusInDetail(): boolean {
    return view === 'detail' && !!detailPanel?.contains(document.activeElement);
  }
  export function showList() {
    move('list');
  }
  export function showDetail() {
    if (!reference) move('detail');
  }
  /** Back to the list, as the Back button does. */
  export function back() {
    returnToList();
  }
</script>

<div class="workspace" data-view={view}>
  <div class="workspace-tabs" role="tablist" aria-label={copy.tabsAria}>
    {#each MODES as m, index (m)}
      <button
        type="button"
        role="tab"
        class="workspace-tab"
        id={tabId(m)}
        aria-selected={m === mode}
        aria-controls={m === mode ? panelId : undefined}
        tabindex={m === mode ? 0 : -1}
        bind:this={tabs[m]}
        onclick={() => choose(m)}
        onkeydown={(event) => onTabKeydown(event, index)}
      >
        {copy.modes[m]}
        <!-- A hidden bold copy holds the width, so choosing a mode moves nothing. -->
        <span class="tab-width" aria-hidden="true">{copy.modes[m]}</span>
      </button>
    {/each}
  </div>

  <NoticeBar {lang} {notice} onAction={onNoticeAction} {onDismiss} />

  <SelectionStrip
    {lang}
    visible={showStrip}
    {selection}
    bind:button={stripButton}
    onOpen={() => {
      if (available) move('detail');
    }}
    {onClear}
  />

  <div
    id="navigator"
    class="panel"
    role="tabpanel"
    aria-labelledby={tabId(mode)}
    hidden={view === 'detail'}
    bind:this={listPanel}
  >
    {@render list?.()}
  </div>
  <div
    id="inspector"
    class="panel"
    role="tabpanel"
    aria-labelledby={tabId(mode)}
    hidden={view !== 'detail'}
    bind:this={detailPanel}
  >
    <LocationBar
      {lang}
      {crumbs}
      onBack={returnToList}
      onGroup={locate}
      bind:back={backButton}
      {stepper}
      {trailing}
    />
    {@render detail?.()}
  </div>
</div>

<style>
  @layer features {
    /*
     * One task panel beside the anatomy; its parts are the panel's own flex items (layout.css:13-21).
     * :where keeps this at zero specificity, so H1a's phone rule (#workspace-panel { display: contents })
     * wins and the sheet keeps the panel's children as its grid items.
     */
    :global(:where(#workspace-panel)) {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      border-right: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .workspace {
      display: contents;
    }
    .panel {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    /*
     * Task navigation stays with the panel it changes, its labels spread across the content column
     * (French needs the room a fixed 16px gap would take). Each tab is its label: a 4px pad holds the
     * inset focus ring clear of the words, cancelled by margins so the underline keeps the label's width.
     * Enlarged text scrolls within the tab bar; focus brings each complete label into view.
     */
    .workspace-tabs {
      display: flex;
      align-self: stretch;
      flex: none;
      justify-content: space-between;
      gap: var(--space-2);
      min-width: 0;
      min-height: var(--tab-height);
      padding: 0 var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-navigation);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
    }
    .workspace-tab {
      position: relative;
      display: flex;
      flex: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: var(--tab-height);
      margin: 0 calc(-1 * var(--space-1)) -1px;
      padding: var(--space-2) var(--space-1);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-secondary);
      font: inherit;
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      text-align: center;
      white-space: nowrap;
      cursor: pointer;
    }
    /* The bold label's width is held, so choosing a mode moves nothing. */
    .tab-width {
      height: 0;
      overflow: hidden;
      visibility: hidden;
      font-weight: 600;
    }
    @media (hover: hover) and (pointer: fine) {
      .workspace-tab:hover:not([aria-selected='true']) {
        color: var(--text-primary);
      }
    }
    .workspace-tab:focus-visible {
      outline-offset: -2px;
    }
    .workspace-tab[aria-selected='true'] {
      color: var(--accent);
      font-weight: 600;
    }
    .workspace-tab[aria-selected='true']::before {
      content: '';
      position: absolute;
      inset: auto var(--space-1) 0;
      height: 2px;
      background: var(--accent);
    }
    @media (min-width: 801px) and (max-width: 1000px), (max-width: 360px) {
      .workspace-tab {
        font-size: var(--text-caption);
      }
    }
  }

  @layer a11y {
    /* Fills and shadows are dropped here, so the selected tab needs a system-colour edge (a11y.css:78). */
    @media (forced-colors: active) {
      .workspace-tab[aria-selected='true'] {
        border-bottom: 2px solid Highlight;
      }
    }
  }
</style>
