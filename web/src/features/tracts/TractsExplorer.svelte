<!--
  The Tracts panel (native-ui.js, DOM half): a search that filters the tract list, one key per
  side or segment, the display settings, the notes on the data and the MRI command. The engine
  half is `engine.tracts` (F2 contract); everything below the search is disabled while the
  reference dataset or a bundle downloads.

  Status and failure are two elements: a polite status that is never rewritten with the same
  words, and an alert that is mounted when a load fails (deviations/t1-status-and-alert.md).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { reloadWithoutStoredModels } from '../../lib/core/assets/published-assets.ts';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { diffusionErrorCode } from '../../lib/core/diffusion/validation.ts';
  import { createBusyRunner } from '../../lib/core/async/latest.ts';
  import { decimal, grouped, percent, withUnit } from '../../lib/core/format.ts';
  import { diffusionError } from '../../lib/core/i18n/diffusion.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    LENGTHS_CSV_FILENAME,
    MINIMUM_LENGTH,
    buildLengthsCsv,
    foldForSearch,
    settingsReadout,
    tractRows,
    tractSearchText,
  } from '../../lib/core/tracts.ts';
  import type { Engine, TractBundle as LoadedBundle } from '../../lib/engine/api.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { ASSET_BASE } from '../../../build/site.ts';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import StatusLine from '../../lib/ui/StatusLine.svelte';
  import { announce, createDebouncedAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import { tractsCopy } from './copy.ts';
  import { downloadText } from './download.ts';
  import TractRow from './TractRow.svelte';

  let {
    engine,
    anatomy,
    lang,
    active,
    cortexOpacity,
    onCortexOpacity,
    overlay = $bindable(false),
    minimum = $bindable(MINIMUM_LENGTH.min),
    onOpenMri,
  }: {
    engine: Pick<Engine, 'tracts' | 'on'>;
    /** The anatomy on screen; its own tracts overlay it, any other shows CDMD's as a reference. */
    anatomy: string;
    lang: Language;
    /** The Tracts tab is the one open. The first opening loads the reference dataset. */
    active: boolean;
    /** The global cortex opacity, which the opacity slider sets on the tracts' own anatomy. */
    cortexOpacity: number;
    onCortexOpacity: (value: number) => void;
    /** Draw the streamlines over the anatomy's own brain (the tracts' own anatomy only). */
    overlay?: boolean;
    /** The length filter in millimetres, as last applied. */
    minimum?: number;
    onOpenMri: () => void;
  } = $props();

  const tracts = $derived(engine.tracts);
  const catalog = $derived(tractCatalog(anatomy));
  const matching = $derived(anatomy === catalog.anatomy);
  const rows = $derived(tractRows(catalog.bundles));
  const text = $derived(t(lang, 'diffusion'));
  const dataset = $derived(catalog.text[lang]);
  const added = $derived(tractsCopy(lang));

  /** The engine is not reactive: its events, and every call made here, re-read what the panel shows. */
  let ready = $state(false);
  let snapshot = $state.raw<LoadedBundle[]>([]);
  const refresh = () => {
    ready = tracts.ready;
    snapshot = tracts.snapshot();
  };
  const loaded = $derived(new Map(snapshot.map((bundle) => [bundle.catalogId, bundle])));

  let root = $state<HTMLElement>();
  let searchInput = $state<HTMLInputElement>();
  let retryButton = $state<HTMLButtonElement>();
  let query = $state('');
  let busy = $state(false);
  let failure = $state<{ error: unknown } | null>(null);
  let failedLoad = $state<(() => Promise<void>) | null>(null);
  /** Keys asked for whose bundle is still downloading. */
  const pending = new SvelteSet<string>();
  let outlineOpacity = $state<number | null>(null);
  let minimumDraft = $state<number | null>(null);
  let settingsOpen = $state(false);

  const errorCode = $derived(failure && diffusionErrorCode(failure.error));
  const updated = $derived(errorCode === 'asset-updated');
  const showRetry = $derived((failedLoad !== null || updated) && !busy);
  const statusText = $derived(failure ? '' : busy ? text.loading : ready ? text.ready : '');

  const opacity = $derived(
    matching ? cortexOpacity : (outlineOpacity ?? catalog.brain_outline.opacity),
  );
  const shownMinimum = $derived(minimumDraft ?? minimum);

  const needle = $derived(foldForSearch(query.trim(), lang));
  const kept = $derived(rows.map((row) => tractSearchText(row, lang).includes(needle)));
  const matches = $derived(
    rows.reduce((count, row, index) => count + (kept[index] ? row.members.length : 0), 0),
  );
  const noMatch = $derived(t(lang, 'navigator').noMatch(query.trim()));

  const runner = createBusyRunner();
  const results = createDebouncedAnnouncer();

  $effect(() => {
    const offs = [engine.on('tractsReady', refresh), engine.on('tractsVisibility', refresh)];
    refresh();
    return () => offs.forEach((off) => off());
  });
  $effect(() => results.dispose);

  $effect(() => {
    if (matching) tracts.setOverlay(overlay);
  });

  let wasActive = false;
  $effect(() => {
    const next = active;
    untrack(() => {
      if (next === wasActive) return;
      wasActive = next;
      if (next && !tracts.ready) void load(() => tracts.setActive(true));
      else void tracts.setActive(next);
    });
  });

  /** Whether focus could land on `element` now. */
  const takesFocus = (element: HTMLElement | undefined | null): element is HTMLElement =>
    Boolean(
      element &&
      element.isConnected &&
      element.checkVisibility() &&
      !element.matches(':disabled') &&
      !element.closest('[inert]'),
    );

  /**
   * A load disables the controls and may hide the button that was pressed. If focus fell to the page
   * by then, it goes back to what had it, else to Retry (when a failure shows it), else to the search.
   */
  function restoreFocus(previous: HTMLElement | null) {
    if (!previous || !active || !root) return;
    const current = document.activeElement;
    const stranded =
      !current || current === document.body || (current as HTMLElement).matches(':disabled');
    if (!stranded) return;
    const target = [previous, retryButton, searchInput].find(takesFocus);
    target?.focus({ preventScroll: true });
  }

  /** One load at a time; a refused one does nothing. Resolves whether the load succeeded. */
  async function load(action: () => Promise<void>): Promise<boolean> {
    if (runner.busy) return false;
    const focused =
      root?.contains(document.activeElement) && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const ok = await runner.run(action, {
      onStart() {
        busy = true;
        failure = null;
        failedLoad = null;
      },
      onError(error) {
        failure = { error };
        failedLoad = action;
      },
      onSettled() {
        busy = false;
        refresh();
      },
    });
    await tick();
    restoreFocus(focused);
    return ok;
  }

  /** A synchronous engine setter; a failure is shown, not thrown at the reader. */
  function control(action: () => void) {
    failedLoad = null;
    try {
      action();
      failure = null;
    } catch (error) {
      console.error(error);
      failure = { error };
    }
    refresh();
  }

  function toggle(id: string, wanted: boolean) {
    if (tracts.hasBundle(id)) {
      control(() => tracts.setVisible(id, wanted));
      return;
    }
    // Only a checked key can ask for a bundle that is not loaded yet.
    pending.add(id);
    const name = catalog.bundles.find((bundle) => bundle.id === id)!.name[lang];
    void load(() => tracts.loadBundle(id)).then((ok) => {
      pending.delete(id);
      if (ok) announce(added.loaded(name));
    });
  }

  async function retry() {
    if (updated) await reloadWithoutStoredModels();
    else await load(failedLoad!);
  }

  function say() {
    results.say(matches === 0 ? `${noMatch}. ${text.noMatchHint}` : added.matches(matches));
  }

  function clearSearch() {
    query = '';
    results.reset();
    searchInput?.focus();
    say();
  }

  function restore() {
    control(() => {
      for (const bundle of tracts.snapshot()) {
        tracts.setVisible(
          bundle.id,
          Boolean(catalog.bundles.find((b) => b.id === bundle.id)?.initial),
        );
      }
    });
    announce(added.restored);
  }

  function exportCsv() {
    downloadText(
      buildLengthsCsv(tracts.snapshot(), minimum),
      LENGTHS_CSV_FILENAME,
      'text/csv;charset=utf-8',
    );
    announce(added.exported);
  }

  /** Moves focus to the search field (the global `/` key). */
  export function focusSearch() {
    searchInput?.focus();
  }

  const fraction = (value: number) => percent(value, lang);
  const millimetres = (value: number) => withUnit(decimal(value, 0, lang), 'mm', lang);
</script>

<div class="tracts" bind:this={root} hidden={!active}>
  <div class="head">
    <label class="visually-hidden" for="native-tract-search">{text.search}</label>
    <div class="search-box">
      <svg
        class="search-affordance"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        id="native-tract-search"
        bind:this={searchInput}
        type="search"
        autocomplete="off"
        spellcheck="false"
        aria-controls="native-tract-bundles"
        placeholder={text.search}
        value={query}
        oninput={(event) => {
          query = event.currentTarget.value;
          say();
        }}
        onkeydown={(event) => {
          if (event.key === 'Escape' && query !== '') {
            event.preventDefault();
            clearSearch();
          }
        }}
      />
      {#if query === ''}
        <kbd class="search-shortcut" aria-hidden="true">/</kbd>
      {:else}
        <button
          type="button"
          class="search-clear"
          aria-label={t(lang, 'navigator').clearSearch}
          onclick={clearSearch}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="body">
    <h3 class="visually-hidden">{dataset.dataset}</h3>
    <div class="status" class:visually-hidden={ready && !busy && !failure}>
      <StatusLine text={statusText} />
    </div>
    {#if failure && errorCode}
      <p class="status alert" role="alert">{diffusionError(lang, errorCode)}</p>
    {/if}
    {#if showRetry}
      <button bind:this={retryButton} type="button" class="retry" onclick={retry}>
        {updated ? t(lang, 'errors').reload : added.tryAgain}
      </button>
    {/if}

    <fieldset disabled={busy || !ready}>
      {#if matches > 0}
        <h4 class="list-heading">
          <span>{text.bundles}</span><span class="visually-hidden">{', '}</span><span class="count"
            >{grouped(matches)}</span
          >
        </h4>
      {/if}
      <div id="native-tract-bundles" class="list">
        {#each rows as row, index (row.key)}
          <TractRow
            {row}
            {lang}
            {loaded}
            {pending}
            glyphs={t(lang, 'sides').glyphs}
            {text}
            hidden={!kept[index]}
            ontoggle={toggle}
          />
        {/each}
      </div>
      {#if matches === 0}
        <EmptyState title={noMatch} message={text.noMatchHint} />
      {/if}
      {#if !matching}
        <p class="scope">{dataset.otherAnatomy}</p>
      {/if}

      <details class="settings" bind:open={settingsOpen}>
        <summary>
          <span>{text.settings}</span>
          <span class="readout measure">{settingsReadout(opacity, shownMinimum, lang)}</span>
        </summary>
        {#if matching}
          <label class="check">
            <input
              type="checkbox"
              checked={overlay}
              onchange={(event) => {
                overlay = event.currentTarget.checked;
              }}
            />
            <span>{text.showOverlay}</span>
          </label>
        {/if}
        <RangeField
          label={matching ? text.cortexOpacity : text.brainOpacity}
          value={opacity}
          min={0}
          max={1}
          step={0.02}
          format={fraction}
          oninput={(value) =>
            control(() => {
              if (matching) onCortexOpacity(value);
              else {
                tracts.setOutlineOpacity(value);
                outlineOpacity = value;
              }
            })}
        />
        <RangeField
          label={text.minimum}
          value={minimum}
          min={MINIMUM_LENGTH.min}
          max={MINIMUM_LENGTH.max}
          step={MINIMUM_LENGTH.step}
          format={millimetres}
          oninput={(value) => (minimumDraft = value)}
          onchange={(value) => {
            minimumDraft = null;
            control(() => {
              tracts.setMinimum(value);
              minimum = value;
            });
          }}
        />
        <div class="exports">
          <button type="button" class="quiet" onclick={restore}>{text.restore}</button>
          <button type="button" class="quiet" onclick={exportCsv}>{text.exportMetrics}</button>
        </div>
      </details>
    </fieldset>

    <div class="about">
      <Disclosure summary={text.about} variant="section">
        <p class="note">{text.nativeReference}</p>
        {#if !matching}<p class="note">{text.outlineLimit}</p>{/if}
        {#if matching}<p class="note">{text.mriHint}</p>{/if}
        <p class="note">{text.metricsScope}</p>
        <p class="note">{dataset.files}</p>
        <a class="source" href={catalog.source} target="_blank" rel="noreferrer">
          {text.source}<span class="visually-hidden"> {added.newTab}</span>
        </a>
        {#if !matching}
          <a
            class="source"
            href="{ASSET_BASE}diffusion/{catalog.brain_outline.provenance}"
            target="_blank"
            rel="noreferrer"
          >
            {text.outlineProvenance}<span class="visually-hidden"> {added.newTab}</span>
          </a>
        {/if}
      </Disclosure>
    </div>
  </div>

  <div class="dock">
    <button type="button" class="primary" onclick={onOpenMri}>{text.mriOpen}</button>
  </div>
</div>

<style>
  @layer features {
    /* The shared pinned search head, then the list and its two sections scrolling, the MRI command docked at the foot. */
    .tracts {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    .head {
      display: flex;
      flex: none;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .search-affordance {
      position: absolute;
      left: 10px;
      color: var(--text-tertiary);
      pointer-events: none;
    }
    input[type='search'] {
      appearance: none;
      width: 100%;
      height: auto;
      min-height: var(--control-height);
      padding: 0 36px 0 32px;
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background-color: var(--surface-navigation);
      box-shadow: none;
      font-size: var(--text-ui);
    }
    input[type='search']::placeholder {
      color: var(--text-tertiary);
      opacity: 1;
    }
    /* One clear control: the native one is hidden. */
    input[type='search']::-webkit-search-cancel-button {
      appearance: none;
      display: none;
    }
    input[type='search']:focus {
      background-color: var(--surface-base);
      border-color: var(--accent);
    }
    .search-shortcut {
      position: absolute;
      right: 6px;
      padding: 0 6px;
      pointer-events: none;
    }
    :global(:root[data-single-keys='off']) .search-shortcut {
      display: none;
    }
    .search-clear {
      position: absolute;
      inset-block: 0;
      right: var(--space-1);
      margin-block: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--text-tertiary);
      cursor: pointer;
    }

    .body {
      /* Keeps the absolutely positioned hidden text inside the scrolling panel. */
      position: relative;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      /* A focused key scrolls clear of the docked command (WCAG 2.4.11). */
      scroll-padding-block-end: calc(var(--control-height) + var(--space-6));
      padding-bottom: var(--space-6);
    }

    .status,
    .scope,
    .note {
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      overflow-wrap: anywhere;
    }
    .status {
      padding: var(--space-3) var(--panel-inset) 0;
    }
    .alert {
      color: var(--danger);
    }
    .retry {
      margin: var(--space-2) var(--panel-inset) 0;
    }
    fieldset {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    /* The list's caption counts the bundles the search keeps, in the column the keys end on. */
    .list-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      margin: 0;
      padding: var(--space-3) var(--panel-inset) var(--space-2);
      background: var(--surface-base);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .list-heading > :first-child {
      min-width: 0;
    }
    .count {
      flex: none;
      font-weight: 400;
      color: var(--text-tertiary);
      font-variant-numeric: tabular-nums;
    }
    .list :global(.bundle + .bundle) {
      border-top: 1px solid var(--border-subtle);
    }
    /* A caveat on the whole collection is the list's foot line. */
    .scope {
      padding: var(--space-3) var(--panel-inset) 0;
      color: var(--text-tertiary);
    }

    /* Settings and provenance follow the tract list on the shared text column. */
    .settings,
    .about {
      margin-top: var(--space-6);
      margin-inline: var(--panel-inset);
      padding-block: var(--space-1);
      border-top: 1px solid var(--border-subtle);
    }
    .about :global(details) {
      margin-top: 0;
    }
    .about :global(summary) {
      min-height: var(--row-height);
      font-weight: 500;
    }
    .settings > summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: var(--space-2);
      row-gap: var(--space-1);
      min-height: var(--row-height);
      list-style: none;
      cursor: pointer;
      font-weight: 500;
      color: var(--text-primary);
    }
    .settings > summary::-webkit-details-marker {
      display: none;
    }
    .settings > summary > :first-child {
      flex: 1 1 auto;
      min-width: 0;
    }
    /* The one chevron, at the right end: down closed, up open. */
    .settings > summary::after {
      content: '';
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: rotate(45deg) translate(-1.6px, -1.6px);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    .settings[open] > summary::after {
      transform: rotate(-135deg) translate(-1.6px, -1.6px);
    }
    .settings > summary:focus-visible {
      outline-offset: -2px;
    }
    /* Closed, the summary still reads out what it holds; open, the controls say it themselves. */
    .readout {
      margin-left: auto;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-weight: 400;
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    .settings[open] .readout {
      display: none;
    }
    .settings > :global(.control-field) {
      margin-top: var(--space-4);
    }
    .check {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--row-height);
      font-size: var(--text-ui);
      color: var(--text-primary);
      cursor: pointer;
    }
    .check input {
      flex: none;
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .check:has(input:disabled) {
      color: var(--text-tertiary);
      cursor: default;
    }
    .exports {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--space-1);
      margin: var(--space-3) calc(-1 * var(--space-2)) 0;
    }

    button {
      height: var(--control-height);
      padding: 0 var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui);
    }
    button:disabled {
      background: var(--surface-sunken);
      color: var(--text-tertiary);
      cursor: default;
    }
    .quiet {
      height: auto;
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-2);
      background: none;
      color: var(--text-secondary);
      white-space: normal;
      text-align: left;
    }
    .quiet:disabled {
      background: none;
    }
    .note {
      margin: var(--space-2) 0 0;
    }
    .source {
      display: block;
      width: fit-content;
      max-width: 100%;
      margin-top: var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      overflow-wrap: anywhere;
    }

    .dock {
      display: flex;
      flex: none;
      padding: var(--space-3) var(--panel-inset);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .primary {
      flex: 1;
      min-width: 0;
      height: auto;
      min-height: var(--control-height);
      padding-block: var(--space-2);
      background: var(--primary-fill);
      border-color: var(--primary-fill);
      color: var(--primary-ink);
      white-space: normal;
    }

    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--surface-tonal-hover);
      }
      .quiet:hover:not(:disabled) {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
      .primary:hover:not(:disabled) {
        background: var(--primary-fill-hover);
        border-color: var(--primary-fill-hover);
      }
      input[type='search']:hover:not(:disabled) {
        border-color: var(--text-secondary);
      }
      .search-clear:hover:not(:disabled) {
        color: var(--text-primary);
        background: var(--surface-hover);
      }
      .settings > summary:hover {
        color: var(--accent);
      }
    }
    @media (pointer: coarse) {
      .search-clear {
        width: 44px;
        height: 44px;
        right: 0;
      }
      input[type='search'] {
        padding-right: 44px;
      }
      .search-shortcut {
        display: none;
      }
      .quiet,
      .settings > summary {
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .settings > summary::after {
        transition: none;
      }
    }
    @media (prefers-contrast: more) {
      button:not(.quiet) {
        border-color: var(--border-control);
      }
    }
    @media (forced-colors: active) {
      button,
      input[type='search'] {
        border-color: CanvasText;
      }
      input[type='search']:focus-visible,
      .check input:focus-visible {
        outline: 2px solid Highlight;
      }
    }
  }
</style>
