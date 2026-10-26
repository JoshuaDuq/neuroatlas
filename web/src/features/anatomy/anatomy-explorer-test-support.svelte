<!-- Fixture for the anatomy explorer tests: a real catalog over a few regions, and the state I1 holds around it. Not shipped. -->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { createCatalog, type CatalogSettings } from '../../lib/core/catalog/catalog.ts';
  import type { Region } from '../../lib/types/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import AnatomyExplorer from './AnatomyExplorer.svelte';

  let {
    calls = [],
    lang = 'en',
    settings: overrides = {},
    selected = null,
    crowd = 0,
    rejectCutAtlas = false,
  }: {
    calls?: string[];
    lang?: Language;
    /** Display settings over the defaults: a hidden hemisphere, the cut off, another cut atlas. */
    settings?: Record<string, unknown>;
    selected?: string | null;
    /** This many HCP-MMP areas whose names all contain "V1", more than a search lists. */
    crowd?: number;
    rejectCutAtlas?: boolean;
  } = $props();

  // Fixtures carry only the fields the catalog reads.
  const asRegion = (fields: object) => fields as Region;
  const asSettings = (fields: object) => fields as CatalogSettings;
  const region = (id: string, hemisphere: string, kind: string, atlas: string, source: string) =>
    asRegion({ id, hemisphere, kind, atlas, source_name: source });
  const regions = [
    region('d:left:cuneus', 'left', 'cortex', 'destrieux', 'G_cuneus'),
    region('d:right:cuneus', 'right', 'cortex', 'destrieux', 'G_cuneus'),
    region('d:left:ifg', 'left', 'cortex', 'destrieux', 'G_front_inf-Opercular'),
    region('d:left:central', 'left', 'cortex', 'destrieux', 'S_central'),
    region('a:left:putamen', 'left', 'structure', 'aseg', 'Left-Putamen'),
    region('a:left:cerebellum', 'left', 'structure', 'aseg', 'Left-Cerebellum-Cortex'),
    region('h:left:v1', 'left', 'cortex', 'hcp-mmp', 'L_V1_ROI'),
    asRegion({
      ...region('t:left:tiny', 'left', 'tissue-region', 'nextbrain', 'Tiny_nucleus'),
      source_label_id: 48,
      cut_atlases: [],
    }),
    asRegion({
      ...region('t:left:small', 'left', 'tissue-region', 'nextbrain', 'Small_nucleus'),
      source_label_id: 117,
    }),
    ...Array.from({ length: untrack(() => crowd) }, (_, index) =>
      region(`h:left:${index}`, 'left', 'cortex', 'hcp-mmp', `L_V1${index}_ROI`),
    ),
  ];
  const catalog = createCatalog(
    { regions },
    untrack(() => lang),
  );

  const atlases = [
    { id: 'destrieux', label: 'Destrieux' },
    { id: 'hcp-mmp', label: 'HCP-MMP' },
  ];
  const cutAtlases = [
    { id: 'nextbrain', label: 'NextBrain' },
    { id: 'other', label: 'Other cut atlas' },
  ];

  let query = $state('');
  let expanded = $state(new Set<string>());
  let hiddenRegions = $state(new Set<string>());
  let selectedId = $state<string | null>(untrack(() => selected));
  let atlas = $state(untrack(() => (crowd > 0 ? 'hcp-mmp' : 'destrieux')));
  let cutAtlas = $state(untrack(() => (overrides.cutAtlas as string | undefined) ?? 'nextbrain'));
  let switching = $state(false);
  let cortexVisible = $state(true);
  const current = $derived(
    asSettings({
      lang,
      detail: 'aseg',
      surfaceColor: 'atlas',
      hemisphere: 'both',
      cortexOpacity: 1,
      internalVisible: true,
      spinalCordVisible: true,
      cutActive: true,
      isolatedRegion: null,
      internalSystem: null,
      ...overrides,
      atlas,
      cutAtlas,
      cortexVisible,
      hiddenRegions,
    }),
  );
  const groups = $derived(catalog.groups(current));

  let explorer: ReturnType<typeof AnatomyExplorer>;
  let live: HTMLElement;
  onMount(() => attachAnnouncer(live));
</script>

<div bind:this={live} role="status" aria-live="polite" aria-atomic="true" id="announcer"></div>
<button id="before">before</button>
<div class="panel">
  <AnatomyExplorer
    bind:this={explorer}
    {lang}
    bind:query
    search={(text) => catalog.search(text, current)}
    {groups}
    {hiddenRegions}
    {expanded}
    onExpandedChange={(next) => (expanded = next)}
    {selectedId}
    {atlases}
    {atlas}
    {cutAtlases}
    {cutAtlas}
    inside={!cortexVisible}
    {switching}
    onScope={() => {
      calls.push('scope');
      cortexVisible = !cortexVisible;
    }}
    onSelect={(id) => {
      calls.push(`select ${id}`);
      selectedId = id;
    }}
    onReveal={(reason, id) => calls.push(`reveal ${reason} ${id}`)}
    onHide={(ids) => calls.push(`hide ${ids.join(',')}`)}
    onShow={(ids) => calls.push(`show ${ids.join(',')}`)}
    onAtlas={(id) => {
      calls.push(`atlas ${id}`);
      atlas = id;
    }}
    onCutAtlas={(id) => {
      calls.push(`cut ${id}`);
      cutAtlas = id;
      if (rejectCutAtlas) return Promise.reject(new Error('cut atlas failed'));
    }}
  >
    {#snippet systemPicker()}<p id="system-picker">System picker</p>{/snippet}
  </AnatomyExplorer>
</div>
<button id="switch" onclick={() => (switching = !switching)}>switch</button>
<!-- A press must not take focus: the keys these stand for run from wherever focus already is. -->
<button
  id="search-key"
  onmousedown={(e) => e.preventDefault()}
  onclick={() => explorer.focusSearch()}
>
  search key
</button>
<button
  id="walk-down"
  onmousedown={(e) => e.preventDefault()}
  onclick={() => explorer.moveFocus(1)}
>
  walk down
</button>

<style>
  @layer components {
    /* The panel gives the explorer its height, as the workspace does. */
    .panel {
      display: flex;
      flex-direction: column;
      height: 600px;
      width: min(360px, 100%);
    }
    button {
      background: none;
      border: 0;
    }
  }
</style>
