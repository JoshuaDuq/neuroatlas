<!--
  Boundary certainty: how often NextBrain nearly tied each boundary of the selected region. One row
  per rated neighbour, largest shared boundary first; the glyph is the cut face's ink (solid firm,
  dashed soft) and the name selects that neighbour without moving the view. Only a NextBrain region
  with a rated boundary has the section; it stays mounted so its open state survives from one
  selection to the next.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import type { RegionLabel } from '../../lib/core/catalog/labels.ts';
  import { boundariesOf, overallShare } from '../../lib/core/catalog/boundary-certainty.ts';
  import type { BoundaryCertainty } from '../../lib/core/catalog/boundary-certainty.ts';
  import { decimal, percent, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    certainty,
    label,
    onselect,
  }: {
    region: Region | null;
    lang: Language;
    certainty: BoundaryCertainty | null;
    label: (id: string) => RegionLabel;
    onselect: (id: string) => void;
  } = $props();

  const SHOWN = 8;
  let open = $state(false);

  const copy = $derived(t(lang, 'boundary'));
  const boundaries = $derived(region ? boundariesOf(certainty, region.id) : []);
</script>

{#if boundaries.length}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <p class="network-map">
        {copy.summary(
          percent(overallShare(boundaries), lang),
          boundaries.filter((boundary) => boundary.soft).length,
          boundaries.length,
        )}
      </p>
      <ul class="network-list">
        {#each boundaries.slice(0, SHOWN) as boundary (boundary.neighbour)}
          <li class="network-row">
            <span class="edge-glyph" data-soft={boundary.soft} aria-hidden="true"></span>
            <button
              type="button"
              class="network-row-name boundary-neighbour"
              onclick={() => onselect(boundary.neighbour)}
            >
              {label(boundary.neighbour).name}<span class="visually-hidden"
                >, {boundary.soft ? copy.soft : copy.firm}</span
              >
            </button>
            <Swatch kind="bar" share={boundary.share} />
            <span class="network-share measure">{percent(boundary.share, lang)}</span>
          </li>
        {/each}
      </ul>
      {#if boundaries.length > SHOWN}
        <p class="detail-note">{copy.more(boundaries.length - SHOWN)}</p>
      {/if}
      <p class="detail-note">
        {copy.note(
          withUnit(decimal(certainty!.voxel_spacing_mm, 1, lang), 'mm', lang),
          decimal(certainty!.near_tie_margin, 1, lang),
        )}
      </p>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    .edge-glyph {
      width: 12px;
      height: 2px;
      margin-top: calc(var(--lh-ui) / 2 - 1px);
      background: var(--text-primary);
    }
    .edge-glyph[data-soft='true'] {
      background: repeating-linear-gradient(90deg, var(--text-primary) 0 3px, transparent 3px 5px);
    }
    .boundary-neighbour {
      all: unset;
      cursor: pointer;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .boundary-neighbour:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .boundary-neighbour:hover {
        color: var(--accent);
      }
    }
  }

  @layer a11y {
    /* Forced colours repaint backgrounds: the glyph keeps its ink so solid and dashed stay apart. */
    @media (forced-colors: active) {
      .edge-glyph {
        forced-color-adjust: none;
        background: CanvasText;
      }
      .edge-glyph[data-soft='true'] {
        background: repeating-linear-gradient(90deg, CanvasText 0 3px, transparent 3px 5px);
      }
    }
  }
</style>
