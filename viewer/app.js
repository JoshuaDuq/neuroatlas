import { Box3 } from 'three';
import { createCatalog } from './catalog/catalog.js';
import { BrainAtlas } from './model/brain-atlas.js';
import { VIEW_DIRECTIONS, frameTo, upFor } from './render/camera-views.js';
import { createPicker } from './render/picking.js';
import { createScene, planFraming } from './render/scene.js';
import { createSession, shortcutsAllowed } from './state/session.js';
import { createTheme } from './state/theme.js';
import { decodeState, encodeState } from './state/url-state.js';
import { createDisplay } from './ui/display.js';
import { createHeader } from './ui/header.js';
import { createInspector } from './ui/inspector.js';
import { createNavigator } from './ui/navigator.js';
import { createViewportChrome } from './ui/viewport-chrome.js';

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
  const scene = createScene(viewport);
  const session = createSession({ views: Object.keys(VIEW_DIRECTIONS) });
  const theme = createTheme(() => scene.applyTheme());

  const manifestUrl = `${import.meta.env.BASE_URL}models/manifest.json`;
  const model = await BrainAtlas.load(manifestUrl, wanted.atlas, progress => {
    if (progress?.total) {
      session.setProgress({ loaded: progress.loaded, total: progress.total });
      render();
    }
  });

  const catalog = createCatalog(model.manifest);
  const bounds = new Box3().setFromObject(model.group);
  scene.scene.add(model.group);
  scene.transparencyProbe = () =>
    model.visibleMeshes.some(mesh => mesh.material.transparent);

  // ---- commands ---------------------------------------------------------

  /** Apply a display change, and say so if it silently dropped the selection. */
  function display(change) {
    const had = model.state.selectedRegion;
    change();
    if (had && !model.state.selectedRegion) {
      session.notify(`Selection cleared — ${had.label ?? 'region'} is no longer shown.`);
    }
    render();
  }

  function applyView(view) {
    if (!session.setView(view)) return;
    scene.camera.up.copy(upFor(view));
    scene.moveTo(planFraming(
      scene.camera, scene.controls, bounds, VIEW_DIRECTIONS[view], frameTo));
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
    session.setProgress(null);
    render();
    try {
      await model.setAtlas(id, progress => {
        if (progress?.total) {
          session.setProgress({ loaded: progress.loaded, total: progress.total });
          render();
        }
      });
      session.setStatus('ready');
    } catch (error) {
      // Keep the atlas that still works; the control reverts on the next render.
      session.setError(error);
    }
    render();
  }

  /** Undo whatever is hiding a region, then select it. */
  function reveal(reason, id) {
    if (reason === 'cortex-hidden') model.setCortexVisible(true);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.reset();
    select(id);
  }

  // ---- panels -----------------------------------------------------------

  const header = createHeader({
    atlases: model.manifest.atlases,
    onAtlas: setAtlas,
    onTheme: () => { theme.toggle(); session.setTheme(theme.current); render(); },
  });

  const navigator = createNavigator({
    catalog,
    atlases: model.manifest.atlases,
    onSelect: select,
    onToggleGroup: name => { session.toggleGroup(name); render(); },
    onQuery: query => { session.setQuery(query); render(); },
    onReveal: reveal,
    onAtlas: setAtlas,
  });

  const inspector = createInspector({
    catalog,
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
    onReset: () => display(() => { model.reset(); applyView('oblique'); }),
  });

  const chrome = createViewportChrome({
    onView: applyView,
    onRetry: () => globalThis.location.reload(),
  });

  // ---- the single render path -------------------------------------------

  let announced = null;

  function render() {
    const state = session.assemble(model.state);
    root.dataset.status = state.status;
    const visibleCount = catalog.visibleCount(state);

    header.update(state, { visibleCount });
    navigator.update(state);
    inspector.update(state);
    display_.update(state);
    chrome.update(state);
    outline();
    syncUrl(state);

    // The text state is the product for a reader who cannot see the render.
    const region = state.selectedRegion;
    const spoken = region ? `Selected: ${catalog.get(region.id).label.name}, ${region.hemisphere}` : null;
    if (spoken !== announced) {
      announced = spoken;
      announcer.textContent = spoken ?? '';
    }
  }

  let hovered = null;

  function outline() {
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
    model: () => model,
    onHover: (region, position) => {
      hovered = region;
      chrome.showHover(region ? catalog.get(region.id).label.name : null, position);
      outline();
    },
    onSelect: select,
  });

  const onCameraChange = () =>
    chrome.updateCamera(scene.camera, scene.distanceToTarget, scene.viewportHeight);
  scene.controls.addEventListener('change', onCameraChange);

  const onKeyDown = event => {
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
  scene.applyTheme();
  session.setTheme(theme.current);
  scene.setSize();
  applyView(session.assemble(model.state).view);
  if (wanted.hemisphere) model.setHemisphere(wanted.hemisphere);
  if (wanted.cortexVisible !== undefined) model.setCortexVisible(wanted.cortexVisible);
  if (wanted.cortexOpacity !== undefined) model.setCortexOpacity(wanted.cortexOpacity);
  if (wanted.atlasColors !== undefined) model.setAtlasColors(wanted.atlasColors);
  if (wanted.view) applyView(wanted.view);
  if (wanted.selectedRegion && catalog.get(wanted.selectedRegion)) {
    try {
      model.select(wanted.selectedRegion);
    } catch {
      session.notify('That region is not in this view.');
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
