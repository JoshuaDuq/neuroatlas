<!--
  One tract: its name, then a lettered key per side (or numbered segment). Each key is a native
  checkbox named in full ("Arcuate fasciculus · left"); the row is a group named by the tract.
  The count and lengths describe the key, so a screen reader reads them after its name, but only
  while the bundle is drawn (deviations/t1-metrics-only-while-drawn.md).
-->
<script lang="ts">
  import type { TractBundle as LoadedBundle } from '../../lib/engine/api.ts';
  import { lengthSummary, tractRowName } from '../../lib/core/tracts.ts';
  import type { TractRow } from '../../lib/core/tracts.ts';
  import type { Language } from '../../lib/types/index.ts';

  let {
    row,
    lang,
    loaded,
    pending,
    glyphs,
    text,
    hidden,
    ontoggle,
  }: {
    row: TractRow;
    lang: Language;
    /** The bundles the engine has loaded, by catalog id. */
    loaded: ReadonlyMap<string, LoadedBundle>;
    /** Keys asked for whose bundle is still downloading: shown as on, the row marked busy. */
    pending: ReadonlySet<string>;
    glyphs: Readonly<Record<string, string>>;
    text: {
      streamlines: (shown: number, total: number) => string;
      mean: string;
      range: string;
      noShown: string;
    };
    hidden: boolean;
    /** The key's wish; the owner applies it and the key follows what the engine then holds. */
    ontoggle: (id: string, wanted: boolean) => void;
  } = $props();

  const nameId = $derived(`native-tract-row-${row.key}`);
  const drawn = (id: string) => Boolean(loaded.get(id)?.visible);
  const busy = $derived(row.members.some(({ bundle }) => pending.has(bundle.id)));
</script>

<section class="bundle" data-layout={row.members.length > 2 ? 'segments' : 'sides'} {hidden}>
  <div class="head">
    <span class="name" id={nameId}>{tractRowName(row, lang)}</span>
    <span class="parts" role="group" aria-labelledby={nameId} aria-busy={busy || undefined}>
      {#each row.members as { bundle, part } (bundle.id)}
        {@const isDrawn = drawn(bundle.id)}
        <label class="part">
          <input
            type="checkbox"
            id="native-diffusion-bundle-{bundle.id}"
            aria-label={bundle.name[lang]}
            aria-describedby={isDrawn ? `native-diffusion-bundle-${bundle.id}-meta` : undefined}
            data-tooltip={bundle.name[lang]}
            checked={isDrawn || pending.has(bundle.id)}
            onchange={(event) => {
              const input = event.currentTarget;
              ontoggle(bundle.id, input.checked);
              // What the engine now holds decides, whatever the box was clicked to.
              input.checked = drawn(bundle.id) || pending.has(bundle.id);
            }}
          />
          <span aria-hidden="true">{row.sided ? glyphs[part] : part}</span>
        </label>
      {/each}
    </span>
  </div>
  <div class="metrics">
    {#each row.members as { bundle, part } (bundle.id)}
      {@const metrics = loaded.get(bundle.id)}
      {#if metrics?.visible}
        <p class="meta" id="native-diffusion-bundle-{bundle.id}-meta">
          <span class="side" aria-hidden="true">{row.sided ? glyphs[part] : part}</span>
          <span class="values">
            <span class="count">{text.streamlines(metrics.shown, metrics.total)}</span>
            <span class="length"
              ><span>{metrics.shown ? lengthSummary(metrics, text, lang) : text.noShown}</span
              ></span
            >
          </span>
        </p>
      {/if}
    {/each}
  </div>
</section>

<style>
  @layer features {
    /* One full-bleed ruled row per tract at the tree's pitch: its name, then a key per side (or per segment) ending on the right column. */
    .bundle {
      padding: 0 var(--panel-inset);
    }
    .head {
      display: flex;
      align-items: center;
      gap: var(--space-1) var(--space-3);
      min-height: var(--row-height);
    }
    .name {
      flex: 1;
      min-width: 0;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      font-weight: 500;
      text-wrap: pretty;
      overflow-wrap: anywhere;
    }
    .parts {
      display: flex;
      flex: none;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-1);
    }
    /* Numbered segments take their own line and begin on the name's column. */
    .bundle[data-layout='segments'] .head {
      flex-wrap: wrap;
      padding-top: var(--space-1);
    }
    .bundle[data-layout='segments'] .name {
      flex-basis: 100%;
    }
    .bundle[data-layout='segments'] .parts {
      flex-shrink: 1;
      justify-content: flex-start;
      padding-bottom: var(--space-1);
    }

    /*
     * A part key is a checkbox drawn as a lettered tonal key, edgeless at rest. Drawn is a selection: the
     * list's teal wash with a 1px teal edge and a 600 letter, so on and off differ beyond colour.
     */
    .part {
      position: relative;
      display: inline-grid;
      margin: 0;
      cursor: pointer;
    }
    .part > * {
      grid-area: 1 / 1;
    }
    .part input {
      appearance: none;
      width: 28px;
      height: 24px;
      margin: 0;
      border: 1px solid transparent;
      border-radius: var(--radius-small);
      background: var(--surface-tonal);
      cursor: pointer;
    }
    .part > span {
      place-self: center;
      pointer-events: none;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      color: var(--text-secondary);
    }
    @media (hover: hover) and (pointer: fine) {
      .part:hover input:not(:checked, :disabled) {
        background: var(--surface-tonal-hover);
      }
    }
    .part input:checked {
      background: var(--accent-wash);
      border-color: var(--accent);
    }
    .part input:checked + span {
      color: var(--accent);
      font-weight: 600;
    }
    .part input:disabled {
      background: var(--surface-sunken);
      cursor: default;
    }
    .part input:disabled + span {
      color: var(--text-tertiary);
    }
    .part input:checked:disabled {
      border-color: var(--text-tertiary);
    }
    .part:has(input:disabled) {
      cursor: default;
    }
    @media (pointer: coarse) {
      .part input {
        width: 44px;
        height: 44px;
      }
    }

    /* Per-side metrics under the name: the side glyph on the inset, the values on the indent. */
    .meta {
      display: grid;
      grid-template-columns: calc(var(--indent) - var(--panel-inset)) minmax(0, 1fr);
      align-items: baseline;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
      margin-top: calc(-1 * var(--space-1));
      padding-bottom: var(--space-2);
    }
    .side {
      font-weight: 600;
    }
    .values {
      display: flex;
      flex-wrap: wrap;
      column-gap: var(--space-2);
      overflow-x: clip;
    }
    .values > * {
      min-width: 0;
    }
    .count {
      color: var(--text-primary);
      font-weight: 500;
    }
    .length {
      display: contents;
    }
    .length > span {
      position: relative;
      white-space: normal;
    }
    /* The dot is centred in the gap, so one that would start a wrapped line falls outside the clip. */
    .length > span::before {
      content: '·';
      content: '·' / '';
      position: absolute;
      left: -5.5px;
      color: var(--text-tertiary);
    }
  }

  @layer a11y {
    /* a11y.css:45 and 94-100. */
    @media (prefers-contrast: more) {
      .part input {
        border-color: var(--border-control);
      }
      .part input:checked {
        border-color: var(--accent);
      }
    }
    @media (forced-colors: active) {
      .part input {
        forced-color-adjust: none;
        background: Canvas;
        border-color: CanvasText;
      }
      .part > span {
        forced-color-adjust: none;
        color: CanvasText;
      }
      .part input:checked {
        background: Highlight;
        border-color: Highlight;
      }
      .part input:checked + span {
        color: HighlightText;
      }
      .part input:disabled {
        border-color: GrayText;
      }
      .part input:disabled + span {
        color: GrayText;
      }
      .part input:focus-visible {
        outline: 2px solid Highlight;
      }
    }
  }
</style>
