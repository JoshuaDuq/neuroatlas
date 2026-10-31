<!--
  The lesion's report, Anatomy's detail while no region is selected. It leads with what the lesion
  reaches, under the groups the Functions and Deficits tabs share: the functions whose territories
  it overlaps and the deficits whose findings cite a region inside it, each opening its own tab. The
  brain shows the lesion alone, those functions' territories or those findings' regions. The anatomy
  it was measured on folds away underneath. It measures overlap and says so; it predicts nothing.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import '../inspector/inspector.css';
  import './report.css';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import { count, decimal, grouped, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    lesionSides,
    regionRows,
    sharePercent,
    territoryRows,
  } from '../../lib/core/lesion/report.ts';
  import type { RegionRow } from '../../lib/core/lesion/report.ts';
  import type { LesionMode, LesionStore } from '../../lib/state/lesion.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';
  import SphereTracts from './SphereTracts.svelte';

  let {
    lesion,
    lang,
    atlases,
    label,
    bundleName,
    functionName,
    groupName,
    deficitName,
    mode,
    onMode,
    onFunction,
    onDeficit,
    onFinding,
  }: {
    lesion: LesionStore;
    lang: Language;
    /** The cortical atlases measured, the one on screen first. */
    atlases: readonly { id: string; name: string }[];
    /** A region's name as the panel words it. */
    label: (id: string) => string;
    bundleName: (id: string) => string;
    functionName: (id: string) => string;
    groupName: (id: string) => string;
    deficitName: (id: string) => string;
    /** What colours the brain now: the chosen mode, or the lesion alone under a masthead colour. */
    mode: LesionMode;
    onMode: (mode: LesionMode) => void;
    /** Open a function, a deficit, or one finding in its deficit's profile. */
    onFunction: (id: string) => void;
    onDeficit: (id: string) => void;
    onFinding: (deficit: string, finding: string) => void;
  } = $props();

  const uid = $props.id();
  const modeLabelId = `lesion-mode-${uid}`;

  const copy = $derived(t(lang, 'lesion'));
  const sphere = $derived(lesion.sphere!);
  const measured = $derived(lesion.measured);
  const measurement = $derived(measured?.status === 'ready' ? measured.measurement : null);
  const sides = $derived(measurement && lesionSides(measurement.regions));
  const modes = $derived(
    (['lesion', 'functions', 'deficits'] as const).map((value) => ({
      value,
      label: copy.modes[value],
    })),
  );

  let atlas = $state<string | null>(null);
  const shownAtlas = $derived(atlas ?? atlases[0]!.id);
  let anatomyOpen = $state(false);
  let deepOpen = $state(false);
  let whiteOpen = $state(false);
  let territoriesOpen = $state(false);
  // Open on a report that comes back while its streamlines are drawn, so the drawn row is in view.
  let tractsOpen = $state(untrack(() => lesion.selectedTract !== null));
  let detailOpen = $state(false);

  const cortex = $derived(measurement && regionRows(measurement.regions, shownAtlas));
  const deep = $derived(measurement && regionRows(measurement.regions, 'aseg'));
  const white = $derived(measurement && regionRows(measurement.regions, 'wmparc'));
  const territories = $derived(measurement && territoryRows(measurement.regions));
  const findings = $derived(lesion.findings);
  const profile = $derived(lesion.profile);
  // Each row's colour while its kind is on the brain.
  const colours = $derived(
    new Map(
      mode !== 'lesion' && lesion.paint?.kind === mode
        ? lesion.paint.rows.map((row) => [row.id, networkCss(row.color)])
        : [],
    ),
  );
  // Territory shares are small beside a whole function, so the bars compare the functions with one another.
  const topShare = $derived(
    Math.max(0, ...(profile ?? []).flatMap((entry) => entry.functions.map((row) => row.share))),
  );
  /** Functions shown under each group before the rest fold. */
  const LEADING = 3;

  const share = (fraction: number) => sharePercent(fraction, lang);
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

{#snippet territoryList(list: readonly RegionRow[])}
  <!-- A territory row's share is of the lesion, not of the territory, so only the lesion's volume in it is shown. -->
  <ul class="network-list">
    {#each list as row (row.id)}
      <li class="network-row lesion-row">
        <span class="network-row-name">
          {label(row.id)}
          <span class="lesion-row-volume">{mm3(row.inside)}</span>
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

{#snippet functionRow(row: { id: string; share: number })}
  <li>
    <button type="button" class="lesion-target" onclick={() => onFunction(row.id)}>
      <span class="lesion-key">
        {#if colours.has(row.id)}<Swatch colour={colours.get(row.id)!} />{/if}
      </span>
      <span class="lesion-target-name">{functionName(row.id)}</span>
      <Swatch kind="bar" share={row.share / topShare} />
      <span class="network-share measure">{share(row.share)}</span>
    </button>
  </li>
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
  <!-- Before any share: what follows measures overlap on this brain and predicts nothing. -->
  <p class="detail-note">{copy.caveat}</p>
  <div class="actions">
    <button type="button" onclick={lesion.remove}>{copy.remove}</button>
  </div>

  <p id={modeLabelId} class="lesion-label">{copy.onBrain}</p>
  <ChoiceGroup
    labelledby={modeLabelId}
    class="lesion-modes"
    options={modes}
    bind:value={() => mode, onMode}
  />

  {#if measured?.status === 'measuring'}
    <p class="detail-note" role="status">{copy.measuring}</p>
  {:else if measured?.status === 'error'}
    <p class="detail-note lesion-error" role="alert">{copy.failed}</p>
  {/if}

  {#if measurement && profile && findings}
    <h3 class="lesion-heading">{copy.reaches}</h3>
    <p class="detail-note">{copy.reachesNote}</p>
    {#if !profile.length}
      <p class="detail-note">{copy.nothingReached}</p>
    {/if}
    {#each profile as entry (entry.group)}
      <section class="lesion-group" aria-labelledby="lesion-group-{uid}-{entry.group}">
        <h4 id="lesion-group-{uid}-{entry.group}">{groupName(entry.group)}</h4>
        {#if entry.functions.length}
          <p class="lesion-label">{copy.functionsLabel}</p>
          <ul class="lesion-targets">
            {#each entry.functions.slice(0, LEADING) as row (row.id)}
              {@render functionRow(row)}
            {/each}
          </ul>
          {#if entry.functions.length > LEADING}
            <Disclosure summary={copy.more(grouped(entry.functions.length - LEADING))}>
              <ul class="lesion-targets">
                {#each entry.functions.slice(LEADING) as row (row.id)}
                  {@render functionRow(row)}
                {/each}
              </ul>
            </Disclosure>
          {/if}
        {/if}
        {#if entry.deficits.length}
          <p class="lesion-label">{copy.deficitsLabel}</p>
          <ul class="lesion-targets">
            {#each entry.deficits as row (row.deficit)}
              <li>
                <button type="button" class="lesion-target" onclick={() => onDeficit(row.deficit)}>
                  <span class="lesion-key">
                    {#each row.findings.filter( (finding) => colours.has(finding.association.id) ) as finding (finding.association.id)}
                      <Swatch colour={colours.get(finding.association.id)!} />
                    {/each}
                  </span>
                  <span class="lesion-target-name">
                    {deficitName(row.deficit)}
                    <span class="lesion-row-volume">
                      {copy.deficitReach(
                        count(row.findings.length, 'finding', lang),
                        share(row.share),
                      )}
                    </span>
                  </span>
                  <span class="lesion-chevron" aria-hidden="true"></span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
    {#if lesion.functions?.slight.length}
      <p class="detail-note">{copy.slightFunctions(grouped(lesion.functions.slight.length))}</p>
    {/if}

    <div class="evidence-section lesion-first-section">
      <Disclosure
        variant="section"
        summary={`${copy.findingsDetail} · ${grouped(findings.shown.length + findings.slight.length)}`}
        bind:open={detailOpen}
      >
        <p class="detail-note">{copy.findingsNote}</p>
        {#if findings.shown.length}
          <ul class="lesion-findings">
            {#each findings.shown as finding (finding.association.id)}
              {@const colour = colours.get(finding.association.id)}
              <li>
                <p class="lesion-finding-deficit">{deficitName(finding.association.deficit)}</p>
                <p class="lesion-finding-title">
                  {#if colour}<Swatch {colour} />{/if}
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
        {#if findings.slight.length}
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

    <div class="evidence-section">
      <Disclosure
        variant="section"
        summary={`${copy.anatomy} · ${count(cortex!.shown.length + cortex!.slight.length, 'region', lang)}`}
        bind:open={anatomyOpen}
      >
        <p class="network-map">{copy.volumeCaption}</p>
        <dl class="lesion-tissue">
          {#each Object.entries(measurement.tissue).filter(([, volume]) => volume > 0) as [tissue, volume] (tissue)}
            <div>
              <dt>{copy.tissue[tissue as keyof typeof copy.tissue]}</dt>
              <dd class="measure">{cm3(volume)}</dd>
            </div>
          {/each}
        </dl>
        <p class="network-map">{copy.cortex}</p>
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

    {#if territories!.shown.length + territories!.slight.length}
      <div class="evidence-section">
        <Disclosure
          variant="section"
          summary={`${copy.territories} · ${count(territories!.shown.length + territories!.slight.length, 'region', lang)}`}
          bind:open={territoriesOpen}
        >
          <p class="detail-note">{copy.territoryNote}</p>
          {@render territoryList(territories!.shown)}
          {#if territories!.slight.length}
            <Disclosure summary={copy.slightRegions(grouped(territories!.slight.length))}>
              {@render territoryList(territories!.slight)}
            </Disclosure>
          {/if}
        </Disclosure>
      </div>
    {/if}

    <div class="evidence-section">
      <Disclosure variant="section" summary={copy.tracts} bind:open={tractsOpen}>
        <SphereTracts {lesion} {lang} {bundleName} {copy} />
      </Disclosure>
    </div>
  {/if}
</div>

<style>
  @layer features {
    .lesion-label {
      margin: var(--space-4) 0 var(--space-2);
      font-size: var(--text-caption);
      font-weight: 500;
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    :global(.segmented.choice-group.lesion-modes) {
      width: 100%;
    }
    :global(.segmented.choice-group.lesion-modes [role='radio']) {
      flex: 1;
      min-width: 0;
      padding: 0 var(--space-2);
      white-space: normal;
    }
    /* One ruled block per group, the group named as the two tabs name it. */
    .lesion-group {
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-subtle);
    }
    .lesion-group h4 {
      margin: 0;
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    .lesion-group .lesion-label {
      margin: var(--space-2) 0 var(--space-1);
    }
    .lesion-targets {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    /* A row opens its function or deficit: its key, its name, then its measure. */
    .lesion-target {
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr) minmax(32px, 56px) 3rem;
      align-items: start;
      gap: var(--space-2);
      width: calc(100% + 2 * var(--space-2));
      min-height: var(--row-height);
      margin: 0 calc(-1 * var(--space-2));
      padding: calc((var(--row-height) - var(--lh-ui)) / 2) var(--space-2);
      border: 0;
      border-radius: var(--radius-small);
      background: none;
      color: var(--text-primary);
      font: inherit;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      text-align: left;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .lesion-target:hover {
        background: var(--surface-hover);
      }
    }
    .lesion-target :global(.network-share) {
      text-align: right;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .lesion-key {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 5px;
    }
    .lesion-target-name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .lesion-target:has(.lesion-chevron) {
      grid-template-columns: 10px minmax(0, 1fr) 12px;
    }
    .lesion-chevron {
      width: 6px;
      height: 6px;
      margin-top: 7px;
      border-right: 1.5px solid var(--text-tertiary);
      border-bottom: 1.5px solid var(--text-tertiary);
      transform: rotate(-45deg);
    }
    .lesion-tissue {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
      gap: var(--space-2) var(--space-3);
      margin: 0 0 var(--space-2);
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
