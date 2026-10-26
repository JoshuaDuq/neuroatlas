<script lang="ts">
  import { flushSync, hasContext, untrack } from 'svelte';
  import {
    ALL_DOMAINS,
    domainName,
    domainRecord,
  } from '../../lib/core/catalog/neuropsych-domains.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { reloadWithoutStoredModels } from '../../lib/core/assets/published-assets.ts';
  import type { ContextSelection, WorkspaceView } from '../../lib/core/workspace.ts';
  import type { ChromeInsets } from '../../lib/engine/api.ts';
  import type { Language, Notice, ViewName } from '../../lib/types/index.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';
  import { createCircuitExplorer } from '../../features/circuits/circuits-explorer.svelte.ts';
  import CircuitStepper from '../../features/circuits/CircuitStepper.svelte';
  import DeficitRestore from '../../features/deficits/DeficitRestore.svelte';
  import { createDeficitsExplorer } from '../../features/deficits/explorer.svelte.ts';
  import FunctionRestore from '../../features/functions/FunctionRestore.svelte';
  import { createFunctionExplorer } from '../../features/functions/functions-explorer.svelte.ts';
  import Sheet from '../../features/sheet/Sheet.svelte';
  import DetailView from '../../features/workspace/DetailView.svelte';
  import ListView from '../../features/workspace/ListView.svelte';
  import Workspace from '../../features/workspace/Workspace.svelte';
  import { APP, getApp } from '../application.svelte.ts';
  import type { World } from '../application.svelte.ts';

  let { lang }: { lang: Language } = $props();

  // main.ts always mounts the shell with the app; the shell's own tests mount it bare (H1a).
  const app = hasContext(APP) ? getApp() : null;
  const world = $derived(app?.world ?? null);

  /** The explorers whose state the list and the detail share, built once for the world they run in. */
  function explorers({
    engine,
    session,
    view,
    catalog,
    regions,
    clinical,
    circuits,
    excursions,
  }: World) {
    const { domains, functionalRegions } = engine.model;
    if (!domains)
      throw new Error('The Functions tab needs the published neuropsychological domains.');
    // Each opens the others' items through their own runners (S3's `panels`).
    const functions = createFunctionExplorer({
      session,
      excursions,
      domains,
      anatomy: regions,
      functionalRegions,
      openDeficit: (id) => deficits.openDeficit(id),
    });
    const deficits = createDeficitsExplorer({
      clinical,
      anatomy: regions,
      session,
      excursions,
      openFunction: (id) => functions.openFunction(id),
    });
    const lessons = createCircuitExplorer({
      view,
      circuits,
      excursions,
      labelOf: (id) => catalog.label(id),
      openDeficit: (id) => deficits.openDeficit(id),
    });
    return { functions, deficits, circuits: lessons };
  }
  // The world is set once the engine has loaded and dropped once when the app goes.
  const panels = $derived(world && untrack(() => explorers(world)));

  let workspace = $state<Workspace>();
  let sheet = $state<Sheet>();
  let lists = $state<ListView>();
  let shown = $state<WorkspaceView>('list');

  /** What the selection strip names: the region, else the function, deficit or lesson in front (app.js:1574-1597). */
  const selection = $derived.by((): ContextSelection => {
    if (!world) return {};
    const current = world.view.current;
    const region = isIndependentTractReference(current) ? null : current.selectedRegion;
    if (region) {
      const { circuit, step } = current.lesson;
      const landmark =
        current.explorer === 'circuits' &&
        circuit !== null &&
        world.circuits.get(circuit).steps[step]!.region === region.id;
      const sides = t(current.lang, 'sides');
      return {
        kind: landmark ? 'landmark' : 'region',
        label: world.catalog.label(region.id).name,
        side: sides.glyphs[region.hemisphere] ?? '',
        sideWord: sides.words[region.hemisphere],
        clearable: true,
      };
    }
    if (current.explorer === 'functions' && current.selectedFunction) {
      const id = current.selectedFunction;
      const label =
        id === ALL_DOMAINS
          ? t(current.lang, 'functions').all
          : domainName(domainRecord(world.engine.model.domains, id)!, current.lang);
      return { kind: 'function', label, clearable: true };
    }
    if (current.explorer === 'deficits' && current.selectedDeficit) {
      const label = world.clinical.get(current.selectedDeficit).name[current.lang];
      return { kind: 'deficit', label, clearable: true };
    }
    if (current.explorer === 'circuits' && current.lesson.circuit) {
      const label = world.circuits.get(current.lesson.circuit).name[current.lang];
      return { kind: 'lesson', label, clearable: false };
    }
    return {};
  });

  /** The location bar's place within a mode: a lesson's circuit (app.js:1598-1603). */
  const place = $derived.by(() => {
    if (!world) return null;
    const { explorer, lesson, lang: language } = world.view.current;
    return explorer === 'circuits' && lesson.circuit
      ? world.circuits.get(lesson.circuit).name[language]
      : null;
  });

  /** The strip's clear takes the region first, then the function or deficit it sits under (app.js:1563-1569). */
  function clearContext() {
    const { anatomy, excursions, view } = world!;
    const current = view.current;
    if (current.selectedRegion) return anatomy.selectRegion(null);
    if (current.explorer === 'functions' && current.selectedFunction) excursions.closeFunction();
    if (current.explorer === 'deficits' && current.selectedDeficit) excursions.closeDeficit();
  }

  /** The group crumb leads to the selected row, so the tree shows it rather than a search (app.js:1497-1503). */
  function locate() {
    const { catalog, session, view } = world!;
    const id = view.current.selectedRegion?.id;
    if (!id) return;
    session.setQuery('');
    const group = catalog.groups.find((entry) => entry.rows.some((row) => row.region.id === id));
    if (group && !view.current.expanded.has(group.key)) session.toggleGroup(group.key);
  }

  function noticeAction(action: NonNullable<Notice['action']>) {
    if (action === 'reload') void reloadWithoutStoredModels();
    else world!.excursions.seeThroughCortex();
  }

  /*
   * The sheet covers part of the stage (app.js:1524-1539). A reader's own framing (an orbit, Focus, a
   * landmark) keeps its heading and its size in the room: its fit is read before the sheet first moves,
   * and again where the sheet settles. Before the start has framed the camera there is none to keep.
   */
  let fitBefore: number | null = null;
  function onInsets(insets: ChromeInsets, motion: { settle: boolean }) {
    const { camera } = world!.engine;
    const own = app!.session.state.status !== 'loading' && !camera.viewHeld;
    if (own && fitBefore === null) fitBefore = camera.fittedDistance();
    camera.setChromeInsets(insets, motion);
    app!.stage.setViewport(camera.visibleRect, camera.hostSize);
    if (!motion.settle) return;
    if (own) camera.keepFraming(fitBefore!);
    fitBefore = null;
  }

  // Reframing during a drag would fight the finger; on arrival a held view eases to the new room.
  function onDetent() {
    const { engine, view } = world!;
    if (engine.camera.viewHeld) engine.camera.frameCurrent(view.current.view as ViewName);
  }

  // The panels' part of the interface the controllers and the keymap reach (ports.ts).
  $effect(() => {
    if (!app || !world || !panels || !workspace || !sheet || !lists) return;
    const [shell, raised, explorer] = [workspace, sheet, lists];
    return app.registerPorts({
      showDetail() {
        shell.showDetail();
        raised.raise();
      },
      showDetailInPlace: () => shell.showDetail(),
      showList() {
        shell.showList();
        raised.raise();
      },
      revealOnSelect: () => raised.raise(),
      back: () => shell.back(),
      focusInDetail: () => shell.focusInDetail(),
      focusSearch(mode) {
        // The list was hidden a moment ago: its field is focusable once the page shows it.
        flushSync();
        explorer.focusSearch(mode);
      },
      walkTree: (step) => explorer.walkTree(step),
      openFunction: (id) => panels.functions.openFunction(id),
      openDeficit: (id) => panels.deficits.openDeficit(id),
      openLessonMri: () => panels.circuits.openMri(),
    });
  });

  const viewport = () => {
    const host = document.getElementById('viewport');
    if (!host) throw new Error('The stage element #viewport is not on the page.');
    return host;
  };
</script>

<!--
  The one complementary landmark: the panels inside it are sections or tabpanels, never nested
  asides (decision 13 on #4). One instance in both shells (decision 0007): the sheet only decides how
  much of it is on screen.
-->
{#if app && world && panels}
  {@const current = world.view.current}
  <Sheet
    bind:this={sheet}
    {lang}
    media={app.media}
    stage={app.stage}
    view={shown}
    {selection}
    {viewport}
    {onInsets}
    {onDetent}
    onSelection={() => workspace!.showDetail()}
    onClear={clearContext}
  >
    <aside
      id="workspace-panel"
      {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
      aria-label={t(lang, 'workspace').panelAria}
    >
      <Workspace
        bind:this={workspace}
        {lang}
        snapshot={current}
        {selection}
        {place}
        groups={world.catalog.groups}
        notice={current.notice}
        shell={app.media.phone ? 'sheet' : 'rails'}
        stepper={panels.circuits.exploring && panels.circuits.circuit ? stepper : undefined}
        trailing={world.excursions.restorable &&
        ((current.explorer === 'functions' && current.selectedFunction) ||
          (current.explorer === 'deficits' && current.selectedDeficit))
          ? trailing
          : undefined}
        onMode={(mode) => void world.excursions.chooseMode(mode)}
        onClear={clearContext}
        onReturn={() => void world.excursions.leaveLesson()}
        onLocate={locate}
        onViewChange={(next) => {
          shown = next;
          world.engine.invalidate();
        }}
        onNoticeAction={noticeAction}
        onDismiss={() => world.session.notify(null)}
      >
        {#snippet list()}
          <ListView
            bind:this={lists}
            {app}
            {world}
            functions={panels.functions}
            deficits={panels.deficits}
            circuits={panels.circuits}
          />
        {/snippet}
        {#snippet detail()}
          <DetailView
            {world}
            functions={panels.functions}
            deficits={panels.deficits}
            circuits={panels.circuits}
          />
        {/snippet}
      </Workspace>
    </aside>
  </Sheet>

  {#snippet stepper()}
    <CircuitStepper model={panels.circuits} />
  {/snippet}
  {#snippet trailing()}
    <FunctionRestore model={panels.functions} />
    <DeficitRestore explorer={panels.deficits} view={world.view.current} />
  {/snippet}
{:else}
  <aside
    id="workspace-panel"
    {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
    aria-label={t(lang, 'workspace').panelAria}
  >
    <!-- The list's skeleton while the anatomy loads (layout.css); nothing in it is content. -->
    <div id="tree" aria-hidden="true"></div>
  </aside>
{/if}
