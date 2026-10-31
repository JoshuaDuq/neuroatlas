<!--
  A published coordinate's report, Anatomy's detail while its sphere is placed and no region is
  selected. It says what was entered and where registration carried it on this brain, then what lies
  within the sphere as shares of the sphere, never one parcel as the coordinate's label. A coordinate
  is usually an activation peak, so no function, deficit or finding is attached to it.
-->
<script lang="ts">
  import '../inspector/inspector.css';
  import './report.css';
  import { networkName } from '../../lib/core/catalog/networks.ts';
  import {
    coordinateCsv,
    flattened,
    networkShares,
    sphereShares,
  } from '../../lib/core/coordinates/report.ts';
  import type { ShareRow, SphereShares } from '../../lib/core/coordinates/report.ts';
  import { UNSTATED, readIn } from '../../lib/core/coordinates/spaces.ts';
  import { decimal, formatRas, grouped, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { sharePercent } from '../../lib/core/lesion/report.ts';
  import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
  import type { CoordinateSpaces, Language } from '../../lib/types/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';
  import { downloadText } from '../tracts/download.ts';
  import SphereTracts from './SphereTracts.svelte';

  let {
    lesion,
    lang,
    spaces,
    anatomy,
    atlases,
    networks,
    territories,
    label,
    bundleName,
    networksOf,
  }: {
    lesion: LesionStore;
    lang: Language;
    spaces: CoordinateSpaces;
    anatomy: string;
    /** The cortical atlases measured, the one on screen first. */
    atlases: readonly { id: string; name: string }[];
    /** The network layer and the atlas whose parcels it assigns, or null when none is published. */
    networks: { id: string; atlas: string } | null;
    /** The arterial territory atlas, or null when none is published. */
    territories: string | null;
    /** A region's name as the panel words it. */
    label: (id: string) => string;
    bundleName: (id: string) => string;
    networksOf: (id: string) => readonly { network: string; fraction: number }[] | undefined;
  } = $props();

  const copy = $derived(t(lang, 'coordinate'));
  const lesionCopy = $derived(t(lang, 'lesion'));
  const sphere = $derived(lesion.sphere!);
  const coordinate = $derived(lesion.coordinate!);
  const unstated = $derived(coordinate.space === UNSTATED);
  const space = $derived(readIn(spaces, coordinate.space));
  const spaceLabel = $derived(unstated ? copy.unstated : space.label);
  const radius = $derived(withUnit(grouped(sphere.radius), 'mm', lang));
  const measured = $derived(lesion.measured);
  const measurement = $derived(measured?.status === 'ready' ? measured.measurement : null);
  const tractCopy = $derived({
    ...lesionCopy,
    ...copy.tracts,
    tractsNote: copy.tracts.tractsNote(radius),
  });

  let atlas = $state<string | null>(null);
  const shownAtlas = $derived(atlas ?? atlases[0]!.id);
  let cortexOpen = $state(true);
  let networksOpen = $state(false);
  let deepOpen = $state(false);
  let territoriesOpen = $state(false);
  let tractsOpen = $state(false);

  const shares = $derived.by(() => {
    if (!measurement) return null;
    const { regions, volume, tissueOf } = measurement;
    return {
      cortex: new Map(atlases.map(({ id }) => [id, sphereShares(regions, id, volume)])),
      networks: networks && networkShares(regions, networks.atlas, volume, networksOf),
      deep: sphereShares(regions, 'aseg', volume, (id) => tissueOf.get(id) === 'deep'),
      territories: territories && sphereShares(regions, territories, volume),
    };
  });
  // Named only for deep grey: one cortical parcel is never the coordinate's label.
  const landing = $derived(
    measurement && {
      tissue: lesionCopy.tissue[measurement.centre.tissue],
      structure:
        measurement.centre.tissue === 'deep' && measurement.centre.region?.startsWith('aseg:')
          ? label(measurement.centre.region)
          : null,
    },
  );

  const share = (fraction: number) => sharePercent(fraction, lang);
  const mm3 = (value: number) => withUnit(grouped(Math.round(value)), 'mm³', lang);
  const millimetres = (value: number) => withUnit(decimal(value, 1, lang), 'mm', lang);
  /** The numbers as entered, in the reader's notation. */
  const entered = $derived(
    withUnit(
      coordinate.entered
        .map((value) => decimal(value, 3, lang, { trim: true }))
        .join(lang === 'fr' ? ' ; ' : ', '),
      'mm',
      lang,
    ),
  );
  const reached = (spread: SphereShares) => spread.shown.length + spread.slight.length > 0;
  // What no row covers, kept while it is a whole mm³ of the sphere.
  const rest = (spread: SphereShares) =>
    measurement && Math.round(spread.rest * measurement.volume) > 0 ? spread.rest : null;

  function download() {
    const { volume, centre } = measurement!;
    const rows = (atlasId: string, spread: SphereShares, name: (id: string) => string) => [
      ...[...spread.shown, ...spread.slight].map((row) => ({
        atlas: atlasId,
        id: row.id,
        name: name(row.id),
        share: row.share,
      })),
      { atlas: atlasId, id: '', name: copy.restCsv, share: spread.rest },
    ];
    const { cortex, networks: byNetwork, deep, territories: byTerritory } = shares!;
    const csv = coordinateCsv(
      [
        ['entered_mni_mm', coordinate.entered.join(', ')],
        ['space', coordinate.space],
        ['space_label', spaceLabel],
        ...(unstated ? [['read_as', space.id] as const] : []),
        ['landing_surface_ras_mm', sphere.centre.join(', ')],
        ['landing_tissue', centre.tissue],
        ['landing_structure', landing!.structure ?? ''],
        ['radius_mm', sphere.radius],
        ['sphere_volume_mm3', volume],
        ['template_citation', space.citation],
        ['template_doi', space.doi],
        ['template_license', space.license],
        ['template_copyright', space.copyright],
        ...flattened('registration', space.registration),
        ...(unstated
          ? spaces.unstated.alternatives.flatMap((alternative) =>
              flattened(`unstated.${alternative.id}`, alternative.against[space.id]),
            )
          : []),
        ['method', spaces.method],
        ['anatomy', anatomy],
      ],
      [
        ...atlases.flatMap(({ id }) => rows(id, cortex.get(id)!, label)),
        ...(byNetwork ? rows(networks!.id, byNetwork, (id) => networkName(id, lang)) : []),
        ...rows('aseg', deep, label),
        ...(byTerritory ? rows(territories!, byTerritory, label) : []),
      ],
    );
    downloadText(
      csv,
      `planum-coordinate-${anatomy}-${coordinate.entered.join('_')}.csv`,
      'text/csv;charset=utf-8',
    );
  }
</script>

{#snippet list(spread: SphereShares, name: (id: string) => string)}
  {@const remainder = rest(spread)}
  <ul class="network-list">
    {#each spread.shown as row (row.id)}
      {@render shareRow(row, name(row.id))}
    {/each}
    {#if remainder !== null}
      <li class="network-row lesion-row coordinate-rest">
        <span class="network-row-name">{copy.rest}</span>
        <Swatch kind="bar" share={remainder} />
        <span class="network-share measure">{share(remainder)}</span>
      </li>
    {/if}
  </ul>
  {#if spread.slight.length}
    <Disclosure summary={lesionCopy.slightRegions(grouped(spread.slight.length))}>
      <ul class="network-list">
        {#each spread.slight as row (row.id)}
          {@render shareRow(row, name(row.id))}
        {/each}
      </ul>
    </Disclosure>
  {/if}
{/snippet}

{#snippet shareRow(row: ShareRow, name: string)}
  <li class="network-row lesion-row">
    <span class="network-row-name">
      {name}
      <span class="lesion-row-volume">{mm3(row.inside)}</span>
    </span>
    <Swatch kind="bar" share={row.share} />
    <span class="network-share measure">{share(row.share)}</span>
  </li>
{/snippet}

<div class="region-detail lesion-report coordinate-report">
  <div class="selection-head">
    <h2 class="region-name">{copy.reportTitle}</h2>
  </div>
  <p class="selection-context">{copy.entered(entered, spaceLabel)}</p>
  <p class="coordinate-fact">{copy.landed(formatRas(sphere.centre, lang))}</p>
  {#if landing}
    <p class="coordinate-fact">
      {copy.at}: {landing.tissue}{landing.structure ? ` · ${landing.structure}` : ''}
    </p>
  {/if}
  {#if unstated}
    <p class="detail-note">{copy.readsAs(space.label)}</p>
    <p class="detail-note">{copy.alternativesNote}</p>
    <ul class="coordinate-alternatives">
      {#each spaces.unstated.alternatives as alternative (alternative.id)}
        {@const offset = alternative.against[space.id]!.cortex_offset_mm}
        <li title={alternative.description}>
          {copy.alternative(alternative.label, millimetres(offset.median), millimetres(offset.p95))}
        </li>
      {/each}
    </ul>
  {/if}
  <!-- Before any share: what follows is a template location on this brain, not this brain's function. -->
  <p class="detail-note">{copy.caveat}</p>
  <div class="actions">
    <button type="button" onclick={lesion.remove}>{lesionCopy.remove}</button>
    <button type="button" disabled={!shares} onclick={download}>{copy.download}</button>
  </div>

  {#if measured?.status === 'measuring'}
    <p class="detail-note" role="status">{lesionCopy.measuring}</p>
  {:else if measured?.status === 'error'}
    <p class="detail-note lesion-error" role="alert">{copy.failedMeasure}</p>
  {/if}

  {#if shares}
    <h3 class="lesion-heading">{copy.within(radius)}</h3>
    <p class="detail-note">{copy.shareNote}</p>

    <div class="evidence-section lesion-first-section">
      <Disclosure variant="section" summary={lesionCopy.cortex} bind:open={cortexOpen}>
        {#if atlases.length > 1}
          <div class="lesion-atlases" role="group" aria-label={lesionCopy.cortex}>
            {#each atlases as choice (choice.id)}
              <button
                type="button"
                aria-pressed={choice.id === shownAtlas}
                onclick={() => (atlas = choice.id)}>{choice.name}</button
              >
            {/each}
          </div>
        {/if}
        {@render list(shares.cortex.get(shownAtlas)!, label)}
      </Disclosure>
    </div>

    {#if shares.networks}
      <div class="evidence-section">
        <Disclosure variant="section" summary={copy.networks} bind:open={networksOpen}>
          {@render list(shares.networks, (id) => networkName(id, lang))}
          <p class="detail-note">{t(lang, 'networks').caveat}</p>
        </Disclosure>
      </div>
    {/if}

    <!-- A section the sphere reaches no region of is left out; the CSV still gives its whole share. -->
    {#if reached(shares.deep)}
      <div class="evidence-section">
        <Disclosure variant="section" summary={copy.deep} bind:open={deepOpen}>
          {@render list(shares.deep, label)}
        </Disclosure>
      </div>
    {/if}

    {#if shares.territories && reached(shares.territories)}
      <div class="evidence-section">
        <Disclosure variant="section" summary={lesionCopy.territories} bind:open={territoriesOpen}>
          <p class="detail-note">{copy.territoryNote}</p>
          {@render list(shares.territories, label)}
        </Disclosure>
      </div>
    {/if}

    <div class="evidence-section">
      <Disclosure variant="section" summary={copy.tracts.tracts(radius)} bind:open={tractsOpen}>
        <SphereTracts {lesion} {lang} {bundleName} copy={tractCopy} />
      </Disclosure>
    </div>
  {/if}
</div>

<style>
  @layer features {
    .coordinate-fact {
      margin: var(--space-1) 0 0;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      font-variant-numeric: tabular-nums;
    }
    .coordinate-alternatives {
      margin: var(--space-1) 0 0;
      padding-left: var(--space-4);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    /* What no region covers reads apart from the regions. */
    .coordinate-rest .network-row-name {
      color: var(--text-secondary);
    }
  }
</style>
