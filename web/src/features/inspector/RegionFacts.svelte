<!--
  The datasheet (index.html:359-363, inspector.js:314-320): the metric by region kind, the centroid
  and the source label. A description list, not a table: it has one dimension.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import { formatRas, quantity } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import SourceLabel from './SourceLabel.svelte';

  let {
    region,
    lang,
    centroid,
  }: {
    region: Region & { atlas: string };
    lang: Language;
    /** RAS millimetres, or null where the model has no centroid. */
    centroid: readonly number[] | null;
  } = $props();

  const copy = $derived(t(lang, 'inspector'));
  // A structure or a cut region is measured by its volume; a cortical area by its surface.
  const byVolume = $derived(region.kind === 'structure' || region.kind === 'tissue-region');
</script>

<dl class="facts">
  <dt>{byVolume ? copy.volume : copy.surfaceArea}</dt>
  <dd class="fact-metric measure">
    {byVolume
      ? quantity(region.segmentation_volume_mm3, 'mm³', lang)
      : quantity(region.surface_area_mm2, 'mm²', lang)}
  </dd>
  <dt>{copy.centroid}</dt>
  <dd class="measure">{centroid ? formatRas(centroid, lang) : '—'}</dd>
  {#key `${region.id}:${lang}`}
    <SourceLabel {region} {lang} />
  {/key}
</dl>
