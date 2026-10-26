<!--
  Constituent regions (ui/panels/constituents.js): trace a learning unit to its original atlas
  regions. A structure is a button that opens it; a cut-only region is text. When the parts span
  both hemispheres each row names its side, because a midline union holds a left and a right part
  of one name (deviations/r1-constituent-side.md). A part the catalog lacks throws.
  The summary carries a count span, which Disclosure's string summary cannot, so this is the one
  hand-written <details>; it stays mounted so its open state survives from one selection to the next.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import type { RegionLabel } from '../../lib/core/catalog/labels.ts';
  import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';

  let {
    region,
    lang,
    get,
    onregion,
  }: {
    region: Region | null;
    lang: Language;
    /** The catalog's entry for a region id, labelled in `lang`. */
    get: (id: string) => { region: Region; label: RegionLabel } | null;
    onregion: (id: string) => void;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'inspector'));
  const sides = $derived(t(lang, 'sides'));
  const entries = $derived(
    (region?.constituent_regions ?? []).map((id) => {
      const entry = get(id);
      if (!entry) throw new Error(`Missing learning constituent: ${id}`);
      return { id, ...entry };
    }),
  );
  const sided = $derived(new Set(entries.map((entry) => entry.region.hemisphere)).size > 1);
</script>

{#if region?.constituent_regions}
  <details class="constituents" bind:open>
    <summary
      >{copy.constituentsHeading} <span class="disclosure-count">{entries.length}</span></summary
    >
    <ul class="constituents-list">
      {#each entries as { id, region: part, label } (id)}
        <li>
          {#if part.kind === 'structure'}
            <button type="button" onclick={() => onregion(id)}
              >{label.name}{#if sided}<span class="visually-hidden"
                  >, {sides.words[part.hemisphere]}</span
                >{/if}</button
            >
          {:else}
            <span
              >{label.name}{#if sided}<span class="visually-hidden"
                  >, {sides.words[part.hemisphere]}</span
                >{/if}</span
            >
          {/if}
          <!-- Opening a constituent switches Internal anatomy to the set that holds it. -->
          <span class="constituent-set"
            >{part.kind === 'structure'
              ? atlasSwitchLabel(part.atlas!, lang)
              : copy.constituentCutOnly}</span
          >
          {#if sided}<span class="constituent-side" aria-hidden="true"
              >{sides.glyphs[part.hemisphere]}</span
            >{/if}
        </li>
      {/each}
    </ul>
    <p class="detail-note">{copy.constituentsNote}</p>
  </details>
{/if}
