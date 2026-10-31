<!--
  The Lesion popover's body. The reader chooses what a click on the brain does: select a region, or
  place the lesion, which the store tells the engine; the choice holds only while the popover is open.
  The radius redraws as the thumb moves and is measured once let go.
-->
<script lang="ts">
  import { formatRas, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
  import { LESION_RADIUS } from '../../lib/types/constants.ts';
  import type { Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';

  let {
    lesion,
    lang,
    placing,
    onPlacing,
    onReport,
  }: {
    lesion: LesionStore;
    lang: Language;
    /** A click on the brain places the lesion. */
    placing: boolean;
    onPlacing: (placing: boolean) => void;
    /** Open the report in the panel. */
    onReport: () => void;
  } = $props();

  const uid = $props.id();
  const clickId = `lesion-click-${uid}`;

  const copy = $derived(t(lang, 'lesion'));
  // A coordinate's sphere has its own section; a click here places a lesion in its stead.
  const placed = $derived(lesion.kind === 'lesion' ? lesion.sphere : null);
  const clicks = $derived(
    (['select', 'place'] as const).map((value) => ({ value, label: copy.clicks[value] })),
  );
</script>

<p id={clickId} class="stage-field-label">{copy.click}</p>
<ChoiceGroup
  labelledby={clickId}
  class="lesion-click"
  options={clicks}
  bind:value={() => (placing ? 'place' : 'select'), (value) => onPlacing(value === 'place')}
/>
{#if placing}
  <p class="hint">{placed ? copy.moveHint : copy.placeHint}</p>
{/if}
<div class="stage-field">
  <RangeField
    label={copy.radius}
    value={lesion.radius}
    min={LESION_RADIUS.min}
    max={LESION_RADIUS.max}
    format={(radius) => withUnit(radius, 'mm', lang)}
    oninput={lesion.previewRadius}
    onchange={lesion.commitRadius}
  />
</div>
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
      margin: var(--space-2) 0 0;
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
