import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCatalog } from './catalog/catalog.js';
import { readComparisonGeometry } from './comparison/assets.js';
import { createComparisonOverlay } from './comparison/overlay.js';
import { visibilityOf } from './catalog/visibility.js';
import { loadClinicalCatalog } from './clinical/load.js';
import { loadCircuitCatalog } from './learning/load.js';
import { createCircuitSession } from './learning/session.js';
import { prepareCircuitMri, showCircuitLandmark } from './learning/navigation.js';
import { BrainAtlas } from './model/brain-atlas.js';
import { functionalName, functionalRegionOf } from './catalog/functional-regions.js';
import { domainName, domainsOf } from './catalog/neuropsych-domains.js';
import { cabNpName, networkName } from './catalog/networks.js';
import { loadAnatomies, resolveAnatomy } from './model/published-anatomy.js';
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
import { PARAMS, decodeState, encodeState, orbitWithin } from './state/url-state.js';
import { checkLink } from './state/link-check.js';
import { applyReaderState as restoreReaderState, readerState } from './state/reader-state.js';
import { createSceneCommands, publishesSpinalCord } from './state/scene-commands.js';
import { createLinkWriter, sameSubject } from './state/link-writer.js';
import { prefetchAtlas, startLanguage } from './state/boot.js';
import { BrainSections } from './slices/sections.js';
import { offsetThrough, rasToWorld } from './slices/coordinates.js';
import { createSectionControls } from './ui/chrome/sections.js';
import { createInternalAnatomy } from './ui/panels/internal-anatomy.js';
import { createConstituents } from './ui/panels/constituents.js';
import { createDisplay } from './ui/chrome/display.js';
import { createDissectionControls } from './ui/panels/dissection.js';
import { createHeader, createSettings, paintColophon } from './ui/chrome/header.js';
import { createInspector } from './ui/panels/inspector.js';
import { createAtlasComparison } from './ui/panels/atlas-comparison.js';
import { createClinicalExplorer, revealNotice } from './ui/panels/clinical.js';
import { createCircuitExplorer } from './ui/panels/circuits.js';
import { createInvolvement } from './ui/panels/related.js';
import { createNativeTractExplorer } from './diffusion/native-ui.js';
import { isIndependentTractReference } from './diffusion/presentation.js';
import { createNavigator } from './ui/panels/navigator.js';
import {
  characterShortcutAllowed, createKeyPreference, createShortcuts, isCharacterKey,
} from './ui/chrome/shortcuts.js';
import { createViewportChrome, paintLoadProgress } from './ui/chrome/viewport-chrome.js';
import { createSheet } from './ui/chrome/sheet.js';
import { MODES, createWorkspace } from './ui/chrome/workspace.js';
import { createNotice } from './ui/chrome/notice.js';
import { qualityProfile } from './render/quality.js';
import { failureNotice, linkNotice } from './i18n/errors.js';
import { atlasSwitchLabel, t } from './i18n/translations.js';

const VIEW_KEYS = ['left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/** Once the first atlas is on screen, pull the other cortical atlas in while the reader is looking. */
function prefetchOtherAtlas(model) {
  const atlas = prefetchAtlas(model.manifest.atlases, model.state.atlas, {
    prefetchLayers: qualityProfile().prefetchLayers, connection: globalThis.navigator?.connection,
  });
  if (!atlas) return;
  const idle = globalThis.requestIdleCallback ?? (fn => setTimeout(fn, 1500));
  idle(() => {
    model.loadLayer(atlas.id, atlas.file).catch(error => console.warn('Prefetch failed:', error));
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

  // A link is applied field by field: what this anatomy cannot apply is named, not fatal.
  const link = decodeState(globalThis.location.hash);
  const wanted = link.state;
  let savedLang = null;
  try { savedLang = localStorage.getItem('neuroatlas-lang'); } catch {}
  const initialLang = startLanguage(globalThis.location.hash, savedLang);
  // Spoken at the start, end and failure of the load, not at every progress tick.
  const announce = text => { announcer.textContent = text; };
  announce(t(initialLang, 'viewport').loadingAnatomy);
  paintColophon(initialLang);
  // Resolve the requested subject before constructing a scene for it.
  const modelsUrl = `${import.meta.env.BASE_URL}models`;
  const published = await loadAnatomies(`${modelsUrl}/anatomies.json`);
  const anatomies = published.anatomies;
  const unpublished = wanted.anatomy !== undefined && !anatomies.some(entry => entry.id === wanted.anatomy);
  if (unpublished) link.rejected.push('anatomy');
  const anatomy = resolveAnatomy(published, unpublished ? undefined : wanted.anatomy);
  const manifestUrl = `${modelsUrl}/${anatomy}/manifest.json`;
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
  // One path for the reader's choice and a live OS switch. The cut faces and
  // the chrome join it once they exist (see "start").
  let afterTheme = null;
  const theme = createTheme(current => {
    scene.applyTheme();
    session.setTheme(current);
    afterTheme?.();
  });
  // The settings menu does not wait on the anatomy. Until it has loaded, a setting repaints
  // only what is on screen: the menu, the stage's message and the status bar.
  const shortcuts = createShortcuts(initialLang);
  shortcuts.setSingleKeys(keyPreference.enabled);
  const settings = createSettings({
    modelView: scene.domElement,
    onTheme: choice => theme.choose(choice),
    onLang: setLang,
    onSingleKeys: enabled => {
      keyPreference.set(enabled);
      shortcuts.setSingleKeys(enabled);
      repaint();
    },
  });
  function paintLoading() {
    const { lang, status, progress } = session.assemble({});
    document.documentElement.lang = lang;
    settings.update({ lang, status }, { singleKeys: keyPreference.enabled, themeChoice: theme.choice });
    shortcuts.setLanguage(lang);
    paintColophon(lang);
    paintLoadProgress(lang, progress?.loaded, progress?.total);
  }
  let repaint = paintLoading;
  afterTheme = paintLoading;
  paintLoading();

  // The layers download in parallel. Once one has failed, the other's
  // progress must not paint "Loading" back over the error.
  let loadFailed = false;
  const loadModel = (atlas, detail) => BrainAtlas.load(manifestUrl, atlas, {
    detail,
    onProgress: progress => {
      if (loadFailed || !progress?.total) return;
      session.setProgress({ loaded: progress.loaded, total: progress.total });
      paintLoadProgress(session.assemble({}).lang, progress.loaded, progress.total);
    },
  });
  let model;
  try {
    try {
      model = await loadModel(wanted.atlas, wanted.detail);
    } catch (error) {
      // A layer the link names that this anatomy does not publish: open the defaults. The link's
      // check then names the unknown layer and applies a published one the other kept from loading.
      if (error.code !== 'unknown-layer') throw error;
      console.error(error);
      model = await loadModel(undefined, undefined);
    }
  } catch (error) {
    loadFailed = true;
    announce(failureNotice(error, initialLang, 'start').text);
    settings.dispose();
    theme.dispose();
    scene.dispose();
    throw error;
  }

  const catalog = createCatalog(model.manifest, initialLang, model.cabNp);
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

  const sections = new BrainSections(model, new URL('volumes.json', new URL(manifestUrl, location.href)));
  scene.scene.add(sections.group);
  const commands = createSceneCommands({ model, sections, session, render });

  // ---- commands ---------------------------------------------------------

  /** Apply a display change, and say so if it silently dropped the selection. */
  function display(change) {
    const had = model.state.selectedRegion;
    // A display change is the reader's next action, which a standing notice lasts until.
    session.notify(null);
    change();
    notifyClearedSelection(had);
    render();
  }

  function notifyClearedSelection(had) {
    if (had && !model.state.selectedRegion) {
      const state = session.assemble(model.state);
      const name = catalog.get(had.id)?.label.name ?? had.label;
      session.notify({ text: t(state.lang, 'app').selectionCleared(name) });
    }
  }

  let framed = false;
  let sheet;
  let workspace;

  // replaceState, not push: the back button is not a camera undo stack.
  const linkWriter = createLinkWriter(() => {
    const hash = encodeState(linkState());
    history.replaceState(null, '', hash ? `#${hash}` : globalThis.location.pathname + globalThis.location.search);
  });
  const scheduleUrl = linkWriter.schedule;

  // Every camera move is a change the link has to follow.
  function moveCamera(plan, options) {
    scene.moveTo(plan, options);
    scheduleUrl();
  }

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
    const { inset, scale } = chrome?.framing() ?? { inset: {}, scale: { horizontal: 1, vertical: 1 } };
    const rescaled = scale.horizontal !== framingScale.horizontal || scale.vertical !== framingScale.vertical;
    framingScale = scale;
    return scene.setFramingInset(inset, { immediate }) || rescaled;
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
    moveCamera({ ...plan, position: plan.target.clone().addScaledVector(direction, distance) });
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
      moveCamera(
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
      moveCamera(
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
    if (!session.setView(view)) throw new Error(`Unknown view: ${view}`);
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
  function frameLandmark(step, { immediate = false } = {}) {
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
    moveCamera(planFraming(scene.camera, scene.controls, withContext(bounds),
      VIEW_DIRECTIONS[step.view], frameTo, framingFit({ immediate })), { immediate });
    return true;
  }

  /** Frame a deficit's drawn regions together, from the side they lie on when they share one. */
  function frameRegions(ids) {
    const wanted = new Set(ids);
    const meshes = model.visibleMeshes.filter(mesh => wanted.has(mesh.userData.region_id));
    if (!meshes.length) return;
    const box = new Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    const framed = withContext(box);
    // A mapping wide enough to carry its own context is fitted by its silhouette, as the whole brain is,
    // so it fills the stage as DESIGN.md's framing says; a small one keeps the context box around it.
    const points = framed.equals(box) ? silhouette(meshes) : null;
    const direction = viewDirection();
    const sides = new Set(meshes.map(mesh => model.regions.get(mesh.userData.region_id)?.hemisphere)
      .filter(side => side === 'left' || side === 'right'));
    // Seen from the other side, a one-sided mapping is framed through the hemisphere in front of it.
    if (sides.size === 1 && Math.sign(direction.x) === (sides.has('left') ? 1 : -1)) direction.x *= -1;
    chrome?.releaseView();
    moveCamera(planFraming(scene.camera, scene.controls, framed, direction, frameTo,
      framingFit(), points));
  }

  /** The meshes' vertices in world space, thinned like the whole brain's framing points. */
  function silhouette(meshes) {
    const stride = meshes.reduce((total, mesh) => total + mesh.geometry.attributes.position.count, 0) > 60000 ? 8 : 1;
    const kept = [];
    const point = new Vector3();
    for (const mesh of meshes) {
      const position = mesh.geometry.attributes.position;
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < position.count; i += stride) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        kept.push(point.x, point.y, point.z);
      }
    }
    return new Float32Array(kept);
  }

  function focusSelection({ immediate = false } = {}) {
    const landmark = lessonLandmark();
    if (landmark && frameLandmark(landmark, { immediate })) { render(); return; }
    const id = model.state.selectedRegion?.id;
    if (!id) return;
    const meshes = model.visibleMeshes.filter(m => m.userData.region_id === id);
    if (!meshes.length) return;
    const box = new Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    const direction = scene.camera.position.clone().sub(scene.controls.target).normalize();
    chrome?.releaseView();
    moveCamera(planFraming(
      scene.camera, scene.controls, box, direction, frameTo,
      framingFit({ immediate })), { immediate });
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

  /** Undo whatever is hiding a region, then select it; false once a later command took over. */
  async function reveal(reason, id, current) {
    if (reason === 'removed') model.showRegions([id]);
    if (reason === 'no-mri') await commands.applySurfaceColor('tissue', current);
    if (reason === 'cortex-hidden') { model.setCortexVisible(true); model.setCortexOpacity(1); }
    if (reason === 'internal-hidden') model.setInternalVisible(true);
    if (reason === 'spinal-cord-hidden') await commands.showSpinalCord(true, current);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    // A cut-only region is nowhere until a plane exists. Coronal is the
    // conventional default, and the panel moves it from there.
    if (reason === 'no-cut') {
      await commands.cut('coronal', current);
      const coords = model.centroidOf(id);
      if (current() && coords && sections.active) {
        sections.setOffset(offsetThrough(coords, sections.frame.normal, sections.offsetRange));
      }
    }
    if (reason === 'other-detail') await commands.loadDetail(model.regions.get(id).atlas, current);
    if (reason === 'other-system') model.setInternalSystem(null);
    if (!current()) return false;
    const region = model.regions.get(id);
    if (!model.canSelect(region)) {
      const next = visibilityOf(region, model.settings).reason;
      if (next === reason) throw new Error(`Cannot reveal ${id}: ${next}`);
      return reveal(next, id, current);
    }
    select(id);
    return true;
  }

  function hideRegions(ids) {
    display(() => model.hideRegions(ids));
  }

  function setLang(lang) {
    session.setLang(lang);
    try { localStorage.setItem('neuroatlas-lang', lang); } catch {}
    repaint();
  }

  // ---- panels -----------------------------------------------------------

  const header = createHeader({
    atlases: model.manifest.atlases,
    networks: model.manifest.networks,
    cabNp: model.cabNp,
    functionalRegions: model.functionalRegions,
    domains: model.domains,
    detailLevels: model.manifest.detail_levels,
    anatomy: model.manifest.anatomy,
    anatomies,
    manifest: model.manifest,
    manifestUrl,
    indexUrl: `${modelsUrl}/anatomies.json`,
    onAtlas: commands.chooseAtlas,
    onSurfaceColor: commands.chooseSurfaceColor,
    onDetail: commands.chooseDetail,
    // Another brain is another set of assets, so this re-enters through the
    // URL rather than mutating the model in place. The reader keeps their atlas,
    // cut, view, panel and language; selection, dissection, the exact camera and
    // the MRI window belong to the current subject's parcels and intensities.
    onAnatomy: id => {
      if (id === anatomy) return;
      linkWriter.cancel();
      const hash = encodeState({
        ...linkState(), anatomy: id, selectedRegion: null, isolatedRegion: null,
        hiddenRegions: new Set(), orbit: null, mriWindow: null,
      });
      // Replaced, not pushed: Back must not return to a link for the brain just left.
      history.replaceState(null, '', `#${hash}`);
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
      const current = commands.begin();
      try {
        if (await reveal(reason, id, current) && id) focusSelection();
      } catch (error) {
        commands.failIfCurrent(current, 'region', error);
      }
    },
    onAtlas: commands.chooseAtlas,
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
    cabNp: model.cabNp,
    functionalRegions: model.functionalRegions,
    domains: model.domains,
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

  let atlasComparison = null;
  const absoluteManifestUrl = new URL(manifestUrl, globalThis.location.href);
  const overlapOverlay = createComparisonOverlay(async () => {
    const data = atlasComparison.data;
    const buffer = await readComparisonGeometry(
      new URL(data.geometry.file, absoluteManifestUrl), data.geometry.sha256,
    );
    const gltf = await new GLTFLoader().parseAsync(buffer, new URL('.', absoluteManifestUrl).href);
    return gltf.scene;
  });
  scene.scene.add(overlapOverlay.group);
  atlasComparison = createAtlasComparison({
    manifest: model.manifest,
    manifestUrl: absoluteManifestUrl,
    highlight: async id => {
      const applied = await overlapOverlay.highlight(id);
      if (applied) outline();
      return applied;
    },
    clearHighlight: () => { overlapOverlay.clear(); outline(); },
  });

  const loadedLayers = () => ({
    atlas: model.settings.atlas, detail: model.settings.detail, cutAtlas: sections.state.cutAtlas,
  });

  /** The scene as its link carries it, plus the exact camera a link leaves out. */
  function captureReaderState() {
    const { position, target, up, near, far, minDistance, maxDistance } = scene.destination;
    return readerState({
      ...session.assemble(model.state),
      ...cutState(),
      mriWindow: mriWindowLink(),
      camera: {
        position: position.clone(), target: target.clone(), up: up.clone(),
        near, far, minDistance, maxDistance, zoom,
        held: chrome.viewHeld,
      },
    }, loadedLayers());
  }

  /** Apply a whole scene under `current`; returns the steps that failed, each with its link fields. */
  function applyReaderState(target, current, movement = {}) {
    return restoreReaderState(target, {
      model, sections, commands, current, revealInTree,
      applyCamera: () => {
        if (target.camera === 'cut' && sections.active) faceCut(movement);
        else if (target.camera === 'cut' || target.camera === 'view') applyView(target.view, movement);
        else restoreCamera(target.view, target.camera, movement);
      },
      applyOrbit: orbit => placeOrbit(orbit, movement),
    });
  }

  function restoreCamera(view, pose, { immediate }) {
    session.setView(view);
    framingFit({ immediate });
    scene.camera.up.copy(pose.up);
    moveCamera(pose, { immediate });
    zoom = pose.zoom;
    if (pose.held) chrome.holdView(); else chrome.releaseView();
    render();
  }

  const toWorld = millimetres => new Vector3(...millimetres).divideScalar(1000);
  const toMillimetres = vector => vector.toArray().map(value => value * 1000);

  /** A link's exact camera, placed in the framing just applied; only nearer limits are widened to admit it. */
  function placeOrbit({ position, target, up }, { immediate = false } = {}) {
    const plan = scene.destination;
    if (!orbitWithin({ position, target }, plan.maxDistance * 1000)) {
      throw new RangeError(`Camera ${position} → ${target} mm is beyond the orbit limit of ${plan.maxDistance} m.`);
    }
    const pose = { ...plan, position: toWorld(position), target: toWorld(target) };
    const distance = pose.position.distanceTo(pose.target);
    // A camera written at the limit may read back a rounding past it.
    pose.minDistance = Math.min(plan.minDistance, distance);
    pose.maxDistance = Math.max(plan.maxDistance, distance);
    scene.camera.up.copy(up ? new Vector3(...up) : upFor(session.assemble({}).view));
    chrome.releaseView();
    moveCamera(pose, { immediate });
    const fitted = fittedDistance(pose.position.clone().sub(pose.target).normalize());
    if (fitted > 0) zoom = distance / fitted;
    render();
  }

  /** The camera as a link carries it, when no named view describes it. */
  function orbitLink() {
    if (!chrome || chrome.viewHeld || tractReferenceActive) return null;
    const { position, target, up } = scene.destination;
    const named = upFor(session.assemble({}).view);
    return {
      position: toMillimetres(position), target: toMillimetres(target),
      ...(up.distanceTo(named) > 1e-3 ? { up: up.toArray() } : {}),
    };
  }

  /** The MRI window, when the reader has moved it off the scan's published one. */
  function mriWindowLink() {
    const shown = sections.display;
    const published = sections.volumes?.metadata.display;
    if (!shown || !published) return null;
    if (shown.windowCenter === published.window_center && shown.windowWidth === published.window_width) return null;
    return { center: shown.windowCenter, width: shown.windowWidth };
  }

  /** Panels word their own failures; a newer deploy also needs the notice's Reload. */
  function offerReload(error) {
    if (error?.code === 'asset-updated') commands.fail('landmark', error);
  }

  // The scene before this excursion's first deficit. Kept until it is restored or the deficit
  // closes, so Restore returns there whatever was changed since, as its label says.
  let beforeDeficit = null;
  // The scene before the open lesson, put back when the reader leaves it. Null for a lesson a link
  // opened on its landmark: that scene is the link's own.
  let beforeLesson = null;

  /** Put back the scene from before the first deficit; false when a later command overtook it. */
  async function restoreBeforeDeficit() {
    const current = commands.begin();
    const failures = await applyReaderState(beforeDeficit, current);
    if (!current()) return false;
    if (failures.length) {
      for (const { error } of failures) console.error(error);
      throw new AggregateError(failures.map(({ error }) => error), 'The previous view was not fully restored.');
    }
    beforeDeficit = null;
    render();
    return true;
  }

  /** Closing a deficit ends its excursion: the scene stays, and there is nothing left to restore. */
  function closeDeficit() {
    session.setDeficit(null);
    beforeDeficit = null;
    render();
  }

  /** The reader's own settings a reveal can change, compared after it to say which it did. */
  function revealSettings() {
    const { atlas, surfaceColor, detail, cutActive, isolatedRegion, hemisphere, cortexVisible } = model.settings;
    return { atlas, colour: surfaceColor, detail, cut: cutActive, isolated: Boolean(isolatedRegion), hemisphere,
      cortex: cortexVisible };
  }

  function sayRevealed(before) {
    const said = revealNotice(session.assemble({}).lang, before, revealSettings());
    if (said) session.notify({ text: said });
  }

  /** The profile opens at once; the mapped regions are then drawn together and framed once. */
  async function openDeficit(id) {
    const current = commands.begin();
    const regions = clinicalCatalog.mappedRegions(id);
    // Before the detail opens: on a phone, raising the sheet reframes the camera. A lesson it is
    // opened from ends here and hands over the scene from before it, for Restore to return to.
    beforeDeficit ??= beforeLesson ?? captureReaderState();
    beforeLesson = null;
    circuitSession.close();
    session.setDeficit(id);
    session.setExplorer('deficits');
    render();
    showDetail();
    const before = revealSettings();
    if (!(await commands.revealRegions(regions, current))) return;
    sayRevealed(before);
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

  const involved = createInvolvement(model.regions);
  const clinicalExplorer = createClinicalExplorer({
    clinical: clinicalCatalog,
    anatomy: catalog,
    involved,
    onQuery: query => { session.setClinicalQuery(query); render(); },
    onDeficit: openDeficit,
    onRegion: async id => {
      const current = commands.begin();
      beforeDeficit ??= captureReaderState();
      const before = revealSettings();
      if (!(await commands.openRegion(id, current))) return;
      sayRevealed(before);
      focusSelection();
      render();
    },
    onRestore: restoreBeforeDeficit,
    onFailure: offerReload,
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
    moveCamera(planFraming(scene.camera, scene.controls, internalBounds,
      viewDirection(), frameTo, framingFit()));
  }

  /** Pull back to the whole brain along the direction the reader already has. */
  function frameWhole() {
    moveCamera(planFraming(scene.camera, scene.controls, framingBounds(),
      viewDirection(), frameTo, framingFit(), framingPoints()));
  }

  // Taken at each of the two doors in, and spent on the way out.
  let beforeInternal = null;

  async function enterInternal() {
    const current = commands.begin();
    beforeInternal = captureBeforeInternal(model.state, model.defaultDetail);
    session.setQuery('');
    try {
      await sections.setMode('off');
      if (!current()) return;
      await commands.loadDetail(model.defaultDetail, current);
      if (!current()) return;
    } catch (error) {
      commands.failIfCurrent(current, 'internal', error);
      return;
    }
    model.setInternalSystem(null);
    model.setCortexVisible(false);
    model.setSurfaceColor('atlas');
    frameInternal();
    render();
  }

  async function leaveInternalAnatomy() {
    const current = commands.begin();
    const changes = leaveInternal(beforeInternal, model.state, {
      'cab-np': model.cabNp?.atlas, functional: model.functionalRegions?.atlas, domains: model.domains?.atlas,
    });
    beforeInternal = null;
    session.setQuery('');
    // Both setters release isolation, which would otherwise hold the cortex
    // hidden behind whichever single structure the reader had isolated.
    model.setInternalSystem(changes.internalSystem);
    model.setCortexVisible(changes.cortexVisible);
    try {
      await commands.applySurfaceColor(changes.surfaceColor, current);
      if (current() && changes.detail) await commands.loadDetail(changes.detail, current);
    } catch (error) {
      commands.failIfCurrent(current, 'wholeBrain', error);
    }
    if (!current()) return;
    if (changes.colourLost) {
      const { lang, atlas } = session.assemble(model.state);
      const copy = t(lang, 'app');
      const said = { 'cab-np': copy.cabNpAtlasOnly, functional: copy.functionalAtlasOnly,
        domains: copy.domainsAtlasOnly }[changes.colourLost];
      session.notify({ text: said(atlasSwitchLabel(atlas, lang)) });
    }
    frameWhole();
    render();
  }

  const internalAnatomy = createInternalAnatomy({
    catalog,
    manifest: model.manifest,
    onToggle: () => (insideInternal(model.state) ? leaveInternalAnatomy() : enterInternal()),
    onSystem: async system => {
      const current = commands.begin();
      try {
        if (system === 'Spinal cord' && !(await commands.showSpinalCord(true, current))) return;
        // The other door in must clear the cortex's network legend as well.
        if (!insideInternal(model.state)) {
          beforeInternal = captureBeforeInternal(model.state, model.state.detail);
          model.setSurfaceColor('atlas');
          model.setCortexVisible(false);
        }
        model.setInternalSystem(system);
        session.setQuery('');
        const group = catalog.groups(session.assemble(model.state))
          .find(entry => entry.kind === 'structure');
        if (system && group && !session.assemble(model.state).expanded.has(group.key)) {
          session.toggleGroup(group.key);
        }
        frameInternal();
        render();
      } catch (error) {
        commands.failIfCurrent(current, 'system', error);
      }
    },
  });

  const constituents = createConstituents({
    catalog,
    onRegion: async id => {
      const current = commands.begin();
      try {
        model.setInternalSystem(null);
        if (await commands.openRegion(id, current)) focusSelection();
      } catch (error) {
        commands.failIfCurrent(current, 'region', error);
      }
    },
  });

  const hasSpinalCord = publishesSpinalCord(model.manifest);

  async function setSpinalCordVisible(visible) {
    if (!hasSpinalCord) {
      session.notify({ text: t(session.assemble({}).lang, 'display').spinalCordUnavailable });
      render();
      return;
    }
    const current = commands.begin();
    const had = model.state.selectedRegion;
    try {
      if (!(await commands.showSpinalCord(visible, current))) return;
      notifyClearedSelection(had);
      frameWhole();
    } catch (error) {
      commands.failIfCurrent(current, 'cord', error);
    }
    render();
  }

  const display_ = createDisplay({
    hasSpinalCord,
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
      // A command still loading would land over it, so it is overtaken.
      commands.begin();
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
    moveCamera(planFraming(scene.camera, scene.controls, cutBounds, direction, frameTo,
      framingFit({ immediate }), cutBounds === bounds ? framingPoints() : null), { immediate });
    render();
  }

  const sectionControls = createSectionControls(sections, {
    anatomy: model.manifest.anatomy,
    // A plane chosen on the stage is a scene command: its first cut downloads, and a later command overtakes it.
    cut: plane => commands.cut(plane, commands.begin()),
    cutAtlases: model.manifest.cut_atlases,
    onFaceView: faceCut,
    onSelect: select,
    getSelectedRegion: () => model.state.selectedRegion,
    centroidOf: id => model.centroidOf(id),
  });

  /** Draw, select and frame a lesson's landmark; false once a later command took over. */
  async function openLandmark(step, current) {
    if (!(await commands.openRegion(step.region, current))) return false;
    showCircuitLandmark(model, step);
    if (!frameLandmark(step)) throw new Error(`Landmark geometry unavailable: ${step.region}`);
    return true;
  }

  /** The scene a lesson opens over, unless one is already open and holds it. */
  function rememberBeforeLesson() {
    if (!circuitSession.snapshot().circuit) beforeLesson = captureReaderState();
  }

  /**
   * Leaving a lesson, back to the list or to another tab, ends it and puts back the scene from before
   * it, as a deficit's Restore does. The list stays in front: a restored selection is not a new choice.
   */
  async function leaveLesson() {
    if (!circuitSession.snapshot().circuit || session.assemble(model.state).explorer !== 'circuits') return;
    const before = beforeLesson;
    beforeLesson = null;
    circuitSession.close();
    render();
    if (!before) return;
    const current = commands.begin();
    const failures = await applyReaderState(before, current);
    if (!current()) return;
    workspace.showList();
    if (failures.length) {
      commands.fail('restore', new AggregateError(failures.map(({ error }) => error),
        'The scene from before the lesson was not fully restored.'));
    }
    render();
  }

  // A tab chosen during a lesson waits for the lesson's scene to come back; a later choice wins.
  let modeWanted = null;
  async function chooseMode(value) {
    modeWanted = value;
    await leaveLesson();
    if (modeWanted === value) chooseExplorer(value);
  }

  const circuitExplorer = createCircuitExplorer({
    catalog: circuitCatalog,
    involved,
    onCircuit: async id => {
      const current = commands.begin();
      const circuit = circuitCatalog.get(id);
      rememberBeforeLesson();
      showDetail();
      if (!(await openLandmark(circuit.steps[0], current))) return;
      circuitSession.start(id);
      render();
    },
    onLandmark: async (id, index) => {
      const current = commands.begin();
      rememberBeforeLesson();
      session.setExplorer('circuits');
      showDetail();
      if (!(await openLandmark(circuitCatalog.get(id).steps[index], current))) return;
      circuitSession.start(id);
      circuitSession.go(index);
      render();
    },
    onStep: async index => {
      const current = commands.begin();
      const lesson = circuitSession.snapshot();
      const step = circuitCatalog.get(lesson.circuit).steps[index];
      if (!step) throw new RangeError(`Invalid landmark index: ${index}`);
      if (!(await openLandmark(step, current))) return;
      circuitSession.go(index);
      render();
      if (session.assemble(model.state).explorer === 'circuits') showDetail();
    },
    onMri: async () => {
      const current = commands.begin();
      const lesson = circuitSession.snapshot();
      const step = circuitCatalog.get(lesson.circuit).steps[lesson.step];
      const canOpen = () => {
        const shown = circuitSession.snapshot();
        return current() && session.assemble(model.state).explorer === 'circuits'
          && shown.circuit === lesson.circuit && shown.step === lesson.step;
      };
      await openLandmark(step, current);
      if (!canOpen()) return;
      await commands.prepareCut(current);
      if (!canOpen()) return;
      await prepareCircuitMri(model, sections, step);
      if (!canOpen()) return;
      faceCut();
      await sectionControls.openPreparedPlane(step.plane, canOpen);
      render();
    },
    onDeficit: id => clinicalExplorer.openDeficit(id),
    onFailure: offerReload,
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
  const onSnapshot = async () => {
    try {
      const dataUrl = await chrome.snapshot(crop => scene.captureSnapshot(crop), {
        anatomy: model.manifest.anatomy,
        section: sectionControls.current,
        referenceLabel: lang => nativeTracts.reference(lang).label,
      });
      const link = document.createElement('a');
      link.download = `neuroatlas-${model.state.atlas ?? 'brain'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      commands.fail('snapshot', error);
    }
  };

  chrome = createViewportChrome({
    networks: model.manifest.networks,
    cabNp: model.cabNp,
    functionalRegions: model.functionalRegions,
    domains: model.domains,
    onView: applyView,
    onRetry: reloadWithoutStoredModels,
    onSnapshot,
    onDock: refitDock,
    onFunctionalLevel: level => display(() => model.setFunctionalLevel(level)),
    onDomain: id => display(() => model.setDomain(id)),
    controls: scene.controls,
  });
  chrome.setViewport(scene.visibleRect, scene.hostSize);

  const notice = createNotice({
    onDismiss: () => {
      session.notify(null);
      render();
      rescueFocus();
    },
    onReload: reloadWithoutStoredModels,
  });

  // Built before the sheet: the sheet decides on construction which shell owns
  // the panels, and hands them over through onShell.
  workspace = createWorkspace({
    catalog,
    onMode: chooseMode,
    onClear: clearContext,
    onViewChange: () => scene.invalidate(),
    onReturn: leaveLesson,
    // The group crumb leads to the selected row, so the tree shows it rather than a search.
    onLocate: () => {
      const id = model.state.selectedRegion?.id;
      if (!id) return;
      session.setQuery('');
      revealInTree(id);
      render();
    },
  });

  // The camera's heading where it is going, so a move in flight is read where it lands.
  const heading = () => scene.destination.position.clone().sub(scene.destination.target).normalize();
  let fitBefore = null;
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
      notice.setShell(shell);
    },
    onInsets: (insets, motion) => {
      // A reader's own framing (an orbit, Focus, a landmark) keeps its heading and its size in the
      // room: its fit is read before the sheet first moves, and again where the sheet settles.
      const own = framed && !orbiting && !chrome?.viewHeld;
      if (own && !fitBefore) fitBefore = fittedDistance(heading());
      scene.setChromeInsets(insets, motion);
      chrome?.setViewport(scene.visibleRect, scene.hostSize);
      if (!motion.settle) return;
      if (own) keepFraming(fitBefore);
      fitBefore = null;
    },
    // Reframing during a drag would fight the finger; on arrival a held view
    // eases to the new rectangle on the sheet's curve.
    onDetent: () => { if (framed && chrome?.viewHeld) frameCurrent(); },
  });

  /** Scale the camera's distance from a fit of `before` to the room it has now, keeping heading and target. */
  function keepFraming(before) {
    applyFraming();
    const after = fittedDistance(heading());
    if (!(before > 0 && after > 0) || after === before) return;
    const plan = scene.destination;
    const distance = plan.position.distanceTo(plan.target) * after / before;
    moveCamera({ ...plan, position: plan.target.clone().addScaledVector(heading(), distance) });
  }

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
        sideWord: t(state.lang, 'sides').words[region.hemisphere],
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

  /** The location bar's place within a mode: a lesson's circuit, an open deficit's group. */
  function detailPlace(state) {
    if (state.explorer === 'circuits' && state.lesson.circuit) {
      return circuitCatalog.get(state.lesson.circuit).name[state.lang];
    }
    if (state.explorer === 'deficits' && state.selectedDeficit) {
      const { group } = clinicalCatalog.get(state.selectedDeficit);
      return clinicalCatalog.groups.find(entry => entry.id === group).name[state.lang];
    }
    return null;
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
      tracts: state.explorer === 'diffusion' ? nativeTracts.reference(state.lang).detail : null });
    settings.update(state, { singleKeys: keyPreference.enabled, themeChoice: theme.choice });
    navigator.update(state);
    inspector.update(state);
    const outlineAvailable = !sections.active && !referenceOnly;
    overlapOverlay.setVisible(outlineAvailable);
    atlasComparison.update({ ...state, outlineAvailable });
    const strip = contextStrip(state, referenceOnly);
    sheet.update(state, strip);
    workspace.update(state, strip, detailPlace(state));
    clinicalExplorer.update(state, { restorable: beforeDeficit !== null });
    circuitExplorer.update(state);
    nativeTracts.update(state);
    display_.update(state);
    const dissectionSaid = dissectionControls.update(state);
    internalAnatomy.update(state);
    constituents.update(state);
    sectionControls.update(state);
    chrome.update(referenceOnly ? { ...state, surfaceColor: 'tissue' } : state,
      { directionKey: nativeTracts.streamlinesVisible });
    shortcuts.setLanguage(state.lang);
    notice.update(state);
    outline();
    scheduleUrl();

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
    // A changed count of hidden parts joins the sentence, so one announcer speaks once.
    const said = state.notice?.text ?? null;
    const joined = sentence => (sentence && dissectionSaid
      ? `${sentence.replace(/[^.!?…]$/, '$&.')} ${dissectionSaid}` : sentence || dissectionSaid || '');
    if (said && said !== announcedNotice) announce(joined(said));
    else if (spoken !== announced) announce(joined(spoken));
    else if (dissectionSaid) announce(dissectionSaid);
    if (state.status === 'context-lost' && announcedStatus !== 'context-lost') {
      announce(t(state.lang, 'errors').contextLost);
    } else if (announcedStatus === 'context-lost' && state.status === 'ready') {
      announce(viewportCopy.loaded);
    }
    announced = spoken;
    announcedNotice = said;
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
    const { lang, surfaceColor, functionalLevel } = session.assemble(model.state);
    const label = catalog.get(region.id)?.label.name ?? region.label;
    // Glass belongs to no division of the level on show, but always to a section.
    const division = surfaceColor === 'functional'
      && (functionalRegionOf(model.functionalRegions, functionalLevel, region.id)
        ?? functionalRegionOf(model.functionalRegions, 'sections', region.id));
    // The network a colour stands for, where one network holds the whole region: every CAB-NP
    // area; a Yeo 7 region only when all its assigned vertices share one network.
    const cabNp = surfaceColor === 'cab-np' && model.cabNp?.regions[region.id];
    const yeo = surfaceColor === 'network' && model.regions.get(region.id)?.networks;
    const network = cabNp ? cabNpName(cabNp, lang) : yeo?.length === 1 ? networkName(yeo[0].network, lang) : null;
    // Every domain the area reaches, strongest first; glass names none.
    const domains = surfaceColor === 'domains'
      ? domainsOf(model.domains, region.id).map(record => domainName(record, lang)).join(', ') : null;
    const side = t(lang, 'sides').capitalized[region.hemisphere];
    return [label, division && functionalName(division, lang), network, domains, side].filter(Boolean).join(' · ');
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
    const overlap = overlapOverlay.outlined;
    const { explorer, selectedDeficit } = session.assemble({});
    const wanted = new Set(explorer === 'deficits' && selectedDeficit
      ? clinicalCatalog.mappedRegions(selectedDeficit) : []);
    const mapped = wanted.size ? meshes.filter(mesh => wanted.has(mesh.userData.region_id)) : [];
    // An open deficit outlines all its drawn regions; once one is selected, the rest recede to the halo.
    scene.setOutlined({
      selected: overlap.length ? overlap : selected.length ? selected : mapped,
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

  /**
   * Everything the link carries. The brain is fixed for the life of the page,
   * so it is not session state, but region ids are shared between brains and a
   * link without it reopens someone else's anatomy.
   */
  function linkState() {
    const lesson = circuitSession.snapshot();
    return {
      ...session.assemble(model.state), ...cutState(), anatomy,
      circuit: lesson.circuit, circuitStep: lesson.circuit ? lesson.step : 0,
      orbit: orbitLink(), mriWindow: mriWindowLink(),
    };
  }


  function focusPoint(point) {
    chrome?.releaseView();
    const delta = point.clone().sub(scene.controls.target);
    const minDistance = point.y < bounds.min.y
      ? Math.min(scene.controls.minDistance, 0.015)
      : scene.controls.minDistance;
    moveCamera({
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
    scheduleUrl();
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
    scheduleUrl();
    return true;
  }

  // From the keys 0–6, so the view is simply there; a click on a preset keeps the orbit.
  function chooseView(view) {
    chrome.dismissHelp();
    applyView(view, { immediate: true });
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
      // A search field gives up its text first and marks the key handled. Then
      // Escape steps back through the region and then the deficit.
      if (shortcuts.isOpen) return;
      // Inside a detail view Escape is Back; the selection stays for a second Escape.
      if (workspace.focusInDetail) {
        workspace.back();
        return;
      }
      const view = session.assemble(model.state);
      if (model.state.selectedRegion) {
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
    if (event.key === '?') { event.preventDefault(); return shortcuts.toggle({ instant: true }); }
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
        focusSelection({ immediate: true });
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

  // ---- links ------------------------------------------------------------

  const known = {
    atlases: new Set(model.manifest.atlases.map(entry => entry.id)),
    details: new Set(model.manifest.detail_levels.map(entry => entry.id)),
    cutAtlases: new Set(model.manifest.cut_atlases.map(entry => entry.id)),
    views: new Set(Object.keys(VIEW_DIRECTIONS)),
    explorers: new Set(MODES),
    surfaceColors: new Set(['tissue', 'mri', 'atlas', ...(model.manifest.networks ? ['network'] : []),
      ...(model.cabNp ? ['cab-np'] : []), ...(model.functionalRegions ? ['functional'] : []),
      ...(model.domains ? ['domains'] : [])]),
    domains: new Set(model.domains?.domains.map(domain => domain.id) ?? []),
    regions: model.regions,
    deficits: new Set(clinicalCatalog.search('', 'en').map(deficit => deficit.id)),
    circuits: new Map(circuitCatalog.all.map(circuit => [circuit.id, circuit.steps.length])),
    spinalCord: hasSpinalCord,
  };

  /**
   * Apply a decoded link to the anatomy on screen, field by field. Returns the
   * link parameters that were not applied, or null when a later command took
   * over. The address bar keeps the link until it has settled.
   */
  async function restoreLink({ state: linked, rejected }, movement) {
    const current = commands.begin();
    linkWriter.hold(current);
    // Released by the caller once the scene has settled, with the link's own notice.
    session.holdNotices();
    try {
      const { state: valid, rejected: unknown } = checkLink(linked, known);
      const notApplied = [...rejected, ...unknown];
      const atlas = valid.atlas ?? model.manifest.atlases[0].id;
      const target = readerState({
        ...valid,
        // Without a view of its own, the link faces its cut, as choosing the cut does.
        camera: viewForRestoredCut({ cut: valid.cut, reverse: valid.cutReverse, view: valid.view })
          ? 'cut' : 'view',
      }, { atlas, detail: model.defaultDetail, cutAtlas: valid.cutAtlas ?? atlas });
      const failures = await applyReaderState(target, current, movement);
      if (!current()) return null;
      const present = new Set(Object.keys(linked).map(key => PARAMS[key]));
      for (const { fields, error } of failures) {
        console.error(error);
        const named = fields.filter(field => present.has(field));
        notApplied.push(...(named.length ? named : fields.slice(0, 1)));
      }
      beforeDeficit = null;
      beforeLesson = null;
      chooseExplorer(valid.explorer ?? 'anatomy');
      session.setDeficit(valid.selectedDeficit ?? null);
      if (valid.circuit) {
        circuitSession.start(valid.circuit);
        circuitSession.go(valid.circuitStep ?? 0);
      } else {
        circuitSession.close();
      }
      const { explorer, selectedDeficit } = session.assemble({});
      // A lesson linked without its landmark opens on it, as choosing that step does; leaving it
      // returns to the rest of the link.
      if (explorer === 'circuits' && valid.circuit && !valid.selectedRegion) {
        const lesson = circuitSession.snapshot();
        beforeLesson = captureReaderState();
        try {
          if (!(await openLandmark(circuitCatalog.get(lesson.circuit).steps[lesson.step], current))) return null;
        } catch (error) {
          console.error(error);
          notApplied.push('step');
        }
      }
      // The panel opens on what the link names, without raising a phone's sheet over its camera.
      if ((explorer === 'deficits' && selectedDeficit) || (explorer === 'circuits' && valid.circuit)) {
        workspace.showDetail();
      }
      render();
      return notApplied;
    } finally {
      linkWriter.release(current);
      scheduleUrl();
    }
  }

  /** A link edited in place: the same brain takes it as scene commands; another brain is another page. */
  async function onHashChange() {
    const decoded = decodeState(globalThis.location.hash);
    if (!sameSubject(decoded.state, anatomy, published.default)) {
      globalThis.location.reload();
      return;
    }
    if (decoded.state.lang) session.setLang(decoded.state.lang);
    const notApplied = await restoreLink(decoded, {});
    session.releaseNotices(notApplied?.length ? linkNotice(notApplied, session.assemble({}).lang) : null);
    render();
  }

  // ---- start ------------------------------------------------------------

  model.addEventListener('change', render);
  sections.addEventListener('change', render);
  // The envelopes the model fetches by itself, when hiding the cortex first exposes white matter.
  const onLoadError = event => {
    session.notify(failureNotice(event.detail, session.assemble({}).lang, 'whiteMatter'));
    render();
  };
  model.addEventListener('loaderror', onLoadError);
  repaint = render;
  afterTheme = () => {
    sections.applyTheme();
    render();
  };
  scene.applyTheme();
  scene.setSize();
  // The camera starts inside the brain; frame it before the link's layers load around it.
  let notApplied;
  try {
    applyView(session.assemble(model.state).view, { immediate: true });
    notApplied = await restoreLink(link, { immediate: true });
  } catch (error) {
    dispose();
    throw error;
  }
  // Before the stage reports ready, so the first hover does not compile
  // outline shaders in the frame the pointer arrives.
  try { scene.warmOutlines(model.group); }
  catch (error) { console.error(error); }
  session.setStatus('ready');
  chrome.setViewport(scene.visibleRect, scene.hostSize);
  onCameraChange();
  // Before the render, which replaces it with a restored selection if there is one.
  announce(t(session.assemble(model.state).lang, 'viewport').loaded);
  session.releaseNotices(notApplied?.length ? linkNotice(notApplied, session.assemble({}).lang) : null);
  render();
  prefetchOtherAtlas(model);
  globalThis.addEventListener('hashchange', onHashChange);

  function dispose() {
    globalThis.removeEventListener('keydown', onKeyDown);
    globalThis.removeEventListener('hashchange', onHashChange);
    notice.dispose();
    scene.controls.removeEventListener('change', onCameraChange);
    linkWriter.cancel();
    sheet.dispose();
    workspace.dispose();
    sections.removeEventListener('change', render);
    model.removeEventListener('change', render);
    model.removeEventListener('loaderror', onLoadError);
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
    atlasComparison.dispose();
    overlapOverlay.dispose();
    clinicalExplorer.dispose();
    circuitExplorer.dispose();
    document.getElementById('inspector').removeEventListener('click', onLessonMri, true);
    nativeTracts.dispose();
    navigator.dispose();
    header.dispose();
    settings.dispose();
    theme.dispose();
    model.dispose();
    scene.dispose();
  }

  return { dispose };
}
