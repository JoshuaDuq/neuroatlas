<!-- Fixture for the Deficits tests: the four panels as I1 composes them, over the real catalogs and a fake session. Not shipped. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { View } from '../../lib/state/view.svelte.ts';
  import { createCatalog } from '../../lib/core/catalog/catalog.ts';
  import { loadClinicalCatalog } from '../../lib/core/clinical/load.ts';
  import { createInvolvement } from '../../lib/core/panels/related.ts';
  import type { Manifest, Region } from '../../lib/types/index.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
  import DeficitList from './DeficitList.svelte';
  import DeficitProfile from './DeficitProfile.svelte';
  import DeficitRestore from './DeficitRestore.svelte';
  import type { Fixture } from './deficits-test-support.ts';
  import { createDeficitsExplorer } from './explorer.svelte.ts';
  import RelatedDeficits from './RelatedDeficits.svelte';

  let {
    manifest,
    onready,
    hold = [],
    failWith = null,
    functionMatches = 0,
    restorable = true,
    showShortcut = true,
  }: {
    manifest: Manifest;
    onready: (fixture: Fixture) => void;
    /** Holds `openDeficit` for these deficits until the test releases it. */
    hold?: { id: string; release: Promise<boolean> }[];
    /** Makes `onRegion` reject. */
    failWith?: Error | null;
    functionMatches?: number;
    restorable?: boolean;
    showShortcut?: boolean;
  } = $props();

  // The manifest is fixed for the life of a fixture.
  // svelte-ignore state_referenced_locally
  const catalog = createCatalog(manifest, 'en');
  // svelte-ignore state_referenced_locally
  const clinical = loadClinicalCatalog(manifest);
  // svelte-ignore state_referenced_locally
  const regions = new Map<string, Region>(manifest.regions.map((region) => [region.id, region]));
  const calls: string[] = [];
  const finders = new Set<() => HTMLElement | null>();

  const view = $state({
    lang: 'en',
    explorer: 'deficits',
    selectedDeficit: null,
    selectedFinding: null,
    clinicalQuery: '',
    paint: null,
    selectedRegion: null,
    atlas: 'destrieux',
    detail: 'aseg',
    internalSystem: null,
    internalConstituents: new Set(),
    cutAtlas: null,
    cutActive: false,
    hemisphere: 'both',
    cortexVisible: true,
    cortexOpacity: 1,
    internalVisible: true,
    spinalCordVisible: true,
    surfaceColor: 'tissue',
    functionalLevel: 'named',
    isolatedRegion: null,
    hiddenRegions: new Set(),
    dissectionCanUndo: false,
  } as unknown as View);
  $effect.pre(() => catalog.setLanguage(view.lang));

  const explorer = createDeficitsExplorer({
    clinical,
    anatomy: catalog,
    involved: createInvolvement(regions),
    checkedMaps: (deficit) =>
      deficit === 'aphasia' ? [{ id: 'language', name: 'Language', color: [10, 20, 30] }] : [],
    functionsMatching: () => functionMatches,
    onQuery(query) {
      calls.push(`query:${query}`);
      view.clinicalQuery = query;
    },
    async onDeficit(id) {
      calls.push(`deficit:${id}`);
      view.explorer = 'deficits';
      view.selectedDeficit = id;
      return hold.find((entry) => entry.id === id)?.release ?? true;
    },
    async onRegion(id) {
      calls.push(`region:${id}`);
      if (failWith) throw failWith;
      view.selectedRegion = regions.get(id)!;
      return true;
    },
    onFunction: (id) => calls.push(`function:${id}`),
    onSearchFunctions: (query) => calls.push(`search-functions:${query}`),
    async onRestore() {
      calls.push('restore');
      view.selectedDeficit = null;
      return true;
    },
    onFailure: (error) => calls.push(`failure:${(error as Error).message}`),
    registerCurrentItem(find) {
      finders.add(find);
      return () => finders.delete(find);
    },
  });

  let announcer: HTMLElement;
  onMount(() => {
    const detach = attachAnnouncer(announcer);
    const unregister = registerFocusTarget(FOCUS_TARGETS.regionTitle, () =>
      document.getElementById('region-title'),
    );
    onready({ view, explorer, calls, finders });
    return () => {
      detach();
      unregister();
    };
  });
</script>

<div bind:this={announcer} role="status" class="visually-hidden"></div>
<div class="panes">
  <div class="rail" data-testid="list"><DeficitList {explorer} {view} {showShortcut} /></div>
  <div class="rail" data-testid="detail">
    <div class="trailing"><DeficitRestore {explorer} {view} {restorable} /></div>
    <DeficitProfile {explorer} {view} />
    <RelatedDeficits {explorer} {view} />
    <h2 id="region-title" tabindex="-1">{view.selectedRegion?.label ?? ''}</h2>
  </div>
</div>

<style>
  @layer features {
    .panes {
      display: grid;
      grid-template-columns: 380px 380px;
      height: 600px;
    }
    /* H5's location bar styles the one trailing button (layout.css:97-117). */
    .trailing :global(button) {
      padding: var(--space-2) var(--panel-inset);
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
    }
    .rail {
      overflow-y: auto;
      min-height: 0;
      background: var(--surface-base);
    }
  }
</style>
