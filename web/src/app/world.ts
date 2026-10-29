import { flushSync } from 'svelte';
import { createAnatomyCommands } from '../lib/controller/anatomy.ts';
import type { AppContext } from '../lib/controller/context.ts';
import { createExcursions } from '../lib/controller/excursion.svelte.ts';
import { installKeymap } from '../lib/controller/keymap.ts';
import { createLinks } from '../lib/controller/links.ts';
import type { Links } from '../lib/controller/links.ts';
import { createCatalog } from '../lib/core/catalog/catalog.ts';
import { loadClinicalCatalog } from '../lib/core/clinical/load.ts';
import { isIndependentTractReference } from '../lib/core/diffusion/presentation.ts';
import { failureNotice } from '../lib/core/i18n/errors.ts';
import { loadCircuitCatalog } from '../lib/core/learning/load.ts';
import type { ReaderState } from '../lib/core/state/reader-state.ts';
import { createSceneCommands } from '../lib/core/state/scene-commands.ts';
import type { Engine } from '../lib/engine/api.ts';
import { createCatalogStore } from '../lib/state/catalog.svelte.ts';
import { createEngineSync, syncPaint, syncPresentation } from '../lib/state/engine-sync.svelte.ts';
import { createLesionStore } from '../lib/state/lesion.svelte.ts';
import { createLink } from '../lib/state/link.svelte.ts';
import { createLessonStore } from '../lib/state/session.svelte.ts';
import { announceView, createView } from '../lib/state/view.svelte.ts';
import { FOCUS_TARGETS, rescueFocus } from '../lib/ui/focus.ts';
import { effectRoot } from './application.svelte.ts';
import type { App, World } from './application.svelte.ts';

/**
 * The stores over the engine and every controller, built once and shared: the scene commands'
 * intent counter, the excursions' remembered scenes and the link writer are each state that two
 * instances would split. What lives in the regions is reached through `app.ports`. The engine is
 * the world's from here on: disposing the app disposes it, even if this throws.
 */
export function composeWorld(app: App, engine: Engine, defaultAnatomy: string): World {
  app.defer(() => engine.dispose());
  const { session, language, keyPreference, stage, ports } = app;
  const { model, sections, camera } = engine;
  const { domains } = model;
  if (!domains) {
    throw new Error('This build publishes no neuropsychological domains for the Functions tab.');
  }
  const regions = createCatalog(model.manifest, session.state.lang, model.cabNp);
  const clinical = loadClinicalCatalog(model.manifest, domains.units);
  const circuits = loadCircuitCatalog(model.manifest, clinical);

  // The scene commands read the session through `assemble`, which the store replaces with `state`.
  const commands = createSceneCommands({
    model,
    sections,
    session: {
      notify: session.notify,
      setSwitching: session.setSwitching,
      endSwitching: session.endSwitching,
      assemble: (modelState) => ({ ...modelState, ...session.state }),
    },
    // The stores are already current when a command returns.
    render() {},
  });

  let links: Links;
  // The scene a link's lesson found, handed to `holdBeforeLesson`, which captures through the reader.
  let handedScene: ReaderState | null = null;

  const { value: world, stop } = effectRoot(() => {
    const engineState = createEngineSync(engine);
    const lesson = createLessonStore(circuits);
    const view = createView({
      engine: engineState,
      session,
      lesson,
      anatomy: model.manifest.anatomy.id,
      referenceAnatomy: engine.tracts.anatomy,
    });
    const lesion = createLesionStore({
      lesion: engine.lesion,
      cortex: {
        get opacity() {
          return engine.model.settings.cortexOpacity;
        },
        setOpacity: (opacity) => engine.model.setCortexOpacity(opacity),
        seeThrough: engine.tracts.defaultOpacity,
      },
      associations: clinical.associations,
      domains,
      deficitGroup: (id) => clinical.get(id).group,
    });
    syncPaint(model, view, { domains, clinical, lesion });
    syncPresentation(engine, view, engineState);
    const catalog = createCatalogStore(regions, view);
    // Before the first restore: a link that loads hidden regions then says their count once.
    const speech = announceView(view, (region, current) => regions.label(region.id, current).name);
    const link = createLink({ engine, view, lesion, write: () => links.write() });
    const context: AppContext = { engine, engineState, session, lesson, view, catalog, link };

    const excursions = createExcursions(context, {
      anatomy: regions,
      domains,
      clinical,
      circuits,
      commands,
      reader: {
        capture: () => handedScene ?? links.captureReaderState(),
        apply: (target, current) => links.applyReaderState(target, current),
      },
      shell: ports,
      mri: { show: ports.showMri, openPreparedPlane: ports.openPreparedPlane },
      panels: {
        openFunction: ports.openFunction,
        openDeficit: ports.openDeficit,
        openMri: ports.openLessonMri,
      },
      render: flushSync,
      lesion,
    });
    const anatomy = createAnatomyCommands(context, {
      commands,
      ui: {
        showDetail: ports.showDetail,
        showList: ports.showList,
        revealOnSelect: ports.revealOnSelect,
        dismissHelp: stage.retireHint,
      },
      chooseExplorer: excursions.chooseExplorer,
      frameLandmark: excursions.focusLandmark,
      afterReset: excursions.afterReset,
    });
    links = createLinks({
      engine,
      session,
      lesson,
      view,
      lesion,
      link,
      commands,
      clinical,
      circuits,
      hooks: {
        chooseExplorer: excursions.chooseExplorer,
        tractsExcursionOpen: () => excursions.tractsHeld,
        forgetScenes: excursions.forget,
        rememberLessonScene(scene) {
          handedScene = scene;
          try {
            excursions.holdBeforeLesson();
          } finally {
            handedScene = null;
          }
        },
        openLandmark: excursions.openLandmark,
        revealInTree(id) {
          const group = catalog.groups.find((entry) =>
            entry.rows.some((row) => row.region.id === id),
          );
          if (group && !view.current.expanded.has(group.key)) session.toggleGroup(group.key);
        },
        showDetail: ports.showDetailInPlace,
        openFunction: ports.openFunction,
        openDeficit: ports.openDeficit,
      },
      followLanguage: language.follow,
      defaultAnatomy,
      page: globalThis,
    });
    return {
      ...context,
      regions,
      clinical,
      circuits,
      commands,
      anatomy,
      excursions,
      links,
      speech,
      lesion,
    };
  });
  app.defer(stop);

  const { view } = world;
  app.defer(
    engine.on('contextLost', () => session.setContextLost()),
    engine.on('contextRestored', () => session.setStatus('ready')),
    // A download the model started by itself failed: the white-matter envelopes.
    engine.on('loadError', (error) =>
      session.notify(failureNotice(error, session.state.lang, 'whiteMatter')),
    ),
    engine.on('pick', ({ id }) => world.anatomy.selectRegion(id)),
    // The lesion's report is Anatomy's detail, which shows it once no region is selected. A phone's
    // sheet stays down so the brain stays in reach for the next press; Show the report raises it.
    engine.on('lesionPoint', ({ point }) => {
      world.excursions.chooseExplorer('anatomy');
      world.anatomy.selectRegion(null);
      world.lesion.place(point);
      flushSync();
      ports.showDetailInPlace();
    }),
    // The keys act once the model has loaded, never during a failed start.
    installKeymap({
      canvas: engine.canvas,
      state() {
        const {
          explorer,
          selectedRegion,
          selectedFunction,
          selectedDeficit,
          cortexVisible,
          internalVisible,
          spinalCordVisible,
          hemisphere,
        } = view.current;
        return {
          explorer,
          selectedRegion,
          selectedFunction,
          selectedDeficit,
          cortexVisible,
          internalVisible,
          spinalCordVisible,
          hemisphere,
          singleKeys: keyPreference.enabled,
          diffusionMriOpen: ports.diffusionMriOpen(),
          mprOpen: ports.mprOpen(),
          shortcutsOpen: ports.shortcutsOpen(),
          focusInDetail: ports.focusInDetail(),
          tractReferenceActive: isIndependentTractReference(view.current),
        };
      },
      commands: {
        back: ports.back,
        clearSelection: () => void world.anatomy.clearSelection(),
        closeFunction: world.excursions.closeFunction,
        closeDeficit: world.excursions.closeDeficit,
        rescueFocus: () => void rescueFocus(FOCUS_TARGETS.activeTab),
        toggleShortcuts: ports.toggleShortcuts,
        showList: ports.showList,
        focusSearch: ports.focusSearch,
        walkTree: ports.walkTree,
        chooseView(name, options) {
          stage.retireHint();
          if (!session.setView(name)) throw new Error(`Unknown view: ${name}`);
          camera.applyView(name, options);
        },
        openDiffusionMri: ports.openDiffusionMri,
        openMpr: ports.openMpr,
        closeMpr: ports.closeMpr,
        focusSelection: world.anatomy.focusSelection,
        isolateSelection: world.anatomy.isolateSelection,
        setCortexVisible: world.anatomy.setCortexVisible,
        setInternalVisible: world.anatomy.setInternalVisible,
        setSpinalCordVisible: (visible) => void world.anatomy.setSpinalCordVisible(visible),
        setHemisphere: world.anatomy.setHemisphere,
        // The engine remembers the zoom after each (E7), as the legacy keys did.
        orbitBy: camera.orbitBy,
        dolly: camera.dolly,
      },
    }),
  );
  return world;
}
