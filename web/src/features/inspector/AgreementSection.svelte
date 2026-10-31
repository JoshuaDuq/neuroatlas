<!--
  Segmentation agreement: for an aseg structure, NextBrain's union of it, or a NextBrain label in that
  union, how much of the structure both segmentations label and how much only one does, on aseg's
  1 mm grid. The swatches are the linked MRI's ink; the button shows the same voxels there. It stays
  mounted so its open state survives from one selection to the next.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import type { RegionLabel } from '../../lib/core/catalog/labels.ts';
  import {
    AGREEMENT_CATEGORIES,
    AGREEMENT_COLORS,
    agreementDice,
    comparedStructureOf,
  } from '../../lib/core/catalog/segmentation-agreement.ts';
  import type {
    AgreementCategory,
    SegmentationAgreement,
  } from '../../lib/core/catalog/segmentation-agreement.ts';
  import { decimal, quantity } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    agreement,
    label,
    onshow,
  }: {
    region: Region | null;
    lang: Language;
    agreement: SegmentationAgreement | null;
    label: (id: string) => RegionLabel;
    /** Shows this structure's agreement on the linked MRI; `instant` for a keyboard activation. */
    onshow: (code: number, options: { instant: boolean }) => unknown;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'agreement'));
  const structure = $derived(region && comparedStructureOf(agreement, region.id));
  const union = $derived(structure && label(structure.regions.learning).name);
  const VOXELS: Record<AgreementCategory, 'both' | 'aseg_only' | 'nextbrain_only'> = {
    both: 'both',
    'aseg-only': 'aseg_only',
    'nextbrain-only': 'nextbrain_only',
  };
  const rgb = (category: AgreementCategory) => `rgb(${AGREEMENT_COLORS[category].join(' ')})`;
</script>

{#if region && structure && union}
  {@const total =
    structure.voxels.both + structure.voxels.aseg_only + structure.voxels.nextbrain_only}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      {#if region.atlas === 'nextbrain'}
        <p class="network-map">{copy.compared(union)}</p>
      {/if}
      <ul class="network-list">
        {#each AGREEMENT_CATEGORIES as category (category)}
          {@const voxels = structure.voxels[VOXELS[category]]}
          <li class="network-row">
            <Swatch colour={rgb(category)} />
            <span class="network-row-name">{copy.category[category]}</span>
            <Swatch kind="bar" share={voxels / total} />
            <span class="network-share measure"
              >{quantity(voxels * agreement!.voxel_volume_mm3, 'mm³', lang)}</span
            >
          </li>
        {/each}
      </ul>
      <p class="network-map measure">
        {copy.dice(decimal(agreementDice(structure.voxels), 2, lang))}
      </p>
      <div class="actions">
        <button
          type="button"
          onclick={(event) => onshow(structure.code, { instant: isKeyboardActivation(event) })}
        >
          {copy.show}
        </button>
      </div>
      <p class="detail-note">{copy.note(union)}</p>
    </Disclosure>
  </div>
{/if}
