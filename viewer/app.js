import { Box3, Vector3 } from 'three';
import { createCatalog } from './catalog/catalog.js';
import { loadClinicalCatalog } from './clinical/load.js';
import { openClinicalRegion } from './clinical/navigation.js';
import { BrainAtlas } from './model/brain-atlas.js';
import { VIEW_DIRECTIONS, fitDistance, frameTo, upFor } from './render/camera-views.js';
import { createPicker } from './render/picking.js';
import { createScene, planFraming } from './render/scene.js';
import { createSession, shortcutsAllowed } from './state/session.js';
import { captureBeforeInternal, insideInternal, leaveInternal } from './state/internal-mode.js';
import { createTheme } from './state/theme.js';
import { decodeState, encodeState } from './state/url-state.js';
import { BrainSections } from './slices/sections.js';
import { rasToWorld } from './slices/coordinates.js';
import { createSectionControls } from './ui/sections.js';
import { createInternalAnatomy } from './ui/internal-anatomy.js';
import { createConstituents } from './ui/constituents.js';
import { createDisplay } from './ui/display.js';
import { createHeader } from './ui/header.js';
import { createInspector } from './ui/inspector.js';
import { createClinicalExplorer } from './ui/clinical.js';
import { createNavigator } from './ui/navigator.js';
import { createShortcuts } from './ui/shortcuts.js';
import { createViewportChrome } from './ui/viewport-chrome.js';
import { createSheet } from './ui/sheet.js';
import { createInspectorTabs } from './ui/inspector-tabs.js';
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
  const session = createSession({ views: Object.keys(VIEW_DIRECTIONS), lang: initialLang });
  // Declared before the scene: its resize observer can fire during the model
  // download, which is long, and would otherwise hit a dead zone.
  let chrome = null;
  let picker = null;
  let refitViewport = null;
  const scene = createScene(viewport, {
    onContextLost: () => { session.setContextLost(); render(); },
    onContextRestored: () => { session.setStatus('ready'); render(); },
    onResize: ({ canvasChanged } = {}) => {
      chrome?.setViewport(scene.visibleRect);
      if (canvasChanged) refitViewport?.();
      onCameraChange();
    },
  });
  const theme = createTheme(() => scene.applyTheme());

  const manifestUrl = `${import.meta.env.BASE_URL}models/manifest.json`;
  const model = await BrainAtlas.load(manifestUrl, wanted.atlas, {
    detail: wanted.detail,
    onProgress: progress => {
      if (!progress?.total) return;
      session.setProgress({ loaded: progress.loaded, total: progress.total });
      const bar = document.getElementById('stage-bar');
      const message = document.getElementById('stage-message');
      const track = document.getElementById('stage-progress');
      track.hidden = false;
      bar.style.width = `${Math.round((progress.loaded / progress.total) * 100)}%`;
      message.textContent = t(initialLang, 'viewport')
        .loadingWithTotal(progress.loaded, progress.total);
    },
  });

  const catalog = createCatalog(model.manifest, initialLang);
  const clinicalCatalog = loadClinicalCatalog(model.manifest);
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
  scene.transparencyProbe = () =>
    model.visibleMeshes.some(mesh => mesh.material.transparent);

  const sections = new BrainSections(model, new URL('volumes.json', new URL(manifestUrl, location.href)));
  scene.scene.add(sections.group);
  scene.sectionsProbe = () => sections.active;

  // ---- commands ---------------------------------------------------------

  /** Apply a display change, and say so if it silently dropped the selection. */
  function display(change) {
    const had = model.state.selectedRegion;
    change();
    if (had && !model.state.selectedRegion) {
      const state = session.assemble(model.state);
      session.notify(t(state.lang, 'app').selectionCleared(had.label ?? 'region'));
    }
    render();
  }

  let framed = false;

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
  const fittedDistance = direction =>
    fitDistance(scene.camera, framingBounds(), direction, scene.viewportFit);
  const isTargetingSpine = () =>
    Boolean(model.state.spinalCordVisible && (scene.controls.target.y < bounds.min.y || model.state.internalSystem === 'Spinal cord'));

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

  /**
   * Frame the current view against the part of the canvas the interface is
   * not covering. Separate from `applyView` because the sheet reframes
   * without changing which view is chosen.
   */
  function frameCurrent({ immediate = false } = {}) {
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
          scene.viewportFit),
        { immediate: immediate || !framed },
      );
    }
    framed = true;
    render();
  }

  function applyView(view, { immediate = false } = {}) {
    if (!session.setView(view)) return;
    frameCurrent({ immediate });
  }

  function focusSelection() {
    const id = model.state.selectedRegion?.id;
    if (!id) return;
    const meshes = model.visibleMeshes.filter(m => m.userData.region_id === id);
    if (!meshes.length) return;
    const box = new Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    const direction = scene.camera.position.clone().sub(scene.controls.target).normalize();
    scene.moveTo(planFraming(
      scene.camera, scene.controls, box, direction, frameTo,
      scene.viewportFit));
  }

  function select(id) {
    model.select(id);
    if (id) {
      const current = session.assemble(model.state);
      const group = catalog.groups(current).find(g => g.rows.some(r => r.region.id === id));
      if (group && !current.expanded.has(group.key)) {
        session.toggleGroup(group.key);
      }
    }
    render();
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
    if (reason === 'cortex-hidden') { model.setCortexVisible(true); model.setCortexOpacity(1); }
    if (reason === 'spinal-cord-hidden') model.setSpinalCordVisible(true);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    // A cut-only region is nowhere until a plane exists. Coronal is the
    // conventional default, and the panel moves it from there.
    if (reason === 'no-cut') await sections.setMode('coronal');
    if (reason === 'other-detail') await setDetail(model.regions.get(id).atlas);
    if (reason === 'other-system') model.setInternalSystem(null);
    select(id);
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
    onAtlas: setAtlas,
    onSurfaceColor: value => display(() => model.setSurfaceColor(value)),
    onTheme: () => { theme.toggle(); session.setTheme(theme.current); render(); },
    onLang: setLang,
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
    onSelect: select,
    onToggleGroup: name => { session.toggleGroup(name); render(); },
    onToggleAllGroups,
    onQuery: query => { session.setQuery(query); render(); },
    onReveal: reveal,
    onAtlas: setAtlas,
    onCutAtlas: setCutAtlas,
  });

  const isolateSelection = () => display(() => {
    if (model.state.isolatedRegion) model.clearIsolation();
    else {
      model.isolate();
      focusSelection();
    }
  });

  const onSliceTo = async () => {
    const region = model.state.selectedRegion;
    if (!region) return;
    const coords = model.centroidOf(region.id);
    if (!coords) return;
    sections.setCrosshair(coords);
    if (!sections.active) {
      await sections.setMode('axial');
    }
    faceCut();
    render();
  };

  const inspector = createInspector({
    catalog,
    regions: model.manifest.regions,
    networks: model.manifest.networks,
    atlases: model.manifest.atlases,
    onFocus: focusSelection,
    onIsolate: isolateSelection,
    onSliceTo,
    centroidOf: id => model.centroidOf(id),
  });

  const clinicalExplorer = createClinicalExplorer({
    clinical: clinicalCatalog,
    anatomy: catalog,
    onExplorer: value => { session.setExplorer(value); render(); },
    onQuery: query => { session.setClinicalQuery(query); render(); },
    onDeficit: id => {
      clinicalCatalog.get(id);
      session.setDeficit(id);
      session.setExplorer('deficits');
      render();
    },
    onRegion: async id => {
      await openClinicalRegion(model, sections, id);
      focusSelection();
    },
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
      viewDirection(), frameTo, scene.viewportFit));
  }

  /** Pull back to the whole brain along the direction the reader already has. */
  function frameWhole() {
    scene.moveTo(planFraming(scene.camera, scene.controls, framingBounds(),
      viewDirection(), frameTo, scene.viewportFit));
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
      if (!visible && scene.controls.target.y < bounds.min.y) {
        scene.controls.target.copy(bounds.getCenter(new Vector3()));
        frameCurrent();
      }
    });
  }

  const display_ = createDisplay({
    detailLevels: model.manifest.detail_levels,
    hasSpinalCord,
    onDetail: setDetail,
    onHemisphere: value => display(() => model.setHemisphere(value)),
    onCortexVisible: value => display(() => model.setCortexVisible(value)),
    onCortexOpacity: value => display(() => model.setCortexOpacity(value)),
    onSpinalCordVisible: setSpinalCordVisible,
    onReset: () => display(() => {
      sections.setMode('off');
      model.reset();
      scene.controls.target.copy(bounds.getCenter(new Vector3()));
      applyView('oblique');
    }),
  });

  function faceCut() {
    if (!sections.active) return;
    const frame = sections.frame;
    const sliceWorldCenter = rasToWorld(frame.center.toArray());
    const direction = rasToWorld(frame.normal.toArray()).normalize()
      .multiplyScalar(sections.state.reverse ? -1 : 1);
    const namedView = {
      sagittal: ['right', 'left'], coronal: ['anterior', 'posterior'],
      axial: ['superior', 'inferior'], oblique: ['oblique', 'oblique'],
    }[sections.state.mode][Number(sections.state.reverse)];
    session.setView(namedView);
    scene.camera.up.copy(rasToWorld(frame.v.toArray()).normalize());
    const cutBounds = sliceWorldCenter.y < bounds.min.y
      ? new Box3(sliceWorldCenter.clone().subScalar(0.04), sliceWorldCenter.clone().addScalar(0.04))
      : bounds;
    scene.moveTo(planFraming(scene.camera, scene.controls, cutBounds, direction, frameTo,
      scene.viewportFit));
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
  const shortcuts = createShortcuts(initialLang);

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
    onRetry: () => globalThis.location.reload(),
    onSnapshot,
  });
  chrome.setViewport(scene.visibleRect);

  // Built before the sheet: the sheet decides on construction which shell owns
  // the panels, and hands them over through onShell.
  const inspectorTabs = createInspectorTabs();

  /*
   * The phone shell. It reports how much of the canvas it covers rather than
   * resizing it, and everything that must agree about where the viewport is —
   * framing, the markers, the presets — reads that one
   * rectangle back from the scene.
   */
  const sheet = createSheet({
    onShell: shell => {
      if (shell === 'sheet') inspectorTabs.deactivate();
      else inspectorTabs.activate();
    },
    onInsets: insets => {
      scene.setChromeInsets(insets);
      chrome?.setViewport(scene.visibleRect);
    },
    // Reframing during a drag would fight the finger; on arrival the camera
    // eases to the new rectangle, which is the one thing allowed to animate.
    onDetent: () => { if (framed) frameCurrent(); },
  });

  // ---- the single render path -------------------------------------------

  let announced = null;

  function render() {
    cachedFramingBounds = null;
    const state = session.assemble(model.state);
    catalog.setLanguage(state.lang);
    document.documentElement.lang = state.lang;
    root.dataset.status = state.status;
    const visibleCount = catalog.visibleCount(state);

    header.update(state, { visibleCount });
    navigator.update(state);
    inspector.update(state);
    const selected = state.selectedRegion;
    const strip = selected
      ? {
          label: catalog.get(selected.id)?.label.name ?? selected.label,
          side: t(state.lang, 'sides').glyphs[selected.hemisphere] ?? '',
        }
      : {};
    sheet.update(state, strip);
    inspectorTabs.update(state, strip);
    clinicalExplorer.update(state);
    display_.update(state);
    internalAnatomy.update(state);
    constituents.update(state);
    sectionControls.update(state);
    chrome.update(state);
    shortcuts.setLanguage(state.lang);
    outline();
    syncUrl(state);

    const colophonText = document.getElementById('colophon-text');
    if (colophonText) {
      colophonText.textContent = t(state.lang, 'footer').colophon(model.manifest.anatomy);
    }
    const provenanceLink = document.getElementById('provenance');
    if (provenanceLink) provenanceLink.textContent = t(state.lang, 'footer').provenance;

    // The text state is the product for a reader who cannot see the render.
    const region = state.selectedRegion;
    const spoken = region
      ? t(state.lang, 'app').spoken(
          catalog.get(region.id).label.name,
          t(state.lang, 'sides').words[region.hemisphere] ?? region.hemisphere,
        )
      : null;
    if (spoken !== announced) {
      announced = spoken;
      announcer.textContent = spoken ?? '';
    }
  }

  /*
   * What the pointer is over, and where. Kept out of the state loop: it is
   * answered once per frame of a pointer move, and a full re-render would
   * rebuild every panel that often.
   */
  let hovered = null;

  /** Mark what the pointer is on — a cut face lights, a surface outlines — and name it. */
  function highlight() {
    const region = hovered?.region;
    sections.setHighlight({
      hovered: region?.id,
      selected: model.state.selectedRegion?.id,
    });
    chrome?.showHover(
      region ? catalog.get(region.id)?.label.name ?? region.label : null, hovered?.position);
    scene.invalidate();
  }

  function outline() {
    highlight();
    // An outline is drawn from an unclipped depth render, so on a cut it would
    // ring the whole solid rather than the face. The cut lights its faces
    // instead, which is what `highlight` just did.
    if (sections.active) { scene.setOutlined(); return; }
    const meshFor = id => {
      const mesh = id && model.visibleMeshes.find(m => m.userData.region_id === id);
      return mesh ? [mesh] : [];
    };
    scene.setOutlined({
      selected: meshFor(model.state.selectedRegion?.id),
      hovered: meshFor(hovered?.region?.id),
    });
  }

  let urlTimer = null;
  function syncUrl(state) {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const hash = encodeState(state);
      // replaceState, not push: the back button is not a camera undo stack.
      history.replaceState(null, '', hash ? `#${hash}` : globalThis.location.pathname);
    }, 250);
  }

  function focusPoint(point) {
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
    model: () => sections,
    onHover: (region, position) => {
      const regionChanged = region?.id !== hovered?.region?.id;
      hovered = region ? { region, position } : null;
      if (regionChanged) {
        if (sections.active) highlight(); else outline();
      } else if (position) {
        chrome?.showHover(
          region ? catalog.get(region.id)?.label.name ?? region.label : null, position);
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
  scene.controls.addEventListener('end', () => {
    const fitted = fittedDistance(viewDirection());
    if (fitted > 0) zoom = scene.distanceToTarget / fitted;
  });

  const onKeyDown = event => {
    if (event.defaultPrevented) return;
    const mprDialog = document.getElementById('mpr-dialog');
    if (mprDialog?.open) {
      if (event.key.toLowerCase() === 'm' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        mprDialog.close();
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') {
      if (document.activeElement === document.getElementById('search')) {
        session.setQuery('');
        render();
      } else if (model.state.selectedRegion) {
        select(null);
      }
      return;
    }
    if (!shortcutsAllowed(event.target)) return;
    if (event.key === '?') { event.preventDefault(); return shortcuts.toggle(); }
    if (shortcuts.isOpen) return;
    if (event.key === '/') {
      event.preventDefault();
      if (session.assemble(model.state).explorer === 'deficits') clinicalExplorer.focusSearch();
      else navigator.focusSearch();
      return;
    }
    if (session.assemble(model.state).explorer === 'deficits'
      && ['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); navigator.moveFocus(1); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); navigator.moveFocus(-1); return; }
    if (event.key === '0') return applyView('oblique');
    const index = Number(event.key) - 1;
    if (VIEW_KEYS[index]) return applyView(VIEW_KEYS[index]);
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
  applyView(session.assemble(model.state).view, { immediate: true });
  if (wanted.hemisphere) model.setHemisphere(wanted.hemisphere);
  if (wanted.cortexVisible !== undefined) model.setCortexVisible(wanted.cortexVisible);
  if (wanted.spinalCordVisible !== undefined) model.setSpinalCordVisible(wanted.spinalCordVisible);
  if (wanted.cortexOpacity !== undefined) model.setCortexOpacity(wanted.cortexOpacity);
  // A shared link may name a layer this build does not carry.
  if (wanted.surfaceColor && (wanted.surfaceColor !== 'network' || model.manifest.networks)) {
    model.setSurfaceColor(wanted.surfaceColor);
  }
  if (wanted.cutAtlas) setCutAtlas(wanted.cutAtlas);
  if (wanted.detail) await setDetail(wanted.detail);
  if (wanted.internalSystem) model.setInternalSystem(wanted.internalSystem);
  if (wanted.cortexVisible === false) frameCurrent({ immediate: true });
  if (wanted.view) applyView(wanted.view, { immediate: true });
  if (wanted.selectedRegion && catalog.get(wanted.selectedRegion)) {
    try {
      model.select(wanted.selectedRegion);
      // Isolation depends on a selection, so it is restored after one.
      if (wanted.isolatedRegion === wanted.selectedRegion) model.isolate();
    } catch {
      const state = session.assemble(model.state);
      session.notify(t(state.lang, 'app').regionNotShown);
    }
  }
  session.setStatus('ready');
  chrome.setViewport(scene.visibleRect);
  onCameraChange();
  render();
  prefetchIdleLayers(model);

  return {
    dispose() {
      globalThis.removeEventListener('keydown', onKeyDown);
      scene.controls.removeEventListener('change', onCameraChange);
      clearTimeout(urlTimer);
      sheet.dispose();
      inspectorTabs.dispose();
      sections.removeEventListener('change', render);
      model.removeEventListener('change', render);
      sectionControls.dispose();
      sections.dispose();
      shortcuts.dispose();
      picker.dispose();
      chrome.dispose();
      display_.dispose();
      internalAnatomy.dispose();
      constituents.dispose();
      inspector.dispose();
      clinicalExplorer.dispose();
      navigator.dispose();
      header.dispose();
      model.dispose();
      scene.dispose();
    },
  };
}
