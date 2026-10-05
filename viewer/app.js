import { Box3, Vector3 } from 'three';
import { createCatalog } from './catalog/catalog.js';
import { visibilityOf } from './catalog/visibility.js';
import { loadClinicalCatalog } from './clinical/load.js';
import { openClinicalRegion, revealClinicalRegions } from './clinical/navigation.js';
import { loadCircuitCatalog } from './learning/load.js';
import { createCircuitSession } from './learning/session.js';
import { openCircuitLandmark, prepareCircuitMri } from './learning/navigation.js';
import { BrainAtlas } from './model/brain-atlas.js';
import { reloadWithoutStoredModels } from './model/published-assets.js';
import {
  VIEW_DIRECTIONS, cutFacingView, fitDistance, frameTo, upFor, viewForRestoredCut, withContext,
} from './render/camera-views.js';
import { DOLLY_KEYS, ORBIT_KEYS, dolliedPosition, orbitedPosition } from './render/keyboard-orbit.js';
import { createPicker } from './render/picking.js';
import { createScene, planFraming } from './render/scene.js';
import { createSession, shortcutsAllowed } from './state/session.js';
import { captureBeforeInternal, insideInternal, leaveInternal } from './state/internal-mode.js';
import { createTheme } from './state/theme.js';
import { decodeState, encodeState } from './state/url-state.js';
import { readerState, sameRegions } from './state/reader-state.js';
import { BrainSections } from './slices/sections.js';
import { offsetThrough, rasToWorld } from './slices/coordinates.js';
import { createSectionControls } from './ui/sections.js';
import { createInternalAnatomy } from './ui/internal-anatomy.js';
import { createConstituents } from './ui/constituents.js';
import { createDisplay } from './ui/display.js';
import { createDissectionControls } from './ui/dissection.js';
import { createHeader, paintColophon } from './ui/header.js';
import { createInspector } from './ui/inspector.js';
import { createClinicalExplorer } from './ui/clinical.js';
import { createCircuitExplorer } from './ui/circuits.js';
import { createNativeTractExplorer } from './diffusion/native-ui.js';
import { isIndependentTractReference } from './diffusion/presentation.js';
import { createNavigator } from './ui/navigator.js';
import {
  characterShortcutAllowed, createKeyPreference, createShortcuts, isCharacterKey,
} from './ui/shortcuts.js';
import { createViewportChrome, paintLoadProgress } from './ui/viewport-chrome.js';
import { createSheet } from './ui/sheet.js';
import { createWorkspace } from './ui/workspace.js';
import { qualityProfile } from './render/quality.js';
import { t } from './i18n/translations.js';

const VIEW_KEYS = ['left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/**
 * After the first atlas is on screen, pull the others in while the reader is
 * looking. Switching then does not wait on another 20 MB download. Phones and
 * Save-Data connections skip this: the extra decoded layers would evict the
 * one they are using.
 */
function prefetchIdleLayers(model) {
  if (!qualityProfile().prefetchLayers) return;
  const idle = globalThis.requestIdleCallback ?? (fn => setTimeout(fn, 1500));
  idle(() => {
    for (const entry of [...model.manifest.atlases, ...model.manifest.detail_levels]) {
      if (entry.id === model.state.atlas || entry.id === model.state.detail) continue;
      model.loadLayer(entry.id, entry.file).catch(() => {});
    }
  });
}

/**
 * The composition root: it constructs the layers and connects them, and does
 * nothing else. Commands flow one way — event, command, model mutation,
 * change event, one render — so panels cannot be reached by two update paths
 * that disagree.
 */
export async function startApp() {
  const root = document.getElementById('app');
  const viewport = document.getElementById('viewport');
  const announcer = document.getElementById('announcer');

  const wanted = decodeState(globalThis.location.hash);
  let savedLang = null;
  try { savedLang = localStorage.getItem('neuroatlas-lang'); } catch {}
  const initialLang = wanted.lang ?? (savedLang === 'fr' ? 'fr' : 'en');
  // Spoken at the start, end and failure of the load, not at every progress tick.
  const announce = text => { announcer.textContent = text; };
  announce(t(initialLang, 'viewport').loadingAnatomy);
  paintColophon(initialLang);
  const session = createSession({ views: Object.keys(VIEW_DIRECTIONS), lang: initialLang });
  const keyPreference = createKeyPreference();
  // Declared before the scene: its resize observer can fire during the model
  // download, which is long, and would otherwise hit a dead zone.
  let chrome = null;
  let picker = null;
  let refitViewport = null;
  let nativeTracts = null;
  let tractReferenceActive = false;
  const scene = createScene(viewport, {
    onContextLost: () => { session.setContextLost(); render(); },
    onContextRestored: () => { session.setStatus('ready'); render(); },
    onResize: ({ canvasChanged } = {}) => {
      chrome?.setViewport(scene.visibleRect, scene.hostSize);
      if (canvasChanged) refitViewport?.();
      onCameraChange();
    },
  });
  const theme = createTheme(() => scene.applyTheme());

  // Which brain, before anything of it is loaded. A link may name one; if it
  // does not, the index names the default. Only one brain is ever live, so
  // region ids shared between brains cannot be mixed.
  const modelsUrl = `${import.meta.env.BASE_URL}models`;
  const published = await fetch(`${modelsUrl}/anatomies.json`).then(r => r.json());
  const anatomies = published.anatomies;
  const anatomy = anatomies.some(entry => entry.id === wanted.anatomy)
    ? wanted.anatomy
    : published.default;
  const manifestUrl = `${modelsUrl}/${anatomy}/manifest.json`;
  // The layers download in parallel. Once one has failed, the other's
  // progress must not paint "Loading" back over the error.
  let loadFailed = false;
  const model = await BrainAtlas.load(manifestUrl, wanted.atlas, {
    detail: wanted.detail,
    onProgress: progress => {
      if (loadFailed || !progress?.total) return;
      session.setProgress({ loaded: progress.loaded, total: progress.total });
      paintLoadProgress(initialLang, progress.loaded, progress.total);
    },
  }).catch(error => {
    loadFailed = true;
    announce(error.message);
    throw error;
  });

  const catalog = createCatalog(model.manifest, initialLang);
  const clinicalCatalog = loadClinicalCatalog(model.manifest);
  const circuitCatalog = loadCircuitCatalog(model.manifest, clinicalCatalog);
  const circuitSession = createCircuitSession(circuitCatalog);
  scene.setAppearance(model.manifest.appearance);
  const brainBounds = () => {
    const box = new Box3();
    for (const [id, layer] of model.layers) {
      if (model.manifest.supplemental_layers?.some(l => l.id === id)) continue;
      for (const mesh of layer.meshes) box.expandByObject(mesh);
    }
    return box.isEmpty() ? new Box3().setFromObject(model.group) : box;
  };
  const bounds = brainBounds();
  scene.scene.add(model.group);
  scene.transparencyProbe = () => tractReferenceActive
    || model.visibleMeshes.some(mesh => mesh.material.transparent);

  const sections = new BrainSections(model, new URL('volumes.json', new URL(manifestUrl, location.href)));
  scene.scene.add(sections.group);
  scene.sectionsProbe = () => !tractReferenceActive && sections.active;

  // ---- commands ---------------------------------------------------------

  /** Apply a display change, and say so if it silently dropped the selection. */
  function display(change) {
    const had = model.state.selectedRegion;
    change();
    if (had && !model.state.selectedRegion) {
      const state = session.assemble(model.state);
      const name = catalog.get(had.id)?.label.name ?? had.label;
      session.notify(t(state.lang, 'app').selectionCleared(name));
    }
    render();
  }

  let framed = false;
  let sheet;
  let workspace;

  /*
   * The reader's magnification, as a multiple of the distance at which the
   * whole brain just fills the stage. Held across a resize so that a stage
   * which changes shape re-fits instead of clipping the anatomy off its sides
   * or stranding it in the middle of a much larger field.
   */
  let zoom = 1;
  const viewDirection = () =>
    scene.camera.position.clone().sub(scene.controls.target).normalize();
  let cachedFramingBounds = null;
  const framingBounds = () => {
    if (tractReferenceActive && nativeTracts?.ready) return nativeTracts.bounds;
    if (model.state.isolatedRegion) {
      if (!cachedFramingBounds) {
        const visible = new Box3();
        for (const mesh of model.visibleMeshes) visible.expandByObject(mesh);
        cachedFramingBounds = visible.isEmpty() ? bounds : visible;
      }
      return cachedFramingBounds;
    }
    if (model.state.internalSystem === 'Spinal cord') {
      if (!cachedFramingBounds) {
        const cordBox = new Box3();
        for (const mesh of model.visibleMeshes) {
          if (mesh.userData.atlas === 'zanatomy') cordBox.expandByObject(mesh);
        }
        cachedFramingBounds = cordBox.isEmpty() ? bounds : cordBox;
      }
      return cachedFramingBounds;
    }
    // One hemisphere, or the cord added beneath the brain, is not the box the
    // page opened with. Fit what is actually drawn, or the picture keeps a
    // hole where the hidden half was and the cord stays below the frame.
    if (model.state.cortexVisible && (model.state.hemisphere !== 'both' || model.state.spinalCordVisible)) {
      if (!cachedFramingBounds) {
        const visible = model.state.hemisphere === 'both' ? bounds.clone() : new Box3();
        for (const mesh of model.visibleMeshes) {
          if (model.state.hemisphere === 'both' && mesh.userData.atlas !== 'zanatomy') continue;
          visible.expandByObject(mesh);
        }
        cachedFramingBounds = visible.isEmpty() ? bounds : visible;
      }
      return cachedFramingBounds;
    }
    if (model.state.cortexVisible) return bounds;
    if (!cachedFramingBounds) {
      const visible = new Box3();
      for (const mesh of model.visibleMeshes) {
        if (mesh.userData.atlas !== 'zanatomy') visible.expandByObject(mesh);
      }
      cachedFramingBounds = visible.isEmpty() ? bounds : visible;
    }
    return cachedFramingBounds;
  };
  /*
   * The vertices framing actually has to contain, in world space.
   *
   * A bounding box is the cheap answer and a loose one: its far corner sticks
   * out past a brain that never reaches it, so an oblique view — the one this
   * opens on — backs the camera away from a corner rather than from anatomy.
   * Fitting the vertices themselves is exact rather than merely tighter, so it
   * cannot crop anything the box would have kept.
   *
   * Recomputed only when the framed set changes, not per frame, and sampled
   * where a layer is dense: one vertex in eight of a millimetre-spaced surface
   * still bounds the silhouette far inside the screen margin.
   */
  let cachedFramingPoints = null;
  const framingPoints = () => {
    if (tractReferenceActive) return null;
    if (cachedFramingPoints) return cachedFramingPoints;
    const box = framingBounds();
    const meshes = model.visibleMeshes.filter(mesh =>
      box.intersectsBox(new Box3().setFromObject(mesh)));
    if (!meshes.length) return null;
    const stride = meshes.reduce((total, mesh) =>
      total + mesh.geometry.attributes.position.count, 0) > 60000 ? 8 : 1;
    const kept = [];
    const point = new Vector3();
    for (const mesh of meshes) {
      const position = mesh.geometry.attributes.position;
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < position.count; i += stride) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        // Only what the box already framed. A long supplemental layer can
        // reach into the box and far past it, and framing it would undo the
        // choice of what to frame; this keeps the fit no looser than the box's.
        if (box.containsPoint(point)) kept.push(point.x, point.y, point.z);
      }
    }
    cachedFramingPoints = kept.length ? new Float32Array(kept) : null;
    return cachedFramingPoints;
  };
  // The scene's fit, narrowed so the anatomy also clears the orientation letters and scale bar.
  let framingScale = { horizontal: 1, vertical: 1 };
  const clearedFit = () => {
    const fit = scene.viewportFit;
    return { horizontal: fit.horizontal * framingScale.horizontal, vertical: fit.vertical * framingScale.vertical };
  };
  const fittedDistance = direction =>
    fitDistance(scene.camera, framingBounds(), direction, clearedFit(),
      framingPoints());
  const isTargetingSpine = () =>
    !tractReferenceActive && Boolean(model.state.spinalCordVisible && (scene.controls.target.y < bounds.min.y || model.state.internalSystem === 'Spinal cord'));

  refitViewport = () => {
    if (!framed) return;
    const direction = viewDirection();
    const fitted = fittedDistance(direction);
    if (!(fitted > 0)) return;
    scene.camera.position.copy(scene.controls.target)
      .addScaledVector(direction, fitted * zoom);
    scene.controls.update();
    scene.invalidate();
  };

  // Framing fits above the stage dock, measured now: the section bar can change it in the same task.
  // Returns whether the framing changed.
  const applyFraming = ({ immediate = false } = {}) => {
    const { inset, scale } = chrome?.framing() ?? { inset: 0, scale: { horizontal: 1, vertical: 1 } };
    const rescaled = scale.horizontal !== framingScale.horizontal || scale.vertical !== framingScale.vertical;
    framingScale = scale;
    return scene.setFramingInset({ bottom: inset }, { immediate }) || rescaled;
  };
  const framingFit = ({ immediate = false } = {}) => {
    applyFraming({ immediate });
    return clearedFit();
  };

  // When the dock grows or shrinks, keep the camera's heading and scale its distance to the new room.
  let orbiting = false;
  let dockPending = false;
  function refitDock() {
    if (!framed || !chrome) return;
    if (orbiting) { dockPending = true; return; }
    const plan = scene.destination;
    const direction = plan.position.clone().sub(plan.target).normalize();
    const before = fittedDistance(direction);
    if (!applyFraming()) return;
    const after = fittedDistance(direction);
    if (!(before > 0 && after > 0)) return;
    const distance = plan.position.distanceTo(plan.target) * after / before;
    scene.moveTo({ ...plan, position: plan.target.clone().addScaledVector(direction, distance) });
  }

  /**
   * Frame the current view against the part of the canvas the interface is
   * not covering. Separate from `applyView` because the sheet reframes
   * without changing which view is chosen.
   */
  function frameCurrent({ immediate = false } = {}) {
    const fit = framingFit({ immediate: immediate || !framed });
    const { view } = session.assemble(model.state);
    scene.camera.up.copy(upFor(view));
    if (isTargetingSpine()) {
      const direction = VIEW_DIRECTIONS[view];
      const target = scene.controls.target.clone();
      const distance = scene.distanceToTarget > 0
        ? scene.distanceToTarget
        : fittedDistance(direction);
      const position = target.clone().addScaledVector(direction, distance);
      scene.moveTo(
        {
          position,
          target,
          near: scene.camera.near,
          far: scene.camera.far,
          minDistance: scene.controls.minDistance,
          maxDistance: scene.controls.maxDistance,
        },
        { immediate: immediate || !framed },
      );
    } else {
      scene.moveTo(
        planFraming(scene.camera, scene.controls, framingBounds(), VIEW_DIRECTIONS[view], frameTo,
          fit, framingPoints()),
        { immediate: immediate || !framed },
      );
    }
    framed = true;
    chrome?.holdView();
    render();
  }

  function applyView(view, { immediate = false } = {}) {
    if (!session.setView(view)) return;
    frameCurrent({ immediate });
  }

  /** The lesson step whose landmark is the selection, while that lesson is the open circuit. */
  function lessonLandmark() {
    const lesson = circuitSession.snapshot();
    if (!lesson.circuit || session.assemble(model.state).explorer !== 'circuits') return null;
    const step = circuitCatalog.get(lesson.circuit).steps[lesson.step];
    return step.region === model.state.selectedRegion?.id ? step : null;
  }

  /** A landmark is framed as its lesson authored it: that view, with anatomical context around it. */
  function frameLandmark(step) {
    const bounds = new Box3();
    for (const mesh of model.visibleMeshes) {
      if (mesh.userData.region_id === step.region) bounds.expandByObject(mesh);
    }
    if (bounds.isEmpty()) return false;
    session.setView(step.view);
    chrome?.releaseView();
    scene.camera.up.copy(upFor(step.view));
    // The meshes use metres; authored anatomical distances use millimetres.
    bounds.expandByScalar(circuitCatalog.contextMarginMm / 1000);
    scene.moveTo(planFraming(scene.camera, scene.controls, withContext(bounds),
      VIEW_DIRECTIONS[step.view], frameTo, framingFit()));
    return true;
  }

  /** Frame a deficit's drawn regions together, from the side they lie on when they share one. */
  function frameRegions(ids) {
    const wanted = new Set(ids);
    const meshes = model.visibleMeshes.filter(mesh => wanted.has(mesh.userData.region_id));
    if (!meshes.length) return;
    const box = new Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    // The same anatomical context a lesson landmark gets around it.
    box.expandByScalar(circuitCatalog.contextMarginMm / 1000);
    const framed = withContext(box);
    const direction = viewDirection();
    const sides = new Set(meshes.map(mesh => model.regions.get(mesh.userData.region_id)?.hemisphere)
      .filter(side => side === 'left' || side === 'right'));
    // Seen from the other side, a one-sided mapping is framed through the hemisphere in front of it.
    if (sides.size === 1 && Math.sign(direction.x) === (sides.has('left') ? 1 : -1)) direction.x *= -1;
    chrome?.releaseView();
    scene.moveTo(planFraming(scene.camera, scene.controls, framed, direction, frameTo,
      framingFit()));
  }

  function focusSelection() {
    const landmark = lessonLandmark();
    if (landmark && frameLandmark(landmark)) { render(); return; }
    const id = model.state.selectedRegion?.id;
    if (!id) return;
    const meshes = model.visibleMeshes.filter(m => m.userData.region_id === id);
    if (!meshes.length) return;
    const box = new Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    const direction = scene.camera.position.clone().sub(scene.controls.target).normalize();
    chrome?.releaseView();
    scene.moveTo(planFraming(
      scene.camera, scene.controls, box, direction, frameTo,
      framingFit()));
  }

  /** Open the tree branch that holds a region, so a selection is never out of sight. */
  function revealInTree(id) {
    const current = session.assemble(model.state);
    const group = catalog.groups(current).find(g => g.rows.some(r => r.region.id === id));
    if (group && !current.expanded.has(group.key)) session.toggleGroup(group.key);
  }

  function select(id) {
    model.select(id);
    if (id) revealInTree(id);
    render();
    if (id) {
      // Choosing the region already selected is also a request to read it.
      workspace?.showDetail();
      sheet?.revealOnSelect();
      chrome?.dismissHelp();
    }
  }

  /**
   * A control that hid or disabled itself with the selection leaves focus on
   * the page. The tab in front takes it: it is on screen in both shells.
   */
  function rescueFocus() {
    const current = document.activeElement;
    if (current && current !== document.body && !current.disabled
      && current.checkVisibility?.() !== false) return;
    const tabList = document.getElementById(sheet.isPhone ? 'sheet-tabs' : 'workspace-tabs');
    tabList?.querySelector('[role="tab"][aria-selected="true"]:not(:disabled)')?.focus();
  }

  async function setAtlas(id) {
    if (id === model.state.atlas) return;
    session.setSwitching(null);
    render();
    try {
      await model.setAtlas(id, progress => {
        if (progress?.total) {
          session.setSwitching({ loaded: progress.loaded, total: progress.total });
          render();
        }
      });
      session.setStatus('ready');
    } catch (error) {
      // The control reflects model.state.atlas, so it reverts on this render.
      const label = model.manifest.atlases.find(atlas => atlas.id === id)?.label ?? id;
      session.failSwitch(label, error);
    }
    render();
  }

  /**
   * Choose the label volume the cut samples. The cortical surface is untouched:
   * a cut atlas need not have a surface, and NextBrain has none.
   *
   * `sections` emits on success and on failure and reports its own error into
   * the cuts panel, so there is nothing to add but keeping the rejection in.
   */
  function setCutAtlas(id) {
    sections.setCutAtlas(id).catch(() => {});
  }

  /**
   * Choose which segmentation of the internal anatomy is drawn.
   *
   * Loading the fine level is a download, so it reports progress the way an
   * atlas switch does and leaves the model on screen while it arrives.
   */
  async function setDetail(id) {
    if (id === model.state.detail) return;
    session.setSwitching(null);
    render();
    try {
      await model.setDetail(id, progress => {
        if (progress?.total) {
          session.setSwitching({ loaded: progress.loaded, total: progress.total });
          render();
        }
      });
      session.setStatus('ready');
    } catch (error) {
      // The control reflects model.state.detail, so it reverts on this render.
      const level = model.manifest.detail_levels.find(level => level.id === id);
      session.failSwitch(level?.label ?? id, error);
    }
    render();
  }

  /** Undo whatever is hiding a region, then select it after loading completes. */
  async function reveal(reason, id) {
    if (reason === 'removed') model.showRegions([id]);
    if (reason === 'no-mri') await sections.setSurfaceColor('tissue');
    if (reason === 'cortex-hidden') { model.setCortexVisible(true); model.setCortexOpacity(1); }
    if (reason === 'internal-hidden') model.setInternalVisible(true);
    if (reason === 'spinal-cord-hidden') model.setSpinalCordVisible(true);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    // A cut-only region is nowhere until a plane exists. Coronal is the
    // conventional default, and the panel moves it from there.
    if (reason === 'no-cut') {
      await sections.setMode('coronal');
      const coords = model.centroidOf(id);
      if (coords && sections.active) {
        sections.setOffset(offsetThrough(coords, sections.frame.normal, sections.offsetRange));
      }
    }
    if (reason === 'other-detail') await setDetail(model.regions.get(id).atlas);
    if (reason === 'other-system') model.setInternalSystem(null);
    const region = model.regions.get(id);
    if (!model.canSelect(region)) {
      const next = visibilityOf(region, model.settings).reason;
      if (next === reason) throw new Error(`Cannot reveal ${id}: ${next}`);
      return reveal(next, id);
    }
    select(id);
  }

  function hideRegions(ids) {
    display(() => model.hideRegions(ids));
  }

  function setLang(lang) {
    session.setLang(lang);
    try { localStorage.setItem('neuroatlas-lang', lang); } catch {}
    shortcuts.setLanguage(lang);
    render();
  }

  // ---- panels -----------------------------------------------------------

  const header = createHeader({
    atlases: model.manifest.atlases,
    networks: model.manifest.networks,
    anatomy: model.manifest.anatomy,
    anatomies,
    manifest: model.manifest,
    manifestUrl,
    indexUrl: `${modelsUrl}/anatomies.json`,
    modelView: scene.domElement,
    onAtlas: setAtlas,
    onSurfaceColor: async value => {
      try {
        await sections.setSurfaceColor(value);
        render();
      } catch (error) {
        session.notify(error.message);
        render();
      }
    },
    onTheme: () => {
      theme.toggle();
      sections.applyTheme();
      session.setTheme(theme.current);
      render();
    },
    onLang: setLang,
    onSingleKeys: enabled => {
      keyPreference.set(enabled);
      shortcuts.setSingleKeys(enabled);
      render();
    },
    // Another brain is another set of assets, so this re-enters through the
    // URL rather than mutating the model in place. The rest of the state rides
    // along: the reader keeps their atlas, cut and language across the change.
    // Selection and dissection belong to the current subject's parcels.
    onAnatomy: id => {
      if (id === anatomy) return;
      const state = session.assemble(model.state);
      const hash = encodeState({
        ...state, anatomy: id, selectedRegion: null, isolatedRegion: null,
        hiddenRegions: new Set(),
      });
      globalThis.location.hash = hash;
      globalThis.location.reload();
    },
  });

  const onToggleAllGroups = () => {
    const state = session.assemble(model.state);
    const groups = catalog.groups(state);
    const allExpanded = groups.length > 0 && groups.every(g => state.expanded.has(g.key));
    if (allExpanded) {
      session.setExpanded([]);
    } else {
      session.setExpanded(groups.map(g => g.key));
    }
    render();
  };

  const navigator = createNavigator({
    catalog,
    atlases: model.manifest.atlases,
    cutAtlases: model.manifest.cut_atlases,
    // A name chosen from the list is a request to be shown. A click on the
    // model is not: the reader is already looking at the place they hit, and
    // moving the camera there would throw away the orbit they just made.
    onSelect: id => {
      const same = id != null && id === model.state.selectedRegion?.id;
      select(id);
      if (id && !same) focusSelection();
    },
    onToggleGroup: name => { session.toggleGroup(name); render(); },
    onToggleAllGroups,
    onQuery: query => { session.setQuery(query); render(); },
    onReveal: async (reason, id) => {
      await reveal(reason, id);
      if (id) focusSelection();
    },
    onAtlas: setAtlas,
    onCutAtlas: setCutAtlas,
    onHideRegions: hideRegions,
    onShowRegions: ids => display(() => model.showRegions(ids)),
  });

  const isolateSelection = () => display(() => {
    if (model.state.isolatedRegion) {
      model.clearIsolation();
      frameWhole();
    } else {
      model.isolate();
      focusSelection();
    }
  });

  const inspector = createInspector({
    catalog,
    networks: model.manifest.networks,
    onFocus: focusSelection,
    onIsolate: isolateSelection,
    onClear: () => {
      select(null);
      rescueFocus();
    },
    onHide: () => {
      const id = model.state.selectedRegion?.id;
      if (!id) return;
      session.setExplorer('anatomy');
      hideRegions([id]);
      showList();
      document.getElementById('dissection-undo').focus();
    },
    centroidOf: id => model.centroidOf(id),
  });

  const loadedLayers = () => ({
    atlas: model.settings.atlas, detail: model.settings.detail, cutAtlas: sections.state.cutAtlas,
  });

  /** The scene as its link carries it, plus the exact camera a link leaves out. */
  function captureReaderState() {
    const { position, target, near, far, minDistance, maxDistance } = scene.destination;
    return readerState({
      ...session.assemble(model.state),
      ...cutState(),
      camera: {
        position: position.clone(), target: target.clone(), up: scene.camera.up.clone(),
        near, far, minDistance, maxDistance, zoom,
        held: chrome.viewHeld,
      },
    }, loadedLayers());
  }

  /**
   * Put the scene in `target`, a complete reader state: layers before the system and parts
   * they hold, display before the cut, selection after both, camera last. Startup and Restore
   * share it; a shared link may skip what this build cannot show, a restore may not.
   */
  async function applyReaderState(target, { tolerant = false, immediate = false } = {}) {
    const step = async (action, skipped = error => console.warn('Ignored link state:', error.message)) => {
      if (!tolerant) return action();
      try { await action(); } catch (error) { skipped(error); }
    };
    await step(async () => {
      if (target.atlas !== model.settings.atlas) await setAtlas(target.atlas);
      if (target.atlas !== model.settings.atlas) throw new Error(`Atlas not applied: ${target.atlas}`);
    });
    await step(async () => {
      if (target.detail !== model.settings.detail) await setDetail(target.detail);
      if (target.detail !== model.settings.detail) throw new Error(`Detail level not applied: ${target.detail}`);
    });
    await step(() => {
      if (target.internalSystem !== model.settings.internalSystem) model.setInternalSystem(target.internalSystem);
    });
    await step(() => {
      const settings = model.settings;
      if (target.hemisphere !== settings.hemisphere) model.setHemisphere(target.hemisphere);
      if (target.cortexVisible !== settings.cortexVisible) model.setCortexVisible(target.cortexVisible);
      if (target.internalVisible !== settings.internalVisible) model.setInternalVisible(target.internalVisible);
      if (target.spinalCordVisible !== settings.spinalCordVisible) model.setSpinalCordVisible(target.spinalCordVisible);
      if (target.cortexOpacity !== settings.cortexOpacity) model.setCortexOpacity(target.cortexOpacity);
    });
    await step(() => {
      if (!sameRegions(target.hiddenRegions, model.settings.hiddenRegions)) {
        model.loadHiddenRegions([...target.hiddenRegions]);
      }
    });
    await step(async () => {
      if (target.surfaceColor !== model.settings.surfaceColor) await sections.setSurfaceColor(target.surfaceColor);
    });
    await step(async () => {
      if (target.cutAtlas !== sections.state.cutAtlas) await sections.setCutAtlas(target.cutAtlas);
    });
    await step(async () => {
      if (target.cut === 'off') {
        if (sections.active) await sections.setMode('off');
        return;
      }
      if (target.cut === 'oblique') sections.setAngles(target.cutTilt, target.cutAzimuth);
      await sections.setMode(target.cut);
      sections.setDisplay({ reverse: target.cutReverse });
      sections.setOffset(target.cutOffset);
    });
    // Isolation needs its region selected, so it is applied through a selection.
    await step(() => {
      if (target.isolatedRegion !== model.settings.isolatedRegion) {
        if (target.isolatedRegion) {
          model.select(target.isolatedRegion);
          model.isolate();
        } else {
          model.clearIsolation();
        }
      }
      if (target.selectedRegion !== (model.state.selectedRegion?.id ?? null)) model.select(target.selectedRegion);
      if (target.selectedRegion) revealInTree(target.selectedRegion);
    }, () => session.notify(t(session.assemble(model.state).lang, 'app').regionNotShown));
    await step(() => {
      if (target.camera === 'cut' && sections.active) faceCut({ immediate });
      else if (target.camera === 'cut' || target.camera === 'view') applyView(target.view, { immediate });
      else restoreCamera(target.view, target.camera, { immediate });
    });
  }

  function restoreCamera(view, pose, { immediate }) {
    session.setView(view);
    framingFit({ immediate });
    scene.camera.up.copy(pose.up);
    scene.moveTo(pose, { immediate });
    zoom = pose.zoom;
    if (pose.held) chrome.holdView(); else chrome.releaseView();
    render();
  }

  // The scene before this excursion's first deficit. Kept until it is restored or the deficit
  // closes, so Restore returns there whatever was changed since, as its label says.
  let beforeDeficit = null;
  let restoring = null;

  async function restoreBeforeDeficit() {
    restoring = applyReaderState(beforeDeficit);
    try {
      await restoring;
    } finally {
      restoring = null;
    }
    beforeDeficit = null;
    render();
  }

  /** Closing a deficit ends its excursion: the scene stays, and there is nothing left to restore. */
  function closeDeficit() {
    session.setDeficit(null);
    beforeDeficit = null;
    render();
  }

  /** The profile opens at once; the mapped regions are then drawn together and framed once. */
  async function openDeficit(id) {
    const regions = clinicalCatalog.mappedRegions(id);
    if (restoring) await Promise.allSettled([restoring]);
    // Before the detail opens: on a phone, raising the sheet reframes the camera.
    beforeDeficit ??= captureReaderState();
    session.setDeficit(id);
    session.setExplorer('deficits');
    render();
    showDetail();
    await revealClinicalRegions(model, sections, regions);
    if (session.assemble(model.state).selectedDeficit !== id) return;
    frameRegions(regions);
    render();
  }

  function chooseExplorer(value) {
    session.setExplorer(value);
    if (value === 'diffusion' && anatomy === nativeTracts.anatomy) {
      nativeTracts.enableOverlay();
      if (model.state.cortexOpacity === 1) model.setCortexOpacity(nativeTracts.defaultOpacity);
    }
    render();
  }

  const clinicalExplorer = createClinicalExplorer({
    clinical: clinicalCatalog,
    anatomy: catalog,
    onQuery: query => { session.setClinicalQuery(query); render(); },
    onDeficit: openDeficit,
    onRegion: async id => {
      beforeDeficit ??= captureReaderState();
      await openClinicalRegion(model, sections, id);
      focusSelection();
    },
    onRestore: restoreBeforeDeficit,
  });

  function frameInternal() {
    const internalBounds = new Box3();
    const isCord = model.state.internalSystem === 'Spinal cord';
    for (const mesh of model.visibleMeshes) {
      if (mesh.userData.kind !== 'structure') continue;
      if (!isCord && mesh.userData.atlas === 'zanatomy') continue;
      internalBounds.expandByObject(mesh);
    }
    if (internalBounds.isEmpty()) {
      for (const mesh of model.visibleMeshes) {
        if (mesh.userData.kind === 'structure') internalBounds.expandByObject(mesh);
      }
    }
    if (internalBounds.isEmpty()) return;
    scene.moveTo(planFraming(scene.camera, scene.controls, internalBounds,
      viewDirection(), frameTo, framingFit()));
  }

  /** Pull back to the whole brain along the direction the reader already has. */
  function frameWhole() {
    scene.moveTo(planFraming(scene.camera, scene.controls, framingBounds(),
      viewDirection(), frameTo, framingFit(), framingPoints()));
  }

  // Taken at each of the two doors in, and spent on the way out.
  let beforeInternal = null;

  async function enterInternal() {
    beforeInternal = captureBeforeInternal(model.state, model.defaultDetail);
    await sections.setMode('off');
    await setDetail(model.defaultDetail);
    model.setInternalSystem(null);
    model.setCortexVisible(false);
    model.setSurfaceColor('atlas');
    session.setQuery('');
    frameInternal();
    render();
  }

  async function leaveInternalAnatomy() {
    const changes = leaveInternal(beforeInternal, model.state);
    beforeInternal = null;
    // Both setters release isolation, which would otherwise hold the cortex
    // hidden behind whichever single structure the reader had isolated.
    model.setInternalSystem(changes.internalSystem);
    model.setCortexVisible(changes.cortexVisible);
    model.setSurfaceColor(changes.surfaceColor);
    if (changes.detail) await setDetail(changes.detail);
    session.setQuery('');
    frameWhole();
    render();
  }

  const internalAnatomy = createInternalAnatomy({
    manifest: model.manifest,
    onToggle: () => (insideInternal(model.state) ? leaveInternalAnatomy() : enterInternal()),
    onSystem: system => {
      // The other door in, and it has to land the reader where the button does:
      // otherwise a network legend is left over a cortex that is not drawn.
      if (!insideInternal(model.state)) {
        beforeInternal = captureBeforeInternal(model.state, model.state.detail);
        model.setSurfaceColor('atlas');
        model.setCortexVisible(false);
      }
      model.setInternalSystem(system);
      session.setQuery('');
      const group = catalog.groups(session.assemble(model.state)).find(entry => entry.kind === 'structure');
      if (system && group && !session.assemble(model.state).expanded.has(group.key)) {
        session.toggleGroup(group.key);
      }
      frameInternal();
      render();
    },
  });

  const constituents = createConstituents({
    catalog,
    onRegion: async id => {
      model.setInternalSystem(null);
      await openClinicalRegion(model, sections, id);
      focusSelection();
    },
  });

  const hasSpinalCord = (model.manifest.supplemental_layers ?? [])
    .some(layer => layer.id === 'zanatomy');

  function setSpinalCordVisible(visible) {
    display(() => {
      model.setSpinalCordVisible(visible);
      frameWhole();
    });
  }

  const display_ = createDisplay({
    detailLevels: model.manifest.detail_levels,
    hasSpinalCord,
    onDetail: setDetail,
    onHemisphere: value => display(() => {
      model.setHemisphere(value);
      frameWhole();
    }),
    onCortexVisible: value => display(() => model.setCortexVisible(value)),
    onCortexOpacity: value => display(() => model.setCortexOpacity(value)),
    onInternalVisible: value => display(() => model.setInternalVisible(value)),
    onSpinalCordVisible: setSpinalCordVisible,
    onReset: () => {
      // The opening picture: display, cut, camera, and the list. Not wrapped
      // in display(), which would announce the cleared selection as a mishap.
      session.setQuery('');
      sections.setMode('off');
      model.reset();
      scene.controls.target.copy(bounds.getCenter(new Vector3()));
      applyView('oblique');
    },
  });

  const dissectionControls = createDissectionControls({
    onUndo: () => display(() => model.undoDissection()),
    onRestore: () => display(() => model.restoreHiddenRegions()),
  });

  function faceCut({ immediate = false } = {}) {
    if (!sections.active) return;
    const frame = sections.frame;
    const sliceWorldCenter = rasToWorld(frame.center.toArray());
    const direction = rasToWorld(frame.normal.toArray()).normalize()
      .multiplyScalar(sections.state.reverse ? -1 : 1);
    session.setView(cutFacingView(sections.state.mode, sections.state.reverse));
    // An oblique cut is faced along its own normal, which is no preset's direction.
    if (sections.state.mode === 'oblique') chrome?.releaseView(); else chrome?.holdView();
    scene.camera.up.copy(rasToWorld(frame.v.toArray()).normalize());
    const cutBounds = sliceWorldCenter.y < bounds.min.y
      ? new Box3(sliceWorldCenter.clone().subScalar(0.04), sliceWorldCenter.clone().addScalar(0.04))
      : bounds;
    scene.moveTo(planFraming(scene.camera, scene.controls, cutBounds, direction, frameTo,
      framingFit({ immediate }), cutBounds === bounds ? framingPoints() : null), { immediate });
    render();
  }

  const sectionControls = createSectionControls(sections, {
    anatomy: model.manifest.anatomy,
    cutAtlases: model.manifest.cut_atlases,
    onFaceView: faceCut,
    onSelect: select,
    getSelectedRegion: () => model.state.selectedRegion,
    centroidOf: id => model.centroidOf(id),
  });

  async function openLandmark(step) {
    await openCircuitLandmark(model, sections, step);
    if (!frameLandmark(step)) throw new Error(`Landmark geometry unavailable: ${step.region}`);
  }

  // The view a lesson was opened from; stepping back to the list returns the camera to it.
  let readerView = null;
  function rememberReaderView() {
    if (!lessonLandmark()) readerView = session.assemble(model.state).view;
  }
  function leaveLandmark() {
    if (!lessonLandmark() || !readerView) return;
    session.setView(readerView);
    frameCurrent();
  }

  const circuitExplorer = createCircuitExplorer({
    catalog: circuitCatalog,
    onCircuit: async id => {
      const circuit = circuitCatalog.get(id);
      rememberReaderView();
      showDetail();
      await openLandmark(circuit.steps[0]);
      circuitSession.start(id);
      render();
    },
    onLandmark: async (id, index) => {
      rememberReaderView();
      session.setExplorer('circuits');
      showDetail();
      await openLandmark(circuitCatalog.get(id).steps[index]);
      circuitSession.start(id);
      circuitSession.go(index);
      render();
    },
    onStep: async index => {
      const lesson = circuitSession.snapshot();
      const step = circuitCatalog.get(lesson.circuit).steps[index];
      if (!step) throw new RangeError(`Invalid landmark index: ${index}`);
      await openLandmark(step);
      circuitSession.go(index);
      render();
      if (session.assemble(model.state).explorer === 'circuits') showDetail();
    },
    onMri: async () => {
      const lesson = circuitSession.snapshot();
      const step = circuitCatalog.get(lesson.circuit).steps[lesson.step];
      const canOpen = () => {
        const current = circuitSession.snapshot();
        return session.assemble(model.state).explorer === 'circuits'
          && current.circuit === lesson.circuit && current.step === lesson.step;
      };
      await openLandmark(step);
      if (!canOpen()) return;
      await prepareCircuitMri(model, sections, step);
      if (!canOpen()) return;
      faceCut();
      await sectionControls.openPreparedPlane(step.plane, canOpen);
      render();
    },
    onAnswer: index => { circuitSession.answer(index); render(); },
    onDeficit: id => clinicalExplorer.openDeficit(id),
  });
  // Under a lesson the landmark's Linked MRI opens the lesson's prepared plane, ahead of the plain one.
  const onLessonMri = event => {
    if (!event.target.closest?.('#region-mpr') || !lessonLandmark()) return;
    event.stopPropagation();
    circuitExplorer.openMri();
  };
  document.getElementById('inspector').addEventListener('click', onLessonMri, true);
  nativeTracts = createNativeTractExplorer({
    scene,
    anatomy,
    sections,
    onCortexOpacity: value => display(() => model.setCortexOpacity(value)),
    onActive(active) {
      tractReferenceActive = active;
      hovered = null;
      chrome?.showHover(null, null);
      scene.setOutlined();
      cachedFramingBounds = null;
      cachedFramingPoints = null;
      zoom = 1;
      if (!active || nativeTracts.ready) frameCurrent({ immediate: true });
      scene.invalidate();
    },
    onReady() {
      if (tractReferenceActive) frameCurrent({ immediate: true });
      render();
    },
    // The stage's direction key follows whether any streamline is drawn.
    onVisibility: () => render(),
  });
  const shortcuts = createShortcuts(initialLang);
  shortcuts.setSingleKeys(keyPreference.enabled);

  const onSnapshot = () => {
    try {
      const dataUrl = scene.captureSnapshot();
      const link = document.createElement('a');
      link.download = `neuroatlas-${model.state.atlas ?? 'brain'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
    }
  };

  chrome = createViewportChrome({
    networks: model.manifest.networks,
    onView: applyView,
    onRetry: reloadWithoutStoredModels,
    onSnapshot,
    onDock: refitDock,
    controls: scene.controls,
  });
  chrome.setViewport(scene.visibleRect, scene.hostSize);

  // Built before the sheet: the sheet decides on construction which shell owns
  // the panels, and hands them over through onShell.
  workspace = createWorkspace({
    onMode: chooseExplorer,
    onClear: clearContext,
    onViewChange: () => scene.invalidate(),
    onReturn: leaveLandmark,
  });

  /*
   * The phone shell. It reports how much of the canvas it covers rather than
   * resizing it, and everything that must agree about where the viewport is —
   * framing, the markers, the presets — reads that one
   * rectangle back from the scene.
   */
  sheet = createSheet({
    onSelection: () => workspace.showDetail(),
    onClear: clearContext,
    onShell: shell => {
      if (shell === 'sheet') workspace.deactivate();
      else workspace.activate();
    },
    onInsets: insets => {
      scene.setChromeInsets(insets);
      chrome?.setViewport(scene.visibleRect, scene.hostSize);
    },
    // Reframing during a drag would fight the finger; on arrival the camera
    // eases to the new rectangle, which is the one thing allowed to animate.
    onDetent: () => { if (framed) frameCurrent(); },
  });

  function showList() {
    workspace.showList();
    sheet.raise();
  }

  function showDetail() {
    workspace.showDetail();
    sheet.raise();
  }

  /** The strip's clear takes the region first, then the deficit it sits under. */
  function clearContext() {
    if (model.state.selectedRegion) return select(null);
    const state = session.assemble(model.state);
    if (state.explorer === 'deficits' && state.selectedDeficit) closeDeficit();
  }

  /** What the selection strip names: the region, else the deficit or lesson in front. */
  function contextStrip(state, referenceOnly) {
    const region = referenceOnly ? null : state.selectedRegion;
    if (region) {
      return {
        kind: lessonLandmark() ? 'landmark' : 'region',
        label: catalog.get(region.id)?.label.name ?? region.label,
        side: t(state.lang, 'sides').glyphs[region.hemisphere] ?? '',
        clearable: true,
      };
    }
    if (state.explorer === 'deficits' && state.selectedDeficit) {
      return { kind: 'deficit', label: clinicalCatalog.get(state.selectedDeficit).name[state.lang], clearable: true };
    }
    if (state.explorer === 'circuits' && state.lesson.circuit) {
      return { kind: 'lesson', label: circuitCatalog.get(state.lesson.circuit).name[state.lang], clearable: false };
    }
    return {};
  }

  // ---- the single render path -------------------------------------------

  let announced = null;
  let announcedNotice = null;
  let announcedStatus = null;

  function render() {
    cachedFramingBounds = null;
    cachedFramingPoints = null;
    const state = { ...session.assemble(model.state), lesson: circuitSession.snapshot(),
      anatomy, referenceAnatomy: nativeTracts.anatomy };
    const referenceOnly = isIndependentTractReference(state);
    model.group.visible = !referenceOnly;
    sections.group.visible = !referenceOnly && sections.active;
    catalog.setLanguage(state.lang);
    document.documentElement.lang = state.lang;
    root.dataset.status = state.status;
    const visibleCount = catalog.visibleCount(state);
    if (anatomy === nativeTracts.anatomy) nativeTracts.setClippingPlanes(model.clippingPlanes);
    scene.setMriAppearance(state.surfaceColor === 'mri' && !referenceOnly);
    const viewportCopy = t(state.lang, 'viewport');
    scene.domElement.setAttribute('aria-label', referenceOnly
      ? nativeTracts.reference(state.lang).canvasLabel : viewportCopy.canvasLabel);
    scene.domElement.setAttribute('aria-roledescription', viewportCopy.canvasRole);

    header.update(referenceOnly ? { ...state, surfaceColor: 'tissue' } : state, { visibleCount,
      reference: referenceOnly ? nativeTracts.reference(state.lang) : null,
      tracts: state.explorer === 'diffusion' ? nativeTracts.reference(state.lang).detail : null,
      singleKeys: keyPreference.enabled });
    navigator.update(state);
    inspector.update(state);
    const strip = contextStrip(state, referenceOnly);
    sheet.update(state, strip);
    workspace.update(state, strip, state.explorer === 'circuits' && state.lesson.circuit
      ? circuitCatalog.get(state.lesson.circuit).name[state.lang] : null);
    clinicalExplorer.update(state, { restorable: beforeDeficit !== null });
    circuitExplorer.update(state);
    nativeTracts.update(state);
    display_.update(state);
    dissectionControls.update(state);
    document.getElementById('dissection-controls').hidden = referenceOnly
      || state.explorer !== 'anatomy';
    internalAnatomy.update(state);
    constituents.update(state);
    sectionControls.update(state);
    chrome.update(referenceOnly ? { ...state, surfaceColor: 'tissue' } : state,
      { directionKey: nativeTracts.streamlinesVisible });
    shortcuts.setLanguage(state.lang);
    outline();
    syncUrl(state);

    // The text state is the product for a reader who cannot see the render.
    const region = state.selectedRegion;
    const spoken = region
      ? t(state.lang, 'app').spoken(
          catalog.get(region.id).label.name,
          t(state.lang, 'sides').words[region.hemisphere] ?? region.hemisphere,
        )
      : null;
    // A notice explains a change the reader may not be looking at, so it
    // outranks the selection it often accompanies.
    const notice = state.notice ?? null;
    if (notice && notice !== announcedNotice) announce(notice);
    else if (spoken !== announced) announce(spoken ?? '');
    if (state.status === 'context-lost' && announcedStatus !== 'context-lost') {
      announce(state.error.message);
    } else if (announcedStatus === 'context-lost' && state.status === 'ready') {
      announce(viewportCopy.loaded);
    }
    announced = spoken;
    announcedNotice = notice;
    announcedStatus = state.status;
  }

  /*
   * What the pointer is over, and where. Kept out of the state loop: it is
   * answered once per frame of a pointer move, and a full re-render would
   * rebuild every panel that often.
   */
  let hovered = null;

  /** Both hemispheres share every name, so the chip says which side as well. */
  function hoverText(region) {
    if (!region) return null;
    const name = catalog.get(region.id)?.label.name ?? region.label;
    const side = t(session.assemble(model.state).lang, 'sides').capitalized[region.hemisphere];
    return side ? `${name} · ${side}` : name;
  }

  /** Mark what the pointer is on — a cut face lights, a surface outlines — and name it. */
  function highlight() {
    if (hovered?.region && !model.canSelect(hovered.region)) hovered = null;
    const region = hovered?.region;
    sections.setHighlight({
      hovered: region?.id,
      selected: model.state.selectedRegion?.id,
    });
    chrome?.showHover(hoverText(region), hovered?.position);
    scene.invalidate();
  }

  function outline() {
    if (tractReferenceActive) { scene.setOutlined(); return; }
    highlight();
    // An outline is drawn from an unclipped depth render, so on a cut it would
    // ring the whole solid rather than the face. The cut lights its faces
    // instead, which is what `highlight` just did.
    if (sections.active) { scene.setOutlined(); return; }
    const meshes = model.visibleMeshes;
    const meshFor = id => {
      const mesh = id && meshes.find(m => m.userData.region_id === id);
      return mesh ? [mesh] : [];
    };
    const selected = meshFor(model.state.selectedRegion?.id);
    const { explorer, selectedDeficit } = session.assemble({});
    const wanted = new Set(explorer === 'deficits' && selectedDeficit
      ? clinicalCatalog.mappedRegions(selectedDeficit) : []);
    const mapped = wanted.size ? meshes.filter(mesh => wanted.has(mesh.userData.region_id)) : [];
    // An open deficit outlines all its drawn regions; once one is selected, the rest recede to the halo.
    scene.setOutlined({
      selected: selected.length ? selected : mapped,
      hovered: [...meshFor(hovered?.region?.id), ...(selected.length ? mapped : [])],
    });
  }

  const CUT_LINKS = new Set(['sagittal', 'coronal', 'axial', 'oblique']);

  /** The plane is not session state. It still belongs in the link. */
  function cutState() {
    const cut = sections.state;
    if (!CUT_LINKS.has(cut.mode)) return {};
    return {
      cut: cut.mode,
      cutOffset: new Vector3(...cut.crosshair).dot(sections.frame.normal),
      cutReverse: cut.reverse,
      cutTilt: cut.tilt,
      cutAzimuth: cut.azimuth,
    };
  }

  function cutLink() {
    const cut = cutState();
    return cut.cut ? { ...cut, cutOffset: Math.round(cut.cutOffset * 10) / 10 } : cut;
  }

  let urlTimer = null;
  function syncUrl(state) {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      // The brain is fixed for the life of the page, so it is not session
      // state — but it has to be in the link. Region ids are shared between
      // brains, so a link without it reopens someone else's anatomy.
      const hash = encodeState({ ...state, ...cutLink(), anatomy });
      // replaceState, not push: the back button is not a camera undo stack.
      history.replaceState(null, '', hash ? `#${hash}` : globalThis.location.pathname);
    }, 250);
  }

  function focusPoint(point) {
    chrome?.releaseView();
    const delta = point.clone().sub(scene.controls.target);
    const minDistance = point.y < bounds.min.y
      ? Math.min(scene.controls.minDistance, 0.015)
      : scene.controls.minDistance;
    scene.moveTo({
      position: scene.camera.position.clone().add(delta),
      target: point.clone(),
      near: scene.camera.near,
      far: scene.camera.far,
      minDistance,
      maxDistance: scene.controls.maxDistance,
    });
  }

  picker = createPicker({
    domElement: scene.domElement,
    camera: scene.camera,
    model: () => tractReferenceActive ? { pick: () => null } : sections,
    onHover: (region, position) => {
      const regionChanged = region?.id !== hovered?.region?.id;
      hovered = region ? { region, position } : null;
      if (regionChanged) {
        if (sections.active) highlight(); else outline();
      } else if (position) {
        chrome?.showHover(hoverText(region), position);
      }
    },
    onSelect: select,
    onFocusPoint: focusPoint,
  });

  // Declared as a function so the scene's resize callback, wired above before
  // the chrome exists, can reach it.
  function onCameraChange() {
    if (!chrome) return;
    chrome.updateCamera(scene.camera, scene.distanceToTarget, scene.viewportHeight);
  }
  scene.controls.addEventListener('change', onCameraChange);
  function rememberZoom() {
    const fitted = fittedDistance(viewDirection());
    if (fitted > 0) zoom = scene.distanceToTarget / fitted;
  }
  scene.controls.addEventListener('end', rememberZoom);
  // A dock change during a drag waits for the pointer to lift.
  scene.controls.addEventListener('start', () => { orbiting = true; });
  scene.controls.addEventListener('end', () => {
    orbiting = false;
    if (dockPending) { dockPending = false; refitDock(); }
  });

  /**
   * The canvas is focusable and tells a reader it can be rotated and zoomed.
   * With a pointer that was already true; these are the same two gestures for
   * someone who has no pointer. They are handled only while the canvas itself
   * holds focus, so the arrows keep walking the region tree everywhere else.
   */
  function orbitFromKeyboard(event) {
    if (event.target !== scene.domElement) return false;
    const turn = ORBIT_KEYS[event.key];
    const dolly = DOLLY_KEYS[event.key];
    if (!turn && !dolly) return false;
    event.preventDefault();
    scene.camera.position.copy(turn
      ? orbitedPosition(
        scene.camera.position, scene.controls.target, scene.camera.up, turn)
      : dolliedPosition(
        scene.camera.position, scene.controls.target, dolly,
        { min: scene.controls.minDistance, max: scene.controls.maxDistance }));
    scene.controls.update();
    // A drag reports its zoom when the pointer lifts; a key press has no
    // equivalent moment, so it reports its own.
    rememberZoom();
    return true;
  }

  function chooseView(view) {
    chrome.dismissHelp();
    applyView(view);
  }

  const onKeyDown = event => {
    if (event.defaultPrevented) return;
    if (nativeTracts.mriOpen) return;
    const mprDialog = document.getElementById('mpr-dialog');
    if (mprDialog?.open) {
      if (event.key.toLowerCase() === 'm' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        mprDialog.close();
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (tractReferenceActive && event.key === 'Escape') return;
    if (event.key === 'Escape') {
      // The dialog closes itself; the selection under it is not the target.
      // A search field gives up its text first. Once that is empty, Escape
      // steps back through the region and then the deficit.
      if (shortcuts.isOpen) return;
      // Inside a detail view Escape is Back; the selection stays for a second Escape.
      if (workspace.focusInDetail) {
        workspace.back();
        return;
      }
      const view = session.assemble(model.state);
      if (document.activeElement === document.getElementById('search') && view.query) {
        session.setQuery('');
        render();
      } else if (model.state.selectedRegion) {
        select(null);
        rescueFocus();
      } else if (view.selectedDeficit) {
        closeDeficit();
        rescueFocus();
      }
      return;
    }
    if (!shortcutsAllowed(event.target, event.key)) return;
    if (orbitFromKeyboard(event)) return;
    // WCAG 2.1.4: one-character shortcuts can be turned off, and never act
    // from a control that has keys of its own.
    if (isCharacterKey(event.key)
      && !characterShortcutAllowed(event.target, keyPreference.enabled)) return;
    if (event.key === '?') { event.preventDefault(); return shortcuts.toggle(); }
    if (shortcuts.isOpen) return;
    if (event.key === '/') {
      event.preventDefault();
      showList();
      if (session.assemble(model.state).explorer === 'deficits') clinicalExplorer.focusSearch();
      else if (session.assemble(model.state).explorer === 'circuits') {
        circuitExplorer.focus();
      }
      else if (session.assemble(model.state).explorer === 'diffusion') nativeTracts.focus();
      else navigator.focusSearch();
      return;
    }
    if (session.assemble(model.state).explorer !== 'anatomy'
      && ['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); navigator.moveFocus(1); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); navigator.moveFocus(-1); return; }
    if (event.key === '0') return chooseView('oblique');
    const index = Number(event.key) - 1;
    if (VIEW_KEYS[index]) return chooseView(VIEW_KEYS[index]);
    if (event.key.toLowerCase() === 'm' && session.assemble(model.state).explorer === 'diffusion') {
      event.preventDefault();
      nativeTracts.openMri();
      return;
    }
    if (tractReferenceActive) return;
    if (event.key.toLowerCase() === 'f') {
      if (model.state.selectedRegion) {
        event.preventDefault();
        focusSelection();
      }
      return;
    }
    if (event.key.toLowerCase() === 'i') {
      if (model.state.selectedRegion) {
        event.preventDefault();
        isolateSelection();
      }
      return;
    }
    if (event.key.toLowerCase() === 'c') {
      return display(() => model.setCortexVisible(!model.state.cortexVisible));
    }
    if (event.key.toLowerCase() === 'u') {
      return display(() => model.setInternalVisible(!model.state.internalVisible));
    }
    if (event.key.toLowerCase() === 's') {
      return setSpinalCordVisible(!model.state.spinalCordVisible);
    }
    if (event.key.toLowerCase() === 'h') {
      const order = ['both', 'left', 'right'];
      const next = order[(order.indexOf(model.state.hemisphere) + 1) % order.length];
      return display(() => model.setHemisphere(next));
    }
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      document.getElementById('mpr-open')?.click();
      return;
    }
  };
  globalThis.addEventListener('keydown', onKeyDown);

  // ---- start ------------------------------------------------------------

  model.addEventListener('change', render);
  sections.addEventListener('change', render);
  scene.applyTheme();
  session.setTheme(theme.current);
  scene.setSize();
  // The camera starts inside the brain; frame it before the link's layers load around it.
  applyView(session.assemble(model.state).view, { immediate: true });
  // The load already applied the link's atlas and detail level, or fell back from ones this
  // build does not publish. An unknown cut atlas or view falls back the same way.
  const publishes = (entries, id) => (entries.some(entry => entry.id === id) ? id : undefined);
  await applyReaderState(readerState({
    ...wanted,
    atlas: model.settings.atlas,
    detail: model.settings.detail,
    cutAtlas: publishes(model.manifest.cut_atlases, wanted.cutAtlas),
    view: Object.hasOwn(VIEW_DIRECTIONS, wanted.view ?? '') ? wanted.view : undefined,
    // Without a view of its own, the link faces its cut, as choosing the cut does.
    camera: viewForRestoredCut({ cut: wanted.cut, reverse: wanted.cutReverse, view: wanted.view })
      ? 'cut' : 'view',
  }, loadedLayers()), { tolerant: true, immediate: true });
  // Before the stage reports ready, so the first hover does not compile
  // outline shaders in the frame the pointer arrives.
  try { scene.warmOutlines(model.group); }
  catch (error) { console.error(error); }
  session.setStatus('ready');
  chrome.setViewport(scene.visibleRect, scene.hostSize);
  onCameraChange();
  // Before the render, which replaces it with a restored selection if there is one.
  announce(t(session.assemble(model.state).lang, 'viewport').loaded);
  render();
  prefetchIdleLayers(model);

  return {
    dispose() {
      globalThis.removeEventListener('keydown', onKeyDown);
      scene.controls.removeEventListener('change', onCameraChange);
      clearTimeout(urlTimer);
      sheet.dispose();
      workspace.dispose();
      sections.removeEventListener('change', render);
      model.removeEventListener('change', render);
      sectionControls.dispose();
      sections.dispose();
      shortcuts.dispose();
      picker.dispose();
      chrome.dispose();
      display_.dispose();
      dissectionControls.dispose();
      internalAnatomy.dispose();
      constituents.dispose();
      inspector.dispose();
      clinicalExplorer.dispose();
      circuitExplorer.dispose();
      document.getElementById('inspector').removeEventListener('click', onLessonMri, true);
      nativeTracts.dispose();
      navigator.dispose();
      header.dispose();
      model.dispose();
      scene.dispose();
    },
  };
}
