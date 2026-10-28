<!--
  Overlap with the other cortical atlas (ui/panels/atlas-comparison.js): for a selected cortex
  region, the regions of the other atlas it overlaps, by area and share of its whole pial surface.
  R1's `comparison` slot mounts it and keeps it mounted, so the panel's and the list's open state
  survive from one selection to the next (decision 39 on #4); it is `hidden`, not removed, when the
  manifest declares no comparison or the region is not cortex.
  - the data loads once, the first time the panel is shown, even while it is closed; Retry loads again;
  - a row is a toggle button that draws the overlap outline through `engine.comparison`; the latest
    request wins, and closing the panel, changing region or losing the outline drops it;
  - a row stays a Tab stop when no outline can be drawn: `aria-disabled`, described by the view note
    (deviations/r2-aria-disabled-rows.md); the status line is always mounted
    (deviations/r2-status-live.md); Retry hands focus to the summary (deviations/r2-retry-focus.md).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { Language, Region } from '../../lib/types/index.ts';
  import { readComparison } from '../../lib/core/assets/comparison-assets.ts';
  import { createLatestRunner } from '../../lib/core/async/latest.ts';
  import { labelOf } from '../../lib/core/catalog/labels.ts';
  import {
    comparedWith,
    createComparisonCatalog,
    type ComparisonCatalog,
    type ComparisonData,
    type ComparisonManifest,
  } from '../../lib/core/comparison/catalog.ts';
  import { overlapArea, overlapShare } from '../../lib/core/comparison-format.ts';
  import { withUnit } from '../../lib/core/format.ts';
  import { failureNotice } from '../../lib/core/i18n/errors.ts';
  import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
  import type { Engine } from '../../lib/engine/api.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import StatusLine from '../../lib/ui/StatusLine.svelte';
  import { announce } from '../../lib/ui/announcer.svelte.ts';

  let {
    engine,
    manifest,
    manifestUrl,
    region,
    lang,
    outlineAvailable,
  }: {
    engine: Pick<Engine, 'comparison'>;
    manifest: ComparisonManifest;
    /** The manifest's own URL; the comparison file is published beside it. */
    manifestUrl: string;
    /** The selected region, or null. */
    region: Region | null;
    lang: Language;
    /** False while a cut is drawn or a tract reference is shown (app.js:1638): no outline can be drawn. */
    outlineAvailable: boolean;
  } = $props();

  const FIRST_ROWS = 4;
  const uid = $props.id();

  type Phase = 'idle' | 'loading' | 'ready' | 'error';
  interface Loaded {
    data: ComparisonData;
    catalog: ComparisonCatalog;
  }

  let root = $state<HTMLElement>();
  let open = $state(false);
  let moreOpen = $state(false);
  let methodOpen = $state(false);
  let phase = $state<Phase>('idle');
  let loaded = $state.raw<Loaded | null>(null);
  /** What failed, worded at render time so a language change rewords it. */
  let failure = $state.raw<{ error: unknown; operation: 'comparison' | 'overlap' } | null>(null);
  /** The mesh whose outline is drawn, and the one still being fetched. */
  let active = $state<string | null>(null);
  let busy = $state<string | null>(null);
  /** The load finished since the reader last did anything: said once, then dropped. */
  let justLoaded = $state(false);

  const copy = $derived(t(lang, 'comparison'));
  // Only the compared atlases have overlaps; another cortical atlas has no section.
  const partner = $derived(comparedWith(region?.atlas));
  const shown = $derived(
    Boolean(manifest.atlas_comparison) && region?.kind === 'cortex' && partner !== null,
  );
  const sourceId = $derived(shown ? region!.id : null);

  const comparison = $derived.by(() => {
    if (!loaded || !sourceId) return null;
    const result = loaded.catalog.comparisonFor(sourceId);
    if (!result) throw new Error(`No atlas comparison for region: ${sourceId}`);
    return result;
  });
  const regionById = $derived(new Map(manifest.regions.map((entry) => [entry.id, entry])));
  const rowName = (id: string) => labelOf(regionById.get(id)!, lang)!.name;
  const heading = $derived(shown ? copy.heading(atlasSwitchLabel(partner!, lang)) : '');

  const status = $derived(
    failure
      ? failureNotice(failure.error, lang, failure.operation).text
      : phase === 'loading'
        ? copy.loading
        : busy
          ? copy.highlightLoading
          : justLoaded
            ? copy.ready
            : '',
  );

  const loader = createLatestRunner();
  const highlighter = createLatestRunner();

  function clear() {
    highlighter.cancel();
    active = null;
    busy = null;
    justLoaded = false;
    engine.comparison.clear();
  }

  function load() {
    phase = 'loading';
    failure = null;
    const file = manifest.atlas_comparison!;
    const url = new URL(file.file, new URL(manifestUrl, globalThis.location.href)).href;
    void loader.run(
      async (): Promise<Loaded> => {
        const data = (await readComparison(url, file.sha256)) as ComparisonData;
        return { data, catalog: createComparisonCatalog(data, manifest) };
      },
      {
        onResult(value) {
          loaded = value;
          phase = 'ready';
          justLoaded = true;
        },
        onError(error) {
          phase = 'error';
          failure = { error, operation: 'comparison' };
        },
      },
    );
  }

  function toggle(meshId: string) {
    if (!outlineAvailable) return;
    if (active === meshId) {
      clear();
      return;
    }
    clear();
    busy = meshId;
    failure = null;
    void highlighter.run(() => engine.comparison.highlight(meshId, loaded!.data.geometry), {
      onResult(applied) {
        if (applied) active = meshId;
      },
      onError(error) {
        failure = { error, operation: 'overlap' };
      },
      onSettled() {
        busy = null;
      },
    });
  }

  function retry() {
    // The button is about to leave: the summary is the one stable control left in the panel.
    root!.querySelector('summary')!.focus();
    load();
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([loaded!.catalog.exportCsv(sourceId!, lang)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${manifest.anatomy.id}-${sourceId!.replaceAll(':', '-')}-atlas-comparison.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(copy.exported);
  }

  // The data loads once, the first time the panel is shown, though the disclosure is still closed.
  $effect(() => {
    if (shown) {
      untrack(() => {
        if (phase === 'idle') load();
      });
    }
  });

  // A new subject drops the highlight and an old overlap failure; a failed load stays until Retry.
  let previousSource: string | null = null;
  $effect(() => {
    const id = sourceId;
    untrack(() => {
      if (id === previousSource) return;
      previousSource = id;
      if (failure?.operation === 'overlap') failure = null;
      clear();
    });
  });

  $effect(() => {
    if (!outlineAvailable) {
      untrack(() => {
        if (active || busy) clear();
      });
    }
  });

  // Closing the panel drops the highlight; opening it keeps the selection.
  let wasOpen = false;
  $effect(() => {
    const now = open;
    untrack(() => {
      if (wasOpen && !now) clear();
      wasOpen = now;
    });
  });

  $effect(() => () => {
    loader.cancel();
    clear();
  });
</script>

{#snippet row(entry: { regionId: string; areaMm2: number; meshId: string; fraction: number })}
  {@const name = rowName(entry.regionId)}
  <li>
    <button
      type="button"
      class="comparison-row"
      aria-pressed={active === entry.meshId}
      aria-disabled={outlineAvailable ? undefined : 'true'}
      aria-describedby={outlineAvailable ? undefined : `${uid}-view-note`}
      aria-label={copy.highlight(
        name,
        withUnit(overlapArea(entry.areaMm2, lang), 'mm²', lang),
        withUnit(overlapShare(entry.fraction, lang), '%', lang),
      )}
      onclick={() => toggle(entry.meshId)}
    >
      <span class="comparison-name">{name}</span>
      <span class="measure">{overlapArea(entry.areaMm2, lang)}</span>
      <span class="measure">{overlapShare(entry.fraction, lang)}</span>
    </button>
  </li>
{/snippet}

<div class="evidence-section comparison" hidden={!shown} bind:this={root}>
  <Disclosure variant="section" summary={heading} bind:open>
    {#key lang}
      <StatusLine
        class="detail-note comparison-status{status === copy.ready ? ' visually-hidden' : ''}"
        text={status}
      />
    {/key}
    {#if phase === 'error'}
      <button type="button" class="comparison-retry" onclick={retry}>{copy.retry}</button>
    {/if}
    <div hidden={phase !== 'ready'} aria-busy={phase === 'loading' || busy !== null}>
      {#if comparison}
        <div class="comparison-columns" aria-hidden="true">
          {#each copy.columns as column (column)}<span>{column}</span>{/each}
        </div>
        <ul class="comparison-list">
          {#each comparison.rows.slice(0, FIRST_ROWS) as entry (entry.meshId)}
            {@render row(entry)}
          {/each}
        </ul>
        {#if comparison.rows.length > FIRST_ROWS}
          <Disclosure summary={copy.more(comparison.rows.length - FIRST_ROWS)} bind:open={moreOpen}>
            <ul class="comparison-list">
              {#each comparison.rows.slice(FIRST_ROWS) as entry (entry.meshId)}
                {@render row(entry)}
              {/each}
            </ul>
          </Disclosure>
        {/if}
        <div class="comparison-row unassigned">
          <span>{copy.unassigned}</span>
          <span class="measure"
            >{overlapArea(comparison.unassignedAreaMm2, lang)}<span class="visually-hidden"
              >{' mm²'}</span
            ></span
          >
          <span class="measure"
            >{overlapShare(comparison.unassignedFraction, lang)}<span class="visually-hidden"
              >{' %'}</span
            ></span
          >
        </div>
        {#if !outlineAvailable}
          <p class="detail-note" id="{uid}-view-note">{copy.viewNote}</p>
        {/if}
        <div class="comparison-foot">
          <p>{copy.denominator}</p>
          <button type="button" class="comparison-export" onclick={download}>{copy.export}</button>
        </div>
        <div class="comparison-method">
          <Disclosure summary={copy.methodHeading} bind:open={methodOpen}>
            <p class="detail-note">{copy.method}</p>
            <div class="comparison-sources">
              {#each manifest.atlases.filter( (atlas) => loaded!.data.atlases.includes(atlas.id) ) as atlas (atlas.id)}
                <a href={atlas.citation} target="_blank" rel="noopener noreferrer"
                  >{atlasSwitchLabel(atlas.id, lang)}<span class="visually-hidden"
                    >{` ${t(lang, 'link').newTab}`}</span
                  >{@render iconGraphic('external-link')}</a
                >
              {/each}
            </div>
          </Disclosure>
        </div>
      {/if}
    </div>
  </Disclosure>
</div>

<style>
  @layer features {
    .comparison-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    /* One grid for the column heads, the rows and the unassigned remainder, so figures align down the table. */
    .comparison-columns,
    .comparison-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 4.5rem 4rem;
      align-items: start;
      gap: var(--space-2);
    }
    .comparison-columns {
      padding-block: var(--space-1) var(--space-2);
      border-bottom: 1px solid var(--border-subtle);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    /* A head wider than its figures reaches left into the free room, never onto a second line. */
    .comparison-columns > :not(:first-child) {
      justify-self: end;
      text-align: right;
      white-space: nowrap;
    }
    /* Rows share a steady pitch and aligned figures; only the header and remainder need rules. */
    .comparison-row {
      position: relative;
      box-sizing: border-box;
      width: calc(100% + 2 * var(--panel-inset));
      min-height: var(--row-height);
      margin-inline: calc(-1 * var(--panel-inset));
      padding: calc((var(--row-height) - var(--lh-ui)) / 2) var(--panel-inset);
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text-primary);
      font-weight: 400;
      text-align: left;
    }
    button.comparison-row {
      cursor: pointer;
    }
    .comparison-row .measure {
      color: var(--text-primary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      text-align: right;
    }
    .comparison-name {
      min-width: 0;
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .comparison-row[aria-pressed='true'] {
      background: var(--accent-wash);
      color: var(--accent);
    }
    .comparison-row[aria-pressed='true'] .comparison-name {
      font-weight: 600;
    }
    .comparison-row[aria-pressed='true'] .measure {
      color: var(--accent);
    }
    /* Without outlines (a cut is drawn) a row cannot highlight, but its figures are still the data. */
    .comparison-row[aria-disabled='true'] {
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      button.comparison-row:hover:not([aria-disabled='true']) {
        background: var(--surface-hover);
      }
      button.comparison-row[aria-pressed='true']:hover:not([aria-disabled='true']) {
        background: var(--accent-wash);
      }
    }
    .comparison-row:focus-visible {
      outline-offset: -2px;
    }
    .unassigned {
      color: var(--text-secondary);
    }
    .unassigned::before {
      content: '';
      position: absolute;
      inset: 0 var(--panel-inset) auto;
      height: 1px;
      background: var(--border-subtle);
    }

    /* Legacy zeroes whatever follows a section summary (components.css:354); the note's own 8px would show. */
    .comparison :global(.comparison-status) {
      margin-top: 0;
    }
    .comparison :global(.comparison-status:not(:empty)) {
      margin-bottom: var(--space-2);
    }
    .comparison-retry {
      min-height: var(--control-height);
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      cursor: pointer;
    }
    /* The note and its action share the first line's baseline, so a wrapped note leaves the button where it was. */
    .comparison-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: first baseline;
      justify-content: space-between;
      gap: 0 var(--space-3);
      min-height: var(--control-height);
      padding-top: var(--space-1);
    }
    .comparison-foot > p {
      flex: 1 1 18ch;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .comparison-export {
      flex: none;
      min-height: var(--control-height);
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .comparison-retry:hover,
      .comparison-export:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    /* 44px with a coarse pointer, as the panel's other controls; --row-height only follows it on the phone shell. */
    @media (pointer: coarse) {
      button.comparison-row,
      .comparison-retry,
      .comparison-export {
        min-height: 44px;
      }
    }
    .comparison-retry:focus-visible,
    .comparison-export:focus-visible {
      outline-offset: 2px;
    }
    /* What an inline disclosure holds sits under its words, on the indent column. */
    .comparison-method :global(details > :not(summary)) {
      margin: 0 0 0 calc(var(--indent) - var(--panel-inset));
    }
    .comparison-sources {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-3);
      padding-top: var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .comparison-sources a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 24px;
    }
  }

  @layer a11y {
    /* Forced colours erase the wash, the accent ink and the separator's fill: the pressed row gets an edge, the remainder a rule. */
    @media (forced-colors: active) {
      .comparison-row[aria-pressed='true'] {
        border-inline-start: 4px solid Highlight;
        padding-inline-start: calc(var(--panel-inset) - 4px);
      }
      .unassigned::before {
        background: none;
        border-top: 1px solid CanvasText;
      }
    }
    @media (prefers-contrast: more) {
      .comparison-row[aria-pressed='true'] {
        border-inline-start: 4px solid var(--accent);
        padding-inline-start: calc(var(--panel-inset) - 4px);
      }
    }
  }
</style>
