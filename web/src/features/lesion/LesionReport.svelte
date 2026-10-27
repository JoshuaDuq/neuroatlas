<!--
  The lesion's report, Anatomy's detail while no region is selected: what the placed sphere covers of
  each tissue, the regions, gyral white matter and tracts it reaches with the share of each inside it,
  then the findings that cite those regions. It measures overlap and says so; it predicts nothing.
  The sections reuse the inspector's ruled disclosures and share bars.
-->
<script lang="ts">
  import '../inspector/inspector.css';
  import { count, decimal, grouped, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { lesionSides, regionRows, tractRows } from '../../lib/core/lesion/report.ts';
  import type { RegionRow } from '../../lib/core/lesion/report.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    lesion,
    lang,
    atlases,
    label,
    bundleName,
    deficitName,
    paintShown,
    onPaint,
    onFinding,
  }: {
    lesion: LesionStore;
    lang: Language;
    /** The cortical atlases measured, the one on screen first. */
    atlases: readonly { id: string; name: string }[];
    /** A region's name as the panel words it. */
    label: (id: string) => string;
    bundleName: (id: string) => string;
    deficitName: (id: string) => string;
    /** The findings are on the brain now: asked for, and not covered by a masthead colour. */
    paintShown: boolean;
    onPaint: (shown: boolean) => void;
    /** Open a finding in its deficit's profile. */
    onFinding: (deficit: string, finding: string) => void;
  } = $props();

  const copy = $derived(t(lang, 'lesion'));
  const sphere = $derived(lesion.sphere!);
  const measured = $derived(lesion.measured);
  const measurement = $derived(measured?.status === 'ready' ? measured.measurement : null);
  const sides = $derived(measurement && lesionSides(measurement.regions));

  let atlas = $state<string | null>(null);
  const shownAtlas = $derived(atlas ?? atlases[0]!.id);
  let cortexOpen = $state(true);
  let deepOpen = $state(false);
  let whiteOpen = $state(false);
  let tractsOpen = $state(false);
  let findingsOpen = $state(true);

  const cortex = $derived(measurement && regionRows(measurement.regions, shownAtlas));
  const deep = $derived(measurement && regionRows(measurement.regions, 'aseg'));
  const white = $derived(measurement && regionRows(measurement.regions, 'wmparc'));
  const counted = $derived(lesion.counted);
  const tracts = $derived(counted.status === 'ready' ? tractRows(counted.crossings) : null);
  const findings = $derived(lesion.findings);
  const colours = $derived(
    new Map(paintShown ? lesion.paint?.rows.map((row) => [row.id, row.color]) : []),
  );

  /** A share as a percentage: whole above 10%, to a tenth below, where the small ones differ. */
  const share = (fraction: number) =>
    withUnit(decimal(fraction * 100, fraction < 0.1 ? 1 : 0, lang, { trim: true }), '%', lang);
  const cm3 = (mm3: number) => decimal(mm3 / 1000, 1, lang);
  const mm3 = (value: number) => withUnit(grouped(Math.round(value)), 'mm³', lang);
</script>

{#snippet rows(list: readonly RegionRow[])}
  <ul class="network-list">
    {#each list as row (row.id)}
      <li class="network-row lesion-row">
        <span class="network-row-name">
          {label(row.id)}
          <span class="lesion-row-volume">{mm3(row.inside)} / {mm3(row.whole)}</span>
        </span>
        <Swatch kind="bar" share={row.share} />
        <span class="network-share measure">{share(row.share)}</span>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet folded(list: readonly RegionRow[])}
  {#if list.length}
    <Disclosure summary={copy.slightRegions(grouped(list.length))}>
      {@render rows(list)}
    </Disclosure>
  {/if}
{/snippet}

<div class="region-detail lesion-report">
  <div class="selection-head">
    <h2 class="region-name">{copy.title}</h2>
  </div>
  <p class="selection-context">
    {copy.meta(
      sides ? copy.sides[sides] : '—',
      withUnit(grouped(sphere.radius), 'mm', lang),
      withUnit(measurement ? cm3(measurement.volume) : '—', 'cm³', lang),
    )}
  </p>
  <p class="selected-hint">{copy.caveat}</p>
  <div class="actions">
    <button type="button" onclick={lesion.remove}>{copy.remove}</button>
  </div>

  {#if measured?.status === 'measuring'}
    <p class="detail-note" role="status">{copy.measuring}</p>
  {:else if measured?.status === 'error'}
    <p class="detail-note lesion-error" role="alert">{copy.failed}</p>
  {/if}

  {#if measurement}
    <p class="network-map">{copy.volumeCaption}</p>
    <dl class="lesion-tissue">
      {#each Object.entries(measurement.tissue).filter(([, volume]) => volume > 0) as [tissue, volume] (tissue)}
        <div>
          <dt>{copy.tissue[tissue as keyof typeof copy.tissue]}</dt>
          <dd class="measure">{cm3(volume)}</dd>
        </div>
      {/each}
    </dl>

    <div class="evidence-section">
      <Disclosure
        variant="section"
        summary={`${copy.cortex} · ${count(cortex!.shown.length + cortex!.slight.length, 'region', lang)}`}
        bind:open={cortexOpen}
      >
        {#if atlases.length > 1}
          <div class="lesion-atlases" role="group" aria-label={copy.cortex}>
            {#each atlases as choice (choice.id)}
              <button
                type="button"
                aria-pressed={choice.id === shownAtlas}
                onclick={() => (atlas = choice.id)}>{choice.name}</button
              >
            {/each}
          </div>
        {/if}
        <p class="detail-note">{copy.shareNote}</p>
        {@render rows(cortex!.shown)}
        {@render folded(cortex!.slight)}
      </Disclosure>
    </div>

    {#if deep!.shown.length + deep!.slight.length}
      <div class="evidence-section">
        <Disclosure
          variant="section"
          summary={`${copy.deep} · ${count(deep!.shown.length + deep!.slight.length, 'region', lang)}`}
          bind:open={deepOpen}
        >
          {@render rows(deep!.shown)}
          {@render folded(deep!.slight)}
        </Disclosure>
      </div>
    {/if}

    {#if white!.shown.length + white!.slight.length}
      <div class="evidence-section">
        <Disclosure
          variant="section"
          summary={`${copy.white} · ${count(white!.shown.length + white!.slight.length, 'region', lang)}`}
          bind:open={whiteOpen}
        >
          <p class="detail-note">{copy.whiteNote}</p>
          {@render rows(white!.shown)}
          {@render folded(white!.slight)}
        </Disclosure>
      </div>
    {/if}

    <div class="evidence-section">
      <Disclosure variant="section" summary={copy.tracts} bind:open={tractsOpen}>
        {@const bundles = lesion.bundles}
        {#if !bundles.length}
          <p class="detail-note">{copy.noTracts}</p>
        {:else if counted.status === 'idle'}
          <div class="actions">
            <button type="button" onclick={lesion.countTracts}>
              {copy.countTracts(count(bundles.length, 'bundle', lang))}
            </button>
          </div>
          <p class="detail-note">{copy.tractsDownload}</p>
        {:else if counted.status === 'counting'}
          <p class="detail-note" role="status">
            {copy.counting(
              grouped(Math.min(counted.counted + 1, counted.total)),
              grouped(counted.total),
            )}
          </p>
        {:else if counted.status === 'error'}
          <p class="detail-note lesion-error" role="alert">{copy.tractsFailed}</p>
        {:else if tracts}
          <p class="detail-note">{copy.tractsNote}</p>
          <ul class="network-list">
            {#each tracts.crossed as bundle (bundle.id)}
              <li class="network-row lesion-row">
                <span class="network-row-name">
                  {bundleName(bundle.id)}
                  <span class="lesion-row-volume">
                    {copy.ofTotal(grouped(bundle.crossing), grouped(bundle.total))}
                  </span>
                </span>
                <Swatch kind="bar" share={bundle.share} />
                <span class="network-share measure">{share(bundle.share)}</span>
              </li>
            {/each}
          </ul>
          {#if tracts.missed.length}
            <p class="detail-note">{copy.notReached(tracts.missed.map(bundleName).join(', '))}</p>
          {/if}
        {/if}
      </Disclosure>
    </div>

    <div class="evidence-section">
      <Disclosure
        variant="section"
        summary={`${copy.findings} · ${grouped((findings?.shown.length ?? 0) + (findings?.slight.length ?? 0))}`}
        bind:open={findingsOpen}
      >
        <p class="detail-note">{copy.findingsNote}</p>
        {#if findings?.shown.length}
          <div class="actions">
            <button type="button" aria-pressed={paintShown} onclick={() => onPaint(!paintShown)}>
              {paintShown ? copy.hideOnBrain : copy.showOnBrain}
            </button>
          </div>
          <ul class="lesion-findings">
            {#each findings.shown as finding (finding.association.id)}
              {@const colour = colours.get(finding.association.id)}
              <li>
                <p class="lesion-finding-deficit">{deficitName(finding.association.deficit)}</p>
                <p class="lesion-finding-title">
                  {#if colour}<Swatch colour={networkCss(colour)} />{/if}
                  {finding.association.title[lang]}
                </p>
                <p class="lesion-finding-reach">
                  {finding.reached
                    .map((reach) => `${label(reach.region)} ${share(reach.share)}`)
                    .join(', ')} · {copy.cited(grouped(finding.reached.length), finding.cited)}
                </p>
                {#if finding.oneSide}
                  <p class="detail-note">{copy.oneSide[finding.oneSide]}</p>
                {/if}
                <p class="detail-note">{finding.association.mapping_note[lang]}</p>
                <button
                  type="button"
                  class="lesion-finding-open"
                  onclick={() => onFinding(finding.association.deficit, finding.association.id)}
                >
                  {copy.openFinding}
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="detail-note">{copy.noFindings}</p>
        {/if}
        {#if findings?.slight.length}
          <Disclosure summary={copy.slightFindings(grouped(findings.slight.length))}>
            <ul class="lesion-findings">
              {#each findings.slight as finding (finding.association.id)}
                <li>
                  <p class="lesion-finding-deficit">{deficitName(finding.association.deficit)}</p>
                  <p class="lesion-finding-title">{finding.association.title[lang]}</p>
                  <p class="lesion-finding-reach">
                    {finding.reached
                      .map((reach) => `${label(reach.region)} ${share(reach.share)}`)
                      .join(', ')}
                  </p>
                </li>
              {/each}
            </ul>
          </Disclosure>
        {/if}
        <p class="detail-note">{copy.unmeasured}</p>
      </Disclosure>
    </div>
  {/if}
</div>

<style>
  @layer features {
    .lesion-report .lesion-error {
      color: var(--danger);
    }
    .lesion-tissue {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
      gap: var(--space-2) var(--space-3);
      margin: 0 0 var(--space-4);
      padding: var(--space-2) 0;
      border-block: 1px solid var(--border-subtle);
    }
    /* A label that wraps keeps every value on one line across the row. */
    .lesion-tissue > div {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .lesion-tissue dt {
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .lesion-tissue dd {
      margin: 0;
      font-size: var(--text-title);
      font-weight: 600;
      line-height: var(--lh-title);
    }
    /* No swatch: the region names itself, the bar measures it. */
    .lesion-report :global(.network-row.lesion-row) {
      grid-template-columns: minmax(0, 1fr) minmax(32px, 56px) 3rem;
    }
    .lesion-row-volume {
      display: block;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-tertiary);
      font-variant-numeric: tabular-nums;
    }
    .lesion-atlases {
      display: inline-flex;
      gap: 2px;
      margin: var(--space-1) 0 var(--space-1);
      padding: 2px;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
    }
    .lesion-atlases button {
      min-height: calc(var(--control-height) - 4px);
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-small);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      cursor: pointer;
    }
    .lesion-atlases button[aria-pressed='true'] {
      background: var(--surface-raised);
      box-shadow: inset 0 0 0 1px var(--thumb-ring);
      color: var(--text-primary);
      font-weight: 500;
    }
    .lesion-findings {
      margin: var(--space-2) 0 0;
      padding: 0;
      list-style: none;
    }
    .lesion-findings > li {
      padding: var(--space-3) 0;
      border-top: 1px solid var(--border-subtle);
    }
    .lesion-findings p {
      margin: 0;
    }
    .lesion-finding-deficit {
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .lesion-finding-title {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
    }
    .lesion-finding-reach {
      margin-top: var(--space-1);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .lesion-finding-open {
      margin-top: var(--space-2);
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-ui);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .lesion-finding-open:hover {
        color: var(--accent-hover);
        text-decoration: underline;
      }
    }
  }
</style>
