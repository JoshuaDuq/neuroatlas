<!--
  The workspace's list view (index.html:227-322): each mode's list, one always-mounted instance each,
  the one not in front hidden (decision 0007). Anatomy is the tree with the system picker and the
  dissection bar at its foot; the other lists scroll under their own search.
-->
<script lang="ts">
  import type { App, World } from '../../app/application.svelte.ts';
  import { sharedGroupNames } from '../../lib/core/panels/navigator.ts';
  import { atlasSwitchLabel } from '../../lib/core/i18n/index.ts';
  import { insideInternal } from '../../lib/core/state/internal-mode.ts';
  import type { Explorer } from '../../lib/types/index.ts';
  import AnatomyExplorer from '../anatomy/AnatomyExplorer.svelte';
  import DissectionBar from '../anatomy/DissectionBar.svelte';
  import SystemPicker from '../anatomy/SystemPicker.svelte';
  import CircuitList from '../circuits/CircuitList.svelte';
  import type { CircuitExplorer } from '../circuits/circuits-explorer.svelte.ts';
  import DeficitList from '../deficits/DeficitList.svelte';
  import type { DeficitsExplorer } from '../deficits/explorer.svelte.ts';
  import FunctionList from '../functions/FunctionList.svelte';
  import type { FunctionExplorer } from '../functions/functions-explorer.svelte.ts';
  import TractsExplorer from '../tracts/TractsExplorer.svelte';

  let {
    app,
    world,
    functions,
    deficits,
    circuits,
  }: {
    app: App;
    world: World;
    functions: FunctionExplorer;
    deficits: DeficitsExplorer;
    circuits: CircuitExplorer;
  } = $props();

  const { engine, session, view, catalog, regions, anatomy, excursions, speech } = $derived(world);
  const current = $derived(view.current);
  const manifest = $derived(engine.model.manifest);
  // The tree takes a set of its own: the session's is read-only.
  const expanded = $derived(new Set(session.state.expanded));

  let tree = $state<AnatomyExplorer>();
  let tracts = $state<TractsExplorer>();

  /** An eye press: the part it hid or showed is said with the count it changes (decision 36, K3). */
  function eye(change: (ids: readonly string[]) => void) {
    return (ids: readonly string[], said?: string) => {
      if (said === undefined) throw new Error('An eye press says which part it changed.');
      change(ids);
      speech.part(said);
    };
  }

  /**
   * The navigator's "switch cut atlas" (app.js:564). The cut panel reports a failure of the atlas it
   * still shows; one overtaken by closing the cut is reported nowhere else, so it is reported here.
   */
  async function chooseCutAtlas(id: string) {
    try {
      await excursions.setCutAtlas(id);
    } catch (error) {
      world.commands.fail('layer', error, atlasSwitchLabel(id, current.lang));
    }
  }

  /** The `/` key: the search of the list in front, or its first row where it has none. */
  export function focusSearch(mode: Explorer) {
    if (mode === 'functions') functions.focusSearch();
    else if (mode === 'deficits') deficits.focusSearch();
    else if (mode === 'circuits') circuits.focusFirst();
    else if (mode === 'diffusion') tracts!.focusSearch();
    else tree!.focusSearch();
  }

  /** Up and Down from outside the tree walk its rows. */
  export function walkTree(step: 1 | -1) {
    tree!.moveFocus(step);
  }
</script>

<div class="mode" hidden={current.explorer !== 'anatomy'}>
  <AnatomyExplorer
    bind:this={tree}
    lang={current.lang}
    bind:query={() => current.query, (query) => session.setQuery(query)}
    search={(query) => regions.search(query, current)}
    groups={catalog.groups}
    hiddenRegions={current.hiddenRegions}
    {expanded}
    onExpandedChange={(expanded) => session.setExpanded(expanded)}
    selectedId={current.selectedRegion?.id ?? null}
    atlases={manifest.atlases}
    atlas={current.atlas}
    cutAtlases={manifest.cut_atlases ?? []}
    cutAtlas={current.cutAtlas ?? ''}
    inside={insideInternal(current)}
    switching={current.status === 'switching'}
    onScope={() => void anatomy.toggleInternalAnatomy()}
    onSelect={(id) => anatomy.selectRegion(id, { frame: true })}
    onReveal={(reason, id) => void anatomy.revealRegion(reason, id)}
    onHide={eye(anatomy.hideRegions)}
    onShow={eye(anatomy.showRegions)}
    onAtlas={(id) => excursions.chooseAtlas(id)}
    onCutAtlas={chooseCutAtlas}
  >
    {#snippet systemPicker()}
      <SystemPicker
        lang={current.lang}
        detail={current.detail}
        regions={manifest.regions}
        shared={sharedGroupNames(regions.groups({ ...current, internalSystem: null }))}
        value={current.internalSystem}
        switching={current.status === 'switching'}
        onChoose={anatomy.chooseInternalSystem}
      />
    {/snippet}
  </AnatomyExplorer>
  <DissectionBar
    lang={current.lang}
    hiddenCount={current.hiddenRegions.size}
    canUndo={current.dissectionCanUndo}
    onUndo={anatomy.undoDissection}
    onRestore={anatomy.restoreHiddenRegions}
  />
</div>

<div class="mode functions" hidden={current.explorer !== 'functions'}>
  <FunctionList model={functions} />
</div>

<div class="mode deficits" hidden={current.explorer !== 'deficits'}>
  <DeficitList explorer={deficits} view={current} showShortcut={app.keyPreference.enabled} />
</div>

<div class="mode circuits" hidden={current.explorer !== 'circuits'}>
  <CircuitList model={circuits} />
</div>

<div class="mode" hidden={current.explorer !== 'diffusion'}>
  <TractsExplorer
    bind:this={tracts}
    {engine}
    anatomy={current.anatomy}
    lang={current.lang}
    active={current.explorer === 'diffusion'}
    cortexOpacity={current.cortexOpacity}
    onCortexOpacity={anatomy.setCortexOpacity}
    onOpenMri={() => app.ports.openDiffusionMri()}
  />
</div>

<style>
  @layer features {
    /* Each list fills the panel under the tabs; its head stays put and its body scrolls. */
    .mode {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }
    /* The scrolling bodies of the lists that have no scroller of their own (layout.css:140-149). */
    .functions > :global(.browser),
    .deficits > :global(.deficit-body),
    .circuits > :global(.browser) {
      /* Keep absolutely positioned accessibility text inside its scrolling panel. */
      position: relative;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      /* A classic scrollbar arriving with a little overflow would narrow every row; the gutter is held instead. */
      scrollbar-gutter: stable;
    }
    .deficits > :global(.deficit-head) {
      flex: none;
    }
    .functions > :global(.head) {
      flex: none;
    }

    /* The phone sheet: H6's #navigator carries the home-indicator padding, so there is one rule (phone.css:226-231). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .functions > :global(.browser),
      .deficits > :global(.deficit-body),
      .circuits > :global(.browser) {
        -webkit-overflow-scrolling: touch;
      }
    }
  }
</style>
