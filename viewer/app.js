import { Box3 } from 'three';
import { createCatalog } from './catalog/catalog.js';
import { loadClinicalCatalog } from './clinical/load.js';
import { openClinicalRegion } from './clinical/navigation.js';
import { BrainAtlas } from './model/brain-atlas.js';
import { VIEW_DIRECTIONS, frameTo, upFor } from './render/camera-views.js';
import { createPicker } from './render/picking.js';
import { createScene, planFraming } from './render/scene.js';
import { createSession, shortcutsAllowed } from './state/session.js';
import { createTheme } from './state/theme.js';
import { decodeState, encodeState } from './state/url-state.js';
import { BrainSections } from './slices/sections.js';
import { rasToWorld } from './slices/coordinates.js';
import { createSectionControls } from './ui/sections.js';
import { createDisplay } from './ui/display.js';
import { createHeader } from './ui/header.js';
import { createInspector } from './ui/inspector.js';
import { createClinicalExplorer } from './ui/clinical.js';
import { createNavigator } from './ui/navigator.js';
import { createShortcuts } from './ui/shortcuts.js';
import { createViewportChrome } from './ui/viewport-chrome.js';
import { createSheet } from './ui/sheet.js';
import { createInspectorTabs } from './ui/inspector-tabs.js';
import { isCoarse } from './render/device.js';
import { t } from './i18n/translations.js';

const VIEW_KEYS = ['left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

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
  // download, which is long, and would otherwise hit a dead zone. The picker
  // is declared here for the same reason: the sheet reports its insets while
  // it is being constructed, and the crosshair reads the picker from there.
  let chrome = null;
  let picker = null;
  const scene = createScene(viewport, {
    onContextLost: () => { session.setContextLost(); render(); },
    onContextRestored: () => { session.setStatus('ready'); render(); },
    onResize: () => onCameraChange(),
  });
  const theme = createTheme(() => scene.applyTheme());

  const manifestUrl = `${import.meta.env.BASE_URL}models/manifest.json`;
  const model = await BrainAtlas.load(manifestUrl, wanted.atlas, progress => {
    if (progress?.total) {
      session.setProgress({ loaded: progress.loaded, total: progress.total });
      render();
    }
  });

  const catalog = createCatalog(model.manifest, initialLang);
  const clinicalCatalog = loadClinicalCatalog(model.manifest);
  scene.setAppearance(model.manifest.appearance);
  const bounds = new Box3().setFromObject(model.group);
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

  /**
   * Frame the current view against the part of the canvas the interface is
   * not covering. Separate from `applyView` because the sheet reframes
   * without changing which view is chosen.
   */
  function frameCurrent({ immediate = false } = {}) {
    const { view } = session.assemble(model.state);
    scene.camera.up.copy(upFor(view));
    scene.moveTo(
      planFraming(scene.camera, scene.controls, bounds, VIEW_DIRECTIONS[view], frameTo,
        scene.viewportFit),
      { immediate: immediate || !framed },
    );
    framed = true;
    render();
  }

  function applyView(view, { immediate = false } = {}) {
    if (!session.setView(view)) return;
    frameCurrent({ immediate });
  }

  function focusSelection() {
    const id = model.state.selectedRegion?.id;
    const mesh = id && model.visibleMeshes.find(m => m.userData.region_id === id);
    if (!mesh) return;
    const direction = scene.camera.position.clone().sub(scene.controls.target).normalize();
    scene.moveTo(planFraming(
      scene.camera, scene.controls, new Box3().setFromObject(mesh), direction, frameTo,
      scene.viewportFit));
  }

  function select(id) {
    model.select(id);
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

  /** Undo whatever is hiding a region, then select it. */
  function reveal(reason, id) {
    if (reason === 'cortex-hidden') model.setCortexVisible(true);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    // A cut-only region is nowhere until a plane exists. Coronal is the
    // conventional default, and the panel moves it from there.
    if (reason === 'no-cut') sections.setMode('coronal').catch(() => {});
    if (reason === 'other-detail') setDetail(id.split(':')[0] === 'aseg' ? 'aseg' : 'nextbrain');
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
    onAtlas: setAtlas,
    onTheme: () => { theme.toggle(); session.setTheme(theme.current); render(); },
    onLang: setLang,
  });

  const navigator = createNavigator({
    catalog,
    atlases: model.manifest.atlases,
    cutAtlases: model.manifest.cut_atlases,
    onSelect: select,
    onToggleGroup: name => { session.toggleGroup(name); render(); },
    onQuery: query => { session.setQuery(query); render(); },
    onReveal: reveal,
    onAtlas: setAtlas,
    onCutAtlas: setCutAtlas,
  });

  const inspector = createInspector({
    catalog,
    networks: model.manifest.networks,
    atlases: model.manifest.atlases,
    onFocus: focusSelection,
    onIsolate: () => display(() => {
      if (model.state.isolatedRegion) model.clearIsolation();
      else {
        model.isolate();
        focusSelection();
      }
    }),
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

  const display_ = createDisplay({
    detailLevels: model.manifest.detail_levels,
    networks: model.manifest.networks,
    onDetail: setDetail,
    onHemisphere: value => display(() => model.setHemisphere(value)),
    onCortexVisible: value => display(() => model.setCortexVisible(value)),
    onCortexOpacity: value => display(() => model.setCortexOpacity(value)),
    onSurfaceColor: value => display(() => model.setSurfaceColor(value)),
    onReset: () => display(() => { sections.setMode('off'); model.reset(); applyView('oblique'); }),
  });

  function faceCut() {
    if (!sections.active) return;
    const frame = sections.frame;
    const direction = rasToWorld(frame.normal.toArray()).normalize()
      .multiplyScalar(sections.state.reverse ? -1 : 1);
    const namedView = {
      sagittal: ['right', 'left'], coronal: ['anterior', 'posterior'],
      axial: ['superior', 'inferior'], oblique: ['oblique', 'oblique'],
    }[sections.state.mode][Number(sections.state.reverse)];
    session.setView(namedView);
    scene.camera.up.copy(rasToWorld(frame.v.toArray()).normalize());
    scene.moveTo(planFraming(scene.camera, scene.controls, bounds, direction, frameTo,
      scene.viewportFit));
    render();
  }

  const sectionControls = createSectionControls(sections, {
    anatomy: model.manifest.anatomy,
    cutAtlases: model.manifest.cut_atlases,
    onFaceView: faceCut,
    onSelect: select,
  });
  const shortcuts = createShortcuts(initialLang);

  chrome = createViewportChrome({
    onView: applyView,
    onRetry: () => globalThis.location.reload(),
    onReticleSelect: select,
  });

  // Built before the sheet: the sheet decides on construction which shell owns
  // the panels, and hands them over through onShell.
  const inspectorTabs = createInspectorTabs();

  /*
   * The phone shell. It reports how much of the canvas it covers rather than
   * resizing it, and everything that must agree about where the viewport is —
   * framing, the crosshair, the markers, the presets — reads that one
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
      updateReticle();
    },
    // Reframing during a drag would fight the finger; on arrival the camera
    // eases to the new rectangle, which is the one thing allowed to animate.
    onDetent: () => { if (framed) frameCurrent(); },
  });

  // ---- the single render path -------------------------------------------

  let announced = null;

  function render() {
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

  let hovered = null;

  function outline() {
    if (sections.active) { scene.setOutlined(); return; }
    const ids = {
      selected: model.state.selectedRegion?.id,
      hovered: hovered?.id,
    };
    const meshFor = id => id && model.visibleMeshes.find(m => m.userData.region_id === id);
    scene.setOutlined({
      selected: [meshFor(ids.selected)].filter(Boolean),
      hovered: [meshFor(ids.hovered)].filter(Boolean),
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

  picker = createPicker({
    domElement: scene.domElement,
    camera: scene.camera,
    model: () => sections,
    onHover: (region, position) => {
      hovered = region;
      chrome.showHover(region ? catalog.get(region.id).label.name : null, position);
      outline();
    },
    onSelect: select,
  });

  /*
   * What the crosshair is over. Kept out of the state loop for the same
   * reason hover is: it answers once per frame of an orbit, and a full
   * re-render would rebuild every panel that often.
   */
  let reticleFrame = null;
  function updateReticle() {
    if (!chrome || !picker || reticleFrame !== null) return;
    reticleFrame = requestAnimationFrame(() => {
      reticleFrame = null;
      if (!isCoarse()) return;
      const rect = scene.visibleRect;
      if (!rect.width || !rect.height) return;
      const region = picker.pickAt(rect.x + rect.width / 2, rect.y + rect.height / 2);
      chrome.showReticleRegion(region, region ? catalog.get(region.id)?.label.name : null);
    });
  }

  // Declared as a function so the scene's resize callback, wired above before
  // the chrome exists, can reach it.
  function onCameraChange() {
    if (!chrome) return;
    chrome.updateCamera(scene.camera, scene.distanceToTarget, scene.viewportHeight);
    chrome.setViewport(scene.visibleRect);
    updateReticle();
  }
  scene.controls.addEventListener('change', onCameraChange);

  const onKeyDown = event => {
    if (event.defaultPrevented || document.getElementById('mpr-dialog').open) return;
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
    if (event.key.toLowerCase() === 'c') {
      return display(() => model.setCortexVisible(!model.state.cortexVisible));
    }
    if (event.key.toLowerCase() === 'h') {
      const order = ['both', 'left', 'right'];
      const next = order[(order.indexOf(model.state.hemisphere) + 1) % order.length];
      return display(() => model.setHemisphere(next));
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
  if (wanted.cortexOpacity !== undefined) model.setCortexOpacity(wanted.cortexOpacity);
  // A shared link may name a layer this build does not carry.
  if (wanted.surfaceColor && (wanted.surfaceColor !== 'network' || model.manifest.networks)) {
    model.setSurfaceColor(wanted.surfaceColor);
  }
  if (wanted.cutAtlas) setCutAtlas(wanted.cutAtlas);
  if (wanted.detail) await setDetail(wanted.detail);
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
  // A finger has no hover, so the crosshair carries identification instead.
  chrome.setReticle(isCoarse());
  chrome.setViewport(scene.visibleRect);
  onCameraChange();
  render();

  return {
    dispose() {
      globalThis.removeEventListener('keydown', onKeyDown);
      scene.controls.removeEventListener('change', onCameraChange);
      clearTimeout(urlTimer);
      if (reticleFrame !== null) cancelAnimationFrame(reticleFrame);
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
      inspector.dispose();
      clinicalExplorer.dispose();
      navigator.dispose();
      header.dispose();
      model.dispose();
      scene.dispose();
    },
  };
}
