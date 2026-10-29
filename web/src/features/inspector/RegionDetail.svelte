<!--
  The selected region (ui/panels/inspector.js, index.html:340-414): its name and where it sits,
  the commands that act on it, its measurements, then the collapsed sections that qualify it.
  Without a selection it is one hint line. The sections keep legacy's order (decision 35 on #4):
  the comparison slot (R2), constituents, functional division, domains, networks, with NextBrain's
  boundary certainty after the comparison, both being about the labels' source, then the receptor
  densities measured in the area the region is named after; the deficits
  and circuits the region takes part in (X2, X3) follow as slots of their own.
  - the name is the `region-title` focus target; the commands that hide the selection with it
    (Clear ×, Hide) hand focus on through S2's commands, not here;
  - Isolate has no `aria-pressed`: its label says Isolate or Restore (APG toggle button);
  - the actions are not rendered without a region, instead of hidden and disabled
    (deviations/r1-hidden-actions.md); summaries are plain text (deviations/r1-summary-headings.md).
  I1 mounts it inside the panel landmark, which carries `data-own-keys` (decision 7).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type {
    ArterialTerritories,
    CerebellarFunctions,
    Explorer,
    Language,
    Region,
    Rgb,
  } from '../../lib/types/index.ts';
  import type { RegionLabel } from '../../lib/core/catalog/labels.ts';
  import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
  import type { BoundaryCertainty } from '../../lib/core/catalog/boundary-certainty.ts';
  import type { ReceptorFingerprints } from '../../lib/core/catalog/receptor-fingerprints.ts';
  import { ARIA_KEYSHORTCUTS } from '../../lib/controller/keymap.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { inspectorEmptyChrome } from '../../lib/core/panels/inspector.ts';
  import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import BoundarySection from './BoundarySection.svelte';
  import Constituents from './Constituents.svelte';
  import DomainSection from './DomainSection.svelte';
  import FunctionalSection from './FunctionalSection.svelte';
  import NetworkSection from './NetworkSection.svelte';
  import ReceptorSection from './ReceptorSection.svelte';
  import SupplySection from './SupplySection.svelte';
  import CerebellarFunctionsSection from './CerebellarFunctionsSection.svelte';
  import RegionFacts from './RegionFacts.svelte';
  import './inspector.css';

  interface Props {
    lang: Language;
    /** The selected region, or null for the empty hint. */
    region: Region | null;
    explorer: Explorer;
    cortexVisible: boolean;
    isolated: boolean;
    /** A lesson is open: true when the selection is its landmark (the headline above names it), false for any other region. */
    landmarkSelected?: boolean;
    /** A function or deficit profile sits above: the region is a smaller second subject. */
    underProfile?: boolean;
    catalog: {
      get: (id: string) => { region: Region; label: RegionLabel } | null;
      label: (id: string) => RegionLabel;
    };
    centroidOf: (id: string) => readonly number[] | null;
    /** The manifest's Yeo network colours. */
    networkColors?: Readonly<Record<string, Rgb>>;
    cabNp: CabNpPartition | null;
    functionalRegions: FunctionalRegions | null;
    domains: NeuropsychDomains | null;
    boundaryCertainty: BoundaryCertainty | null;
    receptors: ReceptorFingerprints | null;
    /** The manifest's arterial territories, for each region's typical supply. */
    territories?: ArterialTerritories | null;
    /** The manifest's functional cerebellar atlas, for each lobule's shares. */
    cerebellarFunctions?: CerebellarFunctions | null;
    /** Takes no arguments: I1 wires `focusSelection()`, which frames with an animation (only the F key is immediate). */
    onfocus: () => void;
    /** Takes no arguments: I1 wires `isolateSelection`. */
    onisolate: () => void;
    /** S2's `hideSelection`: it hands focus on. */
    onhide: () => void;
    /** S2's `clearSelection`: it rescues focus. */
    onclear: () => void;
    /** A constituent structure: opens it, as S2's `openConstituent`. */
    onregion: (id: string) => void;
    /** A boundary's neighbour: selects it without moving the view. */
    onselect: (id: string) => void;
    /** S3's `openLinkedMri`; `instant` is true for a keyboard activation. */
    openLinkedMri: (options: { atRegion: true; instant: boolean }) => unknown;
    comparison?: Snippet;
    relatedDeficits?: Snippet;
    relatedCircuits?: Snippet;
  }

  let {
    lang,
    region,
    explorer,
    cortexVisible,
    isolated,
    landmarkSelected,
    underProfile = false,
    catalog,
    centroidOf,
    networkColors,
    cabNp,
    functionalRegions,
    domains,
    boundaryCertainty,
    receptors,
    territories = null,
    cerebellarFunctions = null,
    onfocus,
    onisolate,
    onhide,
    onclear,
    onregion,
    onselect,
    openLinkedMri,
    comparison,
    relatedDeficits,
    relatedCircuits,
  }: Props = $props();

  let title = $state<HTMLElement>();
  $effect(() => registerFocusTarget(FOCUS_TARGETS.regionTitle, () => title ?? null));

  const copy = $derived(t(lang, 'inspector'));
  const chrome = $derived(inspectorEmptyChrome({ selectedRegion: region, explorer }));
  const label = $derived(region ? catalog.label(region.id) : null);
  // A selected region always names its atlas; the facts and the source label read it.
  const atlasRegion = $derived.by(() => {
    if (region && !region.atlas) throw new Error(`Selected region has no atlas: ${region.id}`);
    return region as (Region & { atlas: string }) | null;
  });
</script>

<div
  class="region-detail"
  data-landmark-selected={landmarkSelected}
  data-under-profile={underProfile ? '' : undefined}
>
  {#if region && label && atlasRegion}
    <div class="selection-head">
      <h2 class="region-name" tabindex="-1" bind:this={title}>{label.name}</h2>
      <IconButton
        class="selection-clear"
        icon="close"
        label={copy.clearSelection}
        data-tooltip={copy.clearSelection}
        onclick={onclear}
      />
    </div>
    <dl class="selection-context">
      <dt class="visually-hidden">{copy.hemisphere}</dt>
      <dd>{t(lang, 'sides').capitalized[region.hemisphere] ?? region.hemisphere}</dd>
      <dt class="visually-hidden">{copy.group}</dt>
      <dd class="context-group">{label.group ?? '—'}</dd>
    </dl>
    {#if region.notes}<p class="selected-hint">{region.notes[lang]}</p>{/if}
    <div class="actions">
      <button type="button" aria-keyshortcuts={ARIA_KEYSHORTCUTS.focusSelection} onclick={onfocus}>
        {copy.focus}
      </button>
      <button
        type="button"
        data-active={isolated}
        aria-keyshortcuts={ARIA_KEYSHORTCUTS.isolate}
        onclick={onisolate}
      >
        {isolated ? copy.restore : copy.isolate}
      </button>
      <button type="button" onclick={onhide}>{t(lang, 'dissection').hideSelected}</button>
      <button
        type="button"
        class="linked-mri"
        data-tooltip={t(lang, 'cuts').openMprTitle}
        onclick={(event) => openLinkedMri({ atRegion: true, instant: isKeyboardActivation(event) })}
      >
        {copy.linkedMri}
      </button>
    </div>
    <RegionFacts region={atlasRegion} {lang} centroid={centroidOf(region.id)} />
  {:else}
    {#if !chrome.hideHint}
      <h2 class="selection-empty">{copy.noRegionSelected}</h2>
      <p class="selected-hint">{cortexVisible ? copy.hintCortex : copy.hintStructures}</p>
    {/if}
  {/if}
  {@render comparison?.()}
  <BoundarySection {region} {lang} certainty={boundaryCertainty} label={catalog.label} {onselect} />
  <ReceptorSection {region} {lang} {receptors} />
  <Constituents {region} {lang} get={catalog.get} label={catalog.label} {onregion} />
  <FunctionalSection {region} {lang} {functionalRegions} />
  <DomainSection {region} {lang} {domains} />
  <NetworkSection {region} {lang} colors={networkColors} {cabNp} />
  <CerebellarFunctionsSection {region} {lang} functions={cerebellarFunctions} />
  <SupplySection {region} {lang} {territories} />
</div>
{@render relatedDeficits?.()}
{@render relatedCircuits?.()}
