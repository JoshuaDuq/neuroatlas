<!--
  Receptor densities: the autoradiographic fingerprint published for the area or structure this
  region is named after, by transmitter. Each row is a receptor's symbol, a bar (the share of that
  receptor's highest mean among the published fingerprints) and its mean ± SD. An area sampled in
  two parts offers the parts as a segmented choice. Only a region with a fingerprint has the
  section; it stays mounted so its open state and part survive from one selection to the next.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import {
    fingerprintGroups,
    fingerprintsOf,
    receptorText,
    transmitterName,
    unmeasured,
    type Fingerprint,
    type ReceptorFingerprints,
    type SymbolPart,
  } from '../../lib/core/catalog/receptor-fingerprints.ts';
  import { grouped } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    receptors,
  }: {
    region: Region | null;
    lang: Language;
    receptors: ReceptorFingerprints | null;
  } = $props();

  type Part = NonNullable<Fingerprint['part']>;
  let open = $state(false);
  let part = $state<Part>('dorsal');

  const copy = $derived(t(lang, 'receptors'));
  const fingerprints = $derived(region ? fingerprintsOf(receptors, region.id) : []);
  const fingerprint = $derived(
    fingerprints.length > 1
      ? fingerprints.find((candidate) => candidate.part === part)!
      : fingerprints[0],
  );
  const groups = $derived(fingerprint ? fingerprintGroups(receptors!, fingerprint) : []);
  const rows = $derived(groups.flatMap((group) => group.rows));
  const missing = $derived(fingerprint ? unmeasured(receptors!, fingerprint) : []);
  const ages = $derived.by(() => {
    if (!fingerprint) return '';
    const years = fingerprint.donors.map((donor) => donor.age_years);
    const [low, high] = [Math.min(...years), Math.max(...years)];
    return low === high ? `${low}` : `${low}–${high}`;
  });
  const sources = $derived(
    fingerprint ? fingerprint.documented_by.map((key) => receptors!.sources[key]!) : [],
  );
  const partOptions = $derived(
    (['dorsal', 'ventral'] as const).map((value) => ({ value, label: copy[value] })),
  );

  const list = (names: string[]) => names.join(', ');
</script>

{#snippet symbol(parts: SymbolPart[])}
  {#each parts as piece, index (index)}{#if typeof piece === 'string'}{piece}{:else}<sub
        >{piece.sub}</sub
      >{/if}{/each}
{/snippet}

{#if fingerprint}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      {#if fingerprints.length > 1}
        <ChoiceGroup
          class="receptor-parts"
          label={copy.parts}
          options={partOptions}
          bind:value={part}
        />
      {/if}
      {#each groups as { transmitter, rows: members } (transmitter.id)}
        <p class="network-map">{transmitterName(transmitter, lang)}</p>
        <ul class="network-list">
          {#each members as row (row.receptor.id)}
            <li class="network-row receptor-row">
              <span class="network-row-name">{@render symbol(row.receptor.display)}</span>
              <Swatch kind="bar" share={row.share} />
              <span class="network-share measure"
                >{grouped(row.density.mean)}{#if row.density.sd === null}<span aria-hidden="true"
                    >{' ± —'}</span
                  ><span class="visually-hidden">{`, ${copy.noSd}`}</span>{:else}{` ± ${grouped(
                    row.density.sd,
                  )}`}{/if}</span
              >
            </li>
          {/each}
        </ul>
      {/each}
      {#if missing.length}
        <p class="detail-note">{copy.notMeasured(list(missing.map(receptorText)))}</p>
      {/if}
      {#if rows.some((row) => row.density.sd === null && !row.withheld)}
        <p class="detail-note">
          {copy.noSdPublished(
            list(
              rows
                .filter((row) => row.density.sd === null && !row.withheld)
                .map((row) => receptorText(row.receptor)),
            ),
          )}
        </p>
      {/if}
      {#each rows.filter((row) => row.withheld) as row (row.receptor.id)}
        <p class="detail-note">
          {copy.withheld(
            receptorText(row.receptor),
            grouped(row.withheld!.published),
            lang === 'fr' ? row.withheld!.reason_fr : row.withheld!.reason,
          )}
        </p>
      {/each}
      <p class="detail-note">
        {copy.note(
          receptors!.unit,
          fingerprint.hemispheres.left + fingerprint.hemispheres.right,
          fingerprint.donors.length,
          ages,
          receptors!.datasets.length,
        )}
      </p>
      <p class="detail-note">{copy.measuredIn(fingerprint.measured_in)}</p>
      <div class="receptor-sources">
        <a href={fingerprint.doi} target="_blank" rel="noopener noreferrer"
          >{copy.dataset}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
        {#each sources as source (source.doi)}
          <a href={source.doi} target="_blank" rel="noopener noreferrer"
            >{source.short}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
            >{@render iconGraphic('external-link')}</a
          >
        {/each}
      </div>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    /* Set low without raising the row: the symbol keeps the row's line box. */
    sub {
      vertical-align: -0.25em;
      font-size: var(--text-caption);
      line-height: 0px;
    }
    :global(.receptor-parts) {
      margin-top: var(--space-2);
    }
    .receptor-sources {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-3);
      padding-top: var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .receptor-sources a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 24px;
    }
  }
</style>
