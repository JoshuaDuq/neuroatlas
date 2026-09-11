import { Box3 } from 'three';
import { createCatalog } from './catalog/catalog.js';
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
import { createNavigator } from './ui/navigator.js';
import { createShortcuts } from './ui/shortcuts.js';
import { createViewportChrome } from './ui/viewport-chrome.js';
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
  // download, which is long, and would otherwise hit a dead zone.
  let chrome = null;
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

  function applyView(view, { immediate = false } = {}) {
    if (!session.setView(view)) return;
    scene.camera.up.copy(upFor(view));
    scene.moveTo(
      planFraming(scene.camera, scene.controls, bounds, VIEW_DIRECTIONS[view], frameTo),
      { immediate: immediate || !framed },
    );
    framed = true;
    render();
  }

  function focusSelection() {
    const id = model.state.selectedRegion?.id;
    const mesh = id && model.visibleMeshes.find(m => m.userData.region_id === id);
    if (!mesh) return;
    const direction = scene.camera.position.clone().sub(scene.controls.target).normalize();
    scene.moveTo(planFraming(
      scene.camera, scene.controls, new Box3().setFromObject(mesh), direction, frameTo));
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

  /** Undo whatever is hiding a region, then select it. */
  function reveal(reason, id) {
    if (reason === 'cortex-hidden') model.setCortexVisible(true);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    // A cut-only region is nowhere until a plane exists. Coronal is the
    // conventional default, and the panel moves it from there.
    if (reason === 'no-cut') sections.setMode('coronal').catch(() => {});
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

  const display_ = createDisplay({
    onHemisphere: value => display(() => model.setHemisphere(value)),
    onCortexVisible: value => display(() => model.setCortexVisible(value)),
    onCortexOpacity: value => display(() => model.setCortexOpacity(value)),
    onAtlasColors: value => display(() => model.setAtlasColors(value)),
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
    scene.moveTo(planFraming(scene.camera, scene.controls, bounds, direction, frameTo));
    render();
  }

  const sectionControls = createSectionControls(sections, {
    cutAtlases: model.manifest.cut_atlases,
    onFaceView: faceCut,
    onSelect: select,
  });
  const shortcuts = createShortcuts(initialLang);

  chrome = createViewportChrome({
    onView: applyView,
    onRetry: () => globalThis.location.reload(),
  });

  // ---- the single render path -------------------------------------------

  let announced = null;

  function render() {
    const state = session.assemble(model.state, {
      atlas: sections.state.cutAtlas,
      active: sections.active,
    });
    catalog.setLanguage(state.lang);
    document.documentElement.lang = state.lang;
    root.dataset.status = state.status;
    const visibleCount = catalog.visibleCount(state);

    header.update(state, { visibleCount });
    navigator.update(state);
    inspector.update(state);
    display_.update(state);
    sectionControls.update(state);
    chrome.update(state);
    shortcuts.setLanguage(state.lang);
    outline();
    syncUrl(state);

    const colophonText = document.getElementById('colophon-text');
    if (colophonText) colophonText.textContent = t(state.lang, 'footer').colophon;
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

  const picker = createPicker({
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

  // Declared as a function so the scene's resize callback, wired above before
  // the chrome exists, can reach it.
  function onCameraChange() {
    if (!chrome) return;
    chrome.updateCamera(scene.camera, scene.distanceToTarget, scene.viewportHeight);
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
    if (event.key === '/') { event.preventDefault(); navigator.focusSearch(); return; }
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
  if (wanted.atlasColors !== undefined) model.setAtlasColors(wanted.atlasColors);
  if (wanted.cutAtlas) setCutAtlas(wanted.cutAtlas);
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
  onCameraChange();
  render();

  return {
    dispose() {
      globalThis.removeEventListener('keydown', onKeyDown);
      scene.controls.removeEventListener('change', onCameraChange);
      clearTimeout(urlTimer);
      sections.removeEventListener('change', render);
      model.removeEventListener('change', render);
      sectionControls.dispose();
      sections.dispose();
      shortcuts.dispose();
      picker.dispose();
      chrome.dispose();
      display_.dispose();
      inspector.dispose();
      navigator.dispose();
      header.dispose();
      model.dispose();
      scene.dispose();
    },
  };
}
