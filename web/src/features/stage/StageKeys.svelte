<!--
  The colour keys, beside the picture they explain (index.html:533-580; viewport-chrome.js:269-430;
  stage.css:186-290). Each is one plate whose title row names its map and folds its rows: networks,
  functional divisions (with its level), the paint a tab draws (rows are toggles that show one alone)
  and the streamline direction.

  Folds are APG Disclosures, the level is an APG Radio Group, the paint rows an APG Toolbar of toggle
  buttons (decision 6 on #4). The keys are interactive, so they are not inside the `aria-hidden`
  overlay layer. They take a band off the framing rectangle, which the stage-layout store reads
  through the key fitter registered here: built from the sizes the observer caches, so it forces no layout.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { Legend } from '../../lib/core/state/paint.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import { FUNCTIONAL_LEVELS } from '../../lib/types/index.ts';
  import type {
    FunctionalLevel,
    Language,
    LoadStatus,
    SurfaceColor,
  } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import { roving } from '../../lib/ui/Toolbar.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';
  import {
    KEY_NOTE_MIN_WIDTH_PX,
    defaultOpen,
    keyBand,
    keyPlates,
    swatchColor,
  } from './stage-keys.ts';
  import type { ColoredNetworks, KeyName, KeyPlate, KeyRow } from './stage-keys.ts';
  import './stage-vars.css';

  interface Props {
    stage: StageLayout;
    media: Pick<Media, 'phone' | 'coarsePointer'>;
    lang: Language;
    status: LoadStatus;
    surfaceColor: SurfaceColor;
    functionalLevel: FunctionalLevel;
    networks: ColoredNetworks | null;
    cabNp: ColoredNetworks | null;
    functionalRegions: FunctionalRegions | null;
    /** The key of the paint on show (`legendFor`), or null. */
    legend: Legend | null;
    directionShown: boolean;
    onFunctionalLevel: (level: FunctionalLevel) => void;
    /** A row alone, or null for every row (`excursions.pickPaint`). */
    onPaintPick: (id: string | null) => void;
  }

  let {
    stage,
    media,
    lang,
    status,
    surfaceColor,
    functionalLevel,
    networks,
    cabNp,
    functionalRegions,
    legend,
    directionShown,
    onFunctionalLevel,
    onPaintPick,
  }: Props = $props();

  // TODO(C1): moves to i18n when the string lands (requested on #4).
  const ABSENT = { en: 'Not shown in this view', fr: 'Absent de cette vue' } as const;

  const plates = $derived(
    keyPlates({
      lang,
      status,
      surfaceColor,
      functionalLevel,
      networks,
      cabNp,
      functionalRegions,
      legend,
      directionShown,
    }),
  );
  const copy = $derived(t(lang, 'functional'));
  const levelOptions = $derived(
    FUNCTIONAL_LEVELS.map((level) => ({ value: level, label: copy.levels[level] })),
  );

  // The reader's fold of a map is kept for the visit; a map never folded follows the crowd default.
  const folds = new SvelteMap<string, boolean>();
  const crowd = new SvelteMap<string, boolean>();
  const isOpen = (plate: KeyPlate) => folds.get(plate.map) ?? crowd.get(plate.map) ?? true;

  let host: HTMLElement | undefined;

  // The crowd default is weighed when a plate's map or length, the device or the stage's first size
  // changes, as legacy did on each update, not on every frame of a resize or a sheet drag.
  const sized = $derived(stage.visibleRect !== null);
  $effect.pre(() => {
    void sized;
    const { phone, coarsePointer: coarse } = media;
    const current = plates;
    untrack(() => {
      const active = document.activeElement;
      const holder =
        active instanceof HTMLElement ? active.closest<HTMLElement>('.stage-key') : null;
      const rect = stage.visibleRect;
      const room = rect
        ? {
            width: rect.width,
            height: rect.height,
            gutter: stage.gutter,
            dockHeight: stage.dock.height,
          }
        : null;
      for (const plate of current) {
        crowd.set(
          plate.map,
          defaultOpen({ ...plate, count: plate.rows.length }, { phone, coarse }, room),
        );
      }
      if (!holder || !host?.contains(holder)) return;
      // Focus never falls to the page: a row that went leaves it on its plate's toggle, a plate that
      // went on the stage.
      const focused = active as HTMLElement;
      void tick().then(() => {
        if (focused.isConnected && focused.checkVisibility()) return;
        const toggle = host!.querySelector<HTMLElement>(
          `[data-name="${holder.dataset.name}"] .stage-key-toggle`,
        );
        (toggle ?? host!.closest<HTMLElement>('#viewport')!).focus();
      });
    });
  });

  function toggleFold(plate: KeyPlate) {
    folds.set(plate.map, !isOpen(plate));
  }

  // The paint note gives way where the stage is narrow, or where the rows would otherwise be cut short.
  const paint = $derived(plates.find((plate) => plate.name === 'paint'));
  const wide = $derived((stage.visibleRect?.width ?? Infinity) >= KEY_NOTE_MIN_WIDTH_PX);
  const noteShown = $derived(Boolean(paint?.note) && wide && isOpen(paint!));
  $effect(() => {
    void paint;
    void lang;
    void noteShown;
    const list = host!.querySelector<HTMLElement>('#paint-key .stage-key-list');
    const note = host!.querySelector<HTMLElement>('#paint-key .stage-key-note');
    if (!list || !note) return;
    note.removeAttribute('data-clipped');
    if (noteShown && list.scrollHeight > list.clientHeight) note.setAttribute('data-clipped', '');
  });

  /**
   * Watches the keys' box and registers the fitting the store runs on every framing and viewport
   * change. It reads cached sizes and tells the store only what changed.
   */
  function fitting(element: HTMLElement) {
    let size = { width: 0, height: 0 };
    function fit() {
      const band = keyBand(size, stage.visibleRect, stage.gutter);
      const { keyInset, keySize } = stage;
      if (
        band.top !== keyInset.top ||
        band.right !== keyInset.right ||
        size.width !== keySize.width ||
        size.height !== keySize.height
      ) {
        stage.setKeys(band, size);
      }
    }
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.borderBoxSize[0]!;
      size = { width: box.inlineSize, height: box.blockSize };
      fit();
    });
    observer.observe(element);
    const release = stage.setKeyFitter(fit);
    return () => {
      release();
      observer.disconnect();
    };
  }
</script>

{#snippet content(row: KeyRow)}
  <Swatch colour={row.absent ? 'transparent' : swatchColor(row.color)} />
  <span class="stage-key-label"
    >{row.label}{#if row.absent}<span class="visually-hidden">. {ABSENT[lang]}</span>{/if}</span
  >
{/snippet}

{#snippet rows(plate: KeyPlate)}
  <!-- svelte-ignore a11y_no_redundant_roles: list-style: none drops the list in Safari and VoiceOver. -->
  <ul
    class="stage-key-list"
    role="list"
    aria-labelledby={plate.pickable ? undefined : `${plate.name}-key-title`}
    data-picked={plate.rows.some((row) => row.pressed) || undefined}
  >
    {#each plate.rows as row (row.id)}
      <li data-absent={row.absent || undefined}>
        {#if plate.pickable}
          <button
            type="button"
            aria-pressed={row.pressed}
            onclick={() => onPaintPick(row.pressed ? null : row.id)}
          >
            {@render content(row)}
          </button>
        {:else}
          {@render content(row)}
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div id="stage-keys" class="stage-keys" bind:this={host} {@attach fitting}>
  {#each plates as plate (plate.name)}
    {@const open = isOpen(plate)}
    <div class="stage-key" id="{plate.name}-key" data-name={plate.name} data-map={plate.map}>
      <div class="stage-key-head">
        <button
          type="button"
          class="stage-key-toggle"
          aria-expanded={open}
          aria-controls="{plate.name}-key-body"
          onclick={() => toggleFold(plate)}
        >
          <span id="{plate.name}-key-title">{plate.title}</span>
          <span class="stage-tool-chevron" aria-hidden="true"></span>
        </button>
        {#if plate.name === 'functional'}
          <ChoiceGroup
            class="functional-level"
            label={copy.keyAria}
            options={levelOptions}
            bind:value={() => functionalLevel, (level) => onFunctionalLevel(level)}
          />
        {/if}
      </div>
      <div class="stage-key-body" id="{plate.name}-key-body" hidden={!open}>
        {#if plate.pickable}
          <div
            class="stage-key-rows"
            role="toolbar"
            aria-orientation="vertical"
            aria-label={plate.title}
            {@attach roving}
          >
            {@render rows(plate)}
          </div>
        {:else}
          {@render rows(plate)}
        {/if}
        {#if plate.name === 'paint'}
          <p class="stage-key-note" hidden={!noteShown}>{plate.note}</p>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  @layer features {
    /*
     * Top right, inside the framing's own band, so neither the anatomy nor a letter is ever under one.
     * A long list scrolls rather than reach the dock's line, where the scale bar sits.
     */
    .stage-keys {
      position: absolute;
      z-index: 2;
      top: calc(var(--vis-top) + var(--stage-gutter));
      right: calc(var(--vis-right) + var(--stage-gutter));
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-2);
      max-width: calc(100% - var(--vis-left) - var(--vis-right) - 2 * var(--stage-gutter));
      max-height: calc(
        100% - var(--vis-top) - var(--vis-bottom) - 3 * var(--stage-gutter) - var(--dock-height)
      );
    }
    /* One flat plate. Bounded in pixels, so a note runs in a few full lines. */
    .stage-key {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      max-width: 280px;
      padding: 0 var(--space-3);
      background: var(--overlay-plate);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .stage-key-head {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 32px;
    }
    .stage-key-toggle {
      display: inline-flex;
      flex: 1 0 auto;
      align-items: center;
      gap: var(--space-2);
      min-height: 32px;
      margin: 0 calc(-1 * var(--space-3));
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--overlay-ink-muted);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      white-space: nowrap;
      cursor: pointer;
    }
    .stage-key-toggle:focus-visible,
    .stage-key-list button:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .stage-key-toggle:hover {
        color: var(--overlay-ink);
      }
    }
    /* Drawn, like every disclosure chevron; it points up while the plate is open. */
    .stage-tool-chevron {
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
    [aria-expanded='true'] > .stage-tool-chevron {
      transform: translateY(4px) rotate(-135deg);
    }

    /* The level shares the title row: a track in the key's own type, at least 24 px high. */
    .stage-key :global(.functional-level) {
      flex: none;
      margin-right: calc(-1 * var(--space-2));
    }
    .stage-key :global(.functional-level [role='radio']) {
      min-height: 24px;
      height: auto;
      padding: 0 var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }

    .stage-key-body,
    .stage-key-rows {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    /* Every key keeps one rhythm: 24 px rows, a wrapped label running on under its first line beside the swatch. */
    .stage-key-list {
      display: grid;
      min-height: 0;
      margin: 0;
      padding: 0 0 var(--space-2);
      overflow-y: auto;
      overscroll-behavior: contain;
      list-style: none;
    }
    .stage-key-list li,
    .stage-key-list button {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      min-height: 24px;
      padding-block: calc((24px - var(--lh-caption)) / 2);
    }
    .stage-key-list :global(.network-swatch) {
      flex: none;
      margin-top: calc((var(--lh-caption) - 10px) / 2);
    }
    .stage-key-label {
      overflow-wrap: anywhere;
    }
    /* A paint row is a toggle: pressing one shows that row's regions alone, the others step back. */
    .stage-key-list li:has(> button) {
      padding-block: 0;
    }
    .stage-key-list button {
      width: 100%;
      padding-inline: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .stage-key-list[data-picked] button[aria-pressed='false'] {
      color: var(--overlay-ink-muted);
    }
    .stage-key-list button[aria-pressed='true'] {
      font-weight: 600;
    }
    /* A finding with no region coloured in this view: keyed, but faint, its swatch hollowed to an outline. */
    .stage-key-list li[data-absent] {
      color: var(--overlay-ink-faint);
    }
    .stage-key-list li[data-absent] :global(.network-swatch) {
      box-shadow: inset 0 0 0 1px currentColor;
    }
    @media (hover: hover) and (pointer: fine) {
      .stage-key-list button:hover {
        color: var(--overlay-ink);
      }
    }
    .stage-key-note {
      padding: 0 0 var(--space-2);
      color: var(--overlay-ink-muted);
    }
    .stage-key-note:global([data-clipped]) {
      display: none;
    }

    /* A key's title row is a full target; its rows run in two columns, so the band it takes stays short. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .stage-key {
        max-width: 100%;
      }
      .stage-key-head,
      .stage-key-toggle {
        min-height: 44px;
      }
      .stage-key:not([data-name='direction']) .stage-key-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: var(--space-3);
      }
      /* A finding is a sentence, not a name: one per line, or every one wraps. */
      .stage-key[data-map='deficit'] .stage-key-list {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    /* Touch targets follow the stage, never the compact legend. */
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .stage-key-head:has(:global(.functional-level)) {
        min-height: 48px;
      }
      .stage-key :global(.functional-level [role='radio']),
      .stage-key-list button {
        min-height: 44px;
      }
      .stage-key-list button {
        padding-block: calc((44px - var(--lh-caption)) / 2);
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .stage-tool-chevron {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      .stage-key {
        border-color: CanvasText;
      }
    }
  }
</style>
