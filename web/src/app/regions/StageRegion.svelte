<script lang="ts">
  import { hasContext, untrack } from 'svelte';
  import type { Snippet } from 'svelte';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { visibilityOf } from '../../lib/core/catalog/visibility.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { legendFor } from '../../lib/core/state/paint.ts';
  import { publishesSpinalCord } from '../../lib/core/state/scene-commands.ts';
  import type { Vec3 } from '../../lib/engine/api.ts';
  import type { CutMode, ViewName } from '../../lib/types/index.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import { createMprDialog } from '../../features/sections/mpr-dialog.svelte.ts';
  import MprDialog from '../../features/sections/MprDialog.svelte';
  import { createSectionControls } from '../../features/sections/section-controls.svelte.ts';
  import SectionBar from '../../features/sections/SectionBar.svelte';
  import SectionPopover from '../../features/sections/SectionPopover.svelte';
  import { saveSnapshot } from '../../features/snapshot/snapshot.ts';
  import Dock from '../../features/stage/Dock.svelte';
  import { createFullscreen } from '../../features/stage/fullscreen.ts';
  import type { Fullscreen } from '../../features/stage/fullscreen.ts';
  import type { HoverSources } from '../../features/stage/hover-text.ts';
  import type { ColoredNetworks } from '../../features/stage/stage-keys.ts';
  import StageKeys from '../../features/stage/StageKeys.svelte';
  import StageOverlay from '../../features/stage/StageOverlay.svelte';
  import MriNavigator from '../../features/tracts/MriNavigator.svelte';
  import { APP, getApp } from '../application.svelte.ts';
  import type { World } from '../application.svelte.ts';

  /** `children` is where I3b mounts the stage status, before and after the engine. */
  let { children }: { children?: Snippet } = $props();

  // main.ts always mounts the shell with the app; the shell's own tests mount it bare (H1a).
  const app = hasContext(APP) ? getApp() : null;
  const world = $derived(app?.world ?? null);

  let host = $state<HTMLElement>();
  let keys = $state<StageKeys>();
  let linkedMriOpen = $state(false);

  /** What the stage's controls reach, built once for the world they run in. */
  function controllers({ engine, engineState, session, commands, anatomy, excursions }: World) {
    const sections = createSectionControls({
      engine,
      engineState,
      commands,
      session,
      openLinkedMri: excursions.openLinkedMri,
    });
    const mpr = createMprDialog({ engine, select: anatomy.selectRegion });
    return { sections, mpr };
  }
  const stage = $derived(world && untrack(() => controllers(world)));

  // Only the stage goes full screen; the masthead's button and the exit control share this one.
  const fullscreen = $derived<Fullscreen | null>(
    host && app
      ? untrack(() =>
          createFullscreen({
            host: host!,
            lang: () => app.language.current,
            notify: app.session.notify,
          }),
        )
      : null,
  );

  /** The masthead's Full screen. */
  export function toggleFullscreen() {
    fullscreen!.toggle();
  }
  /** Something is full screen (follows `fullscreenchange`). */
  export function isFullscreen() {
    return fullscreen?.active ?? false;
  }

  /** The masthead's Save image: the visible stage as a captioned PNG (G6). */
  export function saveImage() {
    const { engine, view: store, commands } = world!;
    const view = store.current;
    const { manifest } = engine.model;
    const reference = isIndependentTractReference(view);
    const cut = stage!.sections.current;
    return saveSnapshot(
      { host: host!, stage: app!.stage, keys: keys!, engine },
      {
        lang: view.lang,
        anatomy: manifest.anatomy,
        atlas: view.atlas,
        surfaceColor: reference ? 'tissue' : view.surfaceColor,
        detail: view.detail,
        offersDetail: manifest.detail_levels.length > 1,
        view: view.view as ViewName,
        reference: reference ? tractCatalog(view.referenceAnatomy).name[view.lang] : null,
        // `current` is null while the cut is off, so its plane is a cut plane.
        section: cut && { ...cut, plane: cut.plane as Exclude<CutMode, 'off'> },
      },
      commands,
    );
  }

  // The tracts' streamline direction is an engine getter: it is read again when the tracts say it changed.
  let tractsEpoch = $state(0);
  $effect(() => {
    if (!world) return;
    const { engine } = world;
    const bump = () => tractsEpoch++;
    const offs = [
      engine.on('tractsReady', bump),
      engine.on('tractsVisibility', bump),
      engine.on('tractsActive', bump),
    ];
    return () => offs.forEach((off) => off());
  });

  const directionShown = $derived.by(() => {
    void tractsEpoch;
    return world?.engine.tracts.streamlinesVisible ?? false;
  });

  /** The hover chip names a region as the catalog and the model's published partitions do. */
  const sources = $derived.by((): HoverSources | null => {
    if (!world) return null;
    const { model } = world.engine;
    return {
      regions: model.regions,
      functionalRegions: model.functionalRegions,
      cabNp: model.cabNp,
      domains: model.domains,
      catalogName: (id) => world.catalog.label(id).name,
      canSelect: model.canSelect,
    };
  });

  /** Takes focus when a dialog's opener is gone: the Section tool, else the model. */
  function sectionToolOrCanvas(canvas: HTMLElement): HTMLElement {
    const tool = [...document.querySelectorAll<HTMLElement>('#viewport .stage-tool')].find(
      (candidate) => candidate.querySelector('[id^="section-tool-"]'),
    );
    return tool?.checkVisibility() ? tool : canvas;
  }

  // The Tracts MRI navigator, which draws the tracts at the panel's minimum length.
  let diffusionMri = $state(false);
  let diffusionInstant = $state(false);

  /** The atlas crosshair as a point of the scan, while the tracts are the anatomy's own. */
  function scanPoint(): Vec3 | null {
    const { engine, view } = world!;
    const { tracts, sections } = engine;
    const current = view.current;
    return current.anatomy === current.referenceAnatomy && tracts.ready
      ? tracts.surfaceToScanner(sections.state.crosshair)
      : null;
  }
  function moveCrosshair(point: Vec3) {
    const { engine, view } = world!;
    const { tracts, sections } = engine;
    const current = view.current;
    if (current.anatomy === current.referenceAnatomy && tracts.ready) {
      sections.setCrosshair(tracts.scannerToSurface(point));
    }
  }

  // The stage's part of the interface the controllers and the keymap reach (ports.ts).
  $effect(() => {
    if (!app || !world || !stage) return;
    const { sections, mpr } = stage;
    const withdraw = app.registerPorts({
      showMri: (options) => mpr.show(options),
      openPreparedPlane: (plane, canOpen) => mpr.openPreparedPlane(plane, canOpen),
      // `M` shares the opener's busy guard (legacy `M` clicked the opener).
      openMpr: () => void sections.openLinkedMri({ instant: true }),
      closeMpr: () => mpr.close({ instant: true }),
      openDiffusionMri(options) {
        diffusionInstant = options.instant;
        diffusionMri = true;
      },
      mprOpen: () => mpr.isOpen(),
      diffusionMriOpen: () => diffusionMri,
    });
    return () => {
      withdraw();
      // A slider frame still queued would run after the dialog is gone.
      mpr.dispose();
    };
  });
</script>

<!-- The main landmark, and the target of the masthead's skip link: tabindex -1 lets it take focus when no canvas can. -->
<main id="viewport" tabindex="-1" bind:this={host} data-sheet-full={app?.stage.sheetFull}>
  {#if app && world && stage && sources}
    {@const current = world.view.current}
    {@const tractReference = isIndependentTractReference(current)}
    {@const { model } = world.engine}
    <StageOverlay
      engine={world.engine}
      stage={app.stage}
      media={app.media}
      lang={current.lang}
      status={current.status}
      {tractReference}
      selectedId={current.selectedRegion?.id ?? null}
      view={current}
      {sources}
    />
    <Dock
      engine={world.engine}
      stage={app.stage}
      media={app.media}
      lang={current.lang}
      status={current.status}
      {tractReference}
      view={current}
      hasSpinalCord={publishesSpinalCord(model.manifest)}
      commands={{
        reset: world.anatomy.reset,
        setHemisphere: world.anatomy.setHemisphere,
        setCortexVisible: world.anatomy.setCortexVisible,
        setCortexOpacity: world.anatomy.setCortexOpacity,
        setInternalVisible: world.anatomy.setInternalVisible,
        setSpinalCordVisible: world.anatomy.setSpinalCordVisible,
        chooseView(name) {
          if (!app.session.setView(name)) throw new Error(`Unknown view: ${name}`);
          world.engine.camera.applyView(name);
        },
      }}
    >
      {#snippet sectionPopover({ close })}
        <SectionPopover
          controls={stage.sections}
          lang={current.lang}
          phone={app.media.phone}
          {close}
        />
      {/snippet}
      {#snippet sectionBar()}
        <SectionBar
          controls={stage.sections}
          stage={app.stage}
          lang={current.lang}
          view={current}
          {tractReference}
        />
      {/snippet}
    </Dock>
    <StageKeys
      bind:this={keys}
      stage={app.stage}
      media={app.media}
      lang={current.lang}
      status={current.status}
      surfaceColor={tractReference ? 'tissue' : current.surfaceColor}
      functionalLevel={current.functionalLevel}
      networks={(model.manifest.networks as ColoredNetworks | undefined) ?? null}
      cabNp={model.cabNp}
      functionalRegions={model.functionalRegions}
      legend={tractReference
        ? null
        : legendFor(current, {
            domains: model.domains!,
            clinical: world.clinical,
            drawn: (id) => visibilityOf(world.regions.get(id)!.region, current).visible,
          })}
      {directionShown}
      onFunctionalLevel={model.setFunctionalLevel}
      onPaintPick={world.excursions.pickPaint}
    />
  {/if}
  {#if fullscreen}
    <!-- Kept mounted: the attachment shows it in full screen and hands focus over (g6-fullscreen-focus). -->
    <button
      type="button"
      class="exit-fullscreen"
      {@attach fullscreen.exitControl}
      onclick={() => fullscreen.toggle()}
    >
      {@render iconGraphic('fullscreen')}
      {t(world?.view.current.lang ?? app!.language.current, 'viewport').exitFullscreen}
    </button>
  {/if}
  {@render children?.()}
</main>

{#if app && world && stage}
  {@const current = world.view.current}
  {@const engine = world.engine}
  <MprDialog
    mpr={stage.mpr}
    engine={world.engine}
    engineState={world.engineState}
    lang={current.lang}
    anatomy={world.engine.model.manifest.anatomy}
    fallbackFocus={() => sectionToolOrCanvas(engine.canvas)}
  />
  <MriNavigator
    bind:open={diffusionMri}
    bind:instant={diffusionInstant}
    engine={world.engine}
    anatomy={current.anatomy}
    lang={current.lang}
    minimum={app.tractsMinimum}
    singleKeys={app.keyPreference.enabled}
    getPoint={scanPoint}
    onPoint={moveCrosshair}
    fallbackFocus={() => engine.canvas}
  />
{/if}

<style>
  @layer features {
    /* The exit control: top end of the stage, on an opaque plate, clear of the keys (pushed below it), the letters and the dock (WCAG 2.4.11). */
    .exit-fullscreen {
      position: absolute;
      z-index: 4;
      /* Below the top letter's line, which a wide plate would cover on a phone. */
      top: calc(var(--vis-top) + var(--stage-gutter) + var(--lh-caption) + var(--space-2));
      right: calc(var(--vis-right) + var(--stage-gutter));
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 24px;
      min-height: var(--control-height);
      padding: 0 var(--space-3);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
      background: var(--overlay-plate);
      color: var(--overlay-ink);
      font-size: var(--text-stage);
      cursor: pointer;
    }
    :global(.exit-fullscreen[hidden]) {
      display: none;
    }
    @media (pointer: coarse) {
      .exit-fullscreen {
        min-height: 44px;
        min-width: 44px;
      }
    }
    :global(#viewport:fullscreen .stage-keys) {
      top: calc(
        var(--vis-top) + var(--stage-gutter) + var(--lh-caption) + var(--space-2) +
          var(--control-height) + var(--space-2)
      );
      max-height: calc(
        100% - var(--vis-top) - var(--vis-bottom) - 3 * var(--stage-gutter) - var(--dock-height) -
          var(--lh-caption) - var(--control-height) - 2 * var(--space-2)
      );
    }
    /* A raised phone sheet leaves the picture a strip: the tools and markings would collide in it (stage.css:720-721). */
    :global(#viewport[data-sheet-full='true'] :is(.stage-dock, .scale-bar, .orientation)) {
      visibility: hidden;
    }
    /* An open popover covers most of the picture; markings left at its edges would label nothing (stage.css:722-725). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      :global(#viewport:has(.stage-popover:not([hidden])) :is(.scale-bar, .orientation)) {
        visibility: hidden;
      }
    }
  }
</style>
