<!--
  The Lesion popover's body. While it is open a click on the brain or a cut face places the lesion
  (the store tells the engine); the radius redraws as the thumb moves and is measured once let go.
-->
<script lang="ts">
  import { formatRas, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
  import { LESION_RADIUS } from '../../lib/types/constants.ts';
  import type { Language } from '../../lib/types/index.ts';
  import RangeField from '../../lib/ui/RangeField.svelte';

  let {
    lesion,
    lang,
    onReport,
  }: {
    lesion: LesionStore;
    lang: Language;
    /** Open the report in the panel. */
    onReport: () => void;
  } = $props();

  const copy = $derived(t(lang, 'lesion'));
  const placed = $derived(lesion.sphere);
</script>

<RangeField
  label={copy.radius}
  value={lesion.radius}
  min={LESION_RADIUS.min}
  max={LESION_RADIUS.max}
  format={(radius) => withUnit(radius, 'mm', lang)}
  oninput={lesion.previewRadius}
  onchange={lesion.commitRadius}
/>
<p class="hint">{placed ? copy.moveHint : copy.placeHint}</p>
{#if placed}
  <p class="centre">{formatRas(placed.centre, lang)}</p>
  <div class="actions">
    <button type="button" class="stage-command" onclick={onReport}>{copy.showReport}</button>
    <button type="button" class="stage-command stage-command-quiet" onclick={lesion.remove}>
      {copy.remove}
    </button>
  </div>
{/if}

<style>
  @layer features {
    .hint {
      margin: var(--space-3) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    .centre {
      margin: var(--space-1) 0 0;
      font-size: var(--text-caption);
      font-variant-numeric: tabular-nums;
      color: var(--overlay-ink);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-2);
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--overlay-border);
    }
  }
</style>
