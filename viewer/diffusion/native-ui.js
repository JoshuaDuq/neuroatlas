import catalog from '../../data/diffusion.yaml';
import { createNativeTractViewer } from './native-viewer.js';
import { DIFFUSION_TEXT } from './translations.js';
import { tractRow, tractRows, updateTractRow, saveLengths } from './controls.js';
import { createMriNavigator } from './navigation-ui.js';
import { t } from '../i18n/translations.js';

const MARKUP = `
  <div class="panel-body native-tract-controls">
    <h3 class="visually-hidden" data-native-copy="dataset"></h3>
    <p class="diffusion-lead" data-native-copy="nativeReference"></p>
    <p id="native-tract-anatomy-mismatch" class="diffusion-note" data-native-copy="otherAnatomy"></p>
    <p id="native-tract-status" class="diffusion-note" role="status"></p>
    <button id="native-tract-retry" type="button" data-native-copy="retry" hidden></button>
    <label id="native-tract-overlay-control" class="check">
      <input id="native-tract-overlay" type="checkbox" /> <span data-native-copy="showOverlay"></span>
    </label>
    <fieldset id="native-tract-controls" disabled>
      <div class="control-field">
        <label for="native-tract-opacity"><span data-native-copy="brainOpacity"></span>
          <output id="native-tract-opacity-value" class="measure" for="native-tract-opacity"></output></label>
        <input id="native-tract-opacity" type="range" min="0" max="1" step="0.02" value="0.16" />
      </div>
      <div class="control-field">
        <label for="native-tract-minimum"><span data-native-copy="minimum"></span>
          <output id="native-tract-minimum-value" class="measure" for="native-tract-minimum">1</output></label>
        <input id="native-tract-minimum" type="range" min="1" max="250" step="1" value="1" />
      </div>
      <h4 class="field-group-heading" data-native-copy="bundleCollection"></h4>
      <label class="visually-hidden" for="native-tract-search" data-native-copy="search"></label>
      <div class="search-box">
        <svg class="search-affordance" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="native-tract-search" type="search" autocomplete="off" spellcheck="false" />
      </div>
      <p class="diffusion-note diffusion-load-hint" data-native-copy="loadHint"></p>
      <div id="native-tract-bundles"></div>
      <p id="native-tract-no-results" class="diffusion-note" data-native-copy="noResults" hidden></p>
      <div class="diffusion-exports">
        <button id="native-tract-restore" class="button-quiet" type="button" data-native-copy="restore"></button>
        <button id="native-tract-csv" class="button-quiet" type="button" data-native-copy="exportMetrics"></button>
      </div>
    </fieldset>
    <details class="diffusion-about">
      <summary data-native-copy="about"></summary>
      <p class="diffusion-note" data-native-copy="nativeHint"></p>
      <p class="diffusion-note" data-native-copy="outlineLimit"></p>
      <p id="native-tract-mri-hint" class="diffusion-note" data-native-copy="mriHint"></p>
      <p class="diffusion-note" data-native-copy="metricsScope"></p>
      <p class="diffusion-note" data-native-copy="files"></p>
      <a id="native-tract-source" class="diffusion-source" target="_blank" rel="noreferrer" data-native-copy="source"></a>
      <a id="native-tract-provenance" class="diffusion-source" target="_blank" rel="noreferrer" data-native-copy="outlineProvenance"></a>
    </details>
  </div>
  <div class="native-tract-command">
    <button id="native-tract-mri" class="button-primary" type="button" data-native-copy="mriOpen"></button>
  </div>`;

export function createNativeTractExplorer({ scene, anatomy, onActive, onReady, onCortexOpacity, onVisibility, sections }) {
  const entry = document.getElementById('diffusion-browser');
  entry.innerHTML = MARKUP;
  const get = name => entry.querySelector(`#native-tract-${name}`);
  const engine = createNativeTractViewer(catalog, scene.invalidate);
  const matchingAnatomy = anatomy === catalog.anatomy;
  scene.scene.add(engine.group);
  engine.setOutlineVisible(!matchingAnatomy);
  get('opacity').value = catalog.brain_outline.opacity;
  get('source').href = catalog.source;
  get('provenance').href = `${import.meta.env.BASE_URL}diffusion/${catalog.brain_outline.provenance}`;
  const listeners = new AbortController();
  const listen = (name, event, handler) => get(name).addEventListener(event, handler, { signal: listeners.signal });
  let active = false;
  let referenceActive = false;
  let ready = false;
  let busy = false;
  let lang = 'en';
  let error = null;
  let disposed = false;
  let overlayVisible = false;
  let cortexOpacity = 1;
  const copy = () => DIFFUSION_TEXT[lang];
  const mri = createMriNavigator({ catalog,
    getTracts: engine.snapshot,
    getMinimum: () => Number(get('minimum').value),
    getPoint: () => matchingAnatomy && ready ? engine.surfaceToScanner(sections.state.crosshair) : null,
    onPoint: point => {
      if (matchingAnatomy && ready) sections.setCrosshair(engine.scannerToSurface(point));
    },
  });
  const bundles = new Map(catalog.bundles.map(bundle => [bundle.id, bundle]));
  const onBundle = (id, visible) => {
    if (engine.hasBundle(id)) {
      runControl(() => engine.setVisible(id, visible));
      onVisibility?.();
    } else runLoad(() => engine.loadBundle(bundles.get(id))).then(() => onVisibility?.());
  };
  const rows = tractRows(catalog.bundles).map(row => ({ row, section: tractRow(row, onBundle) }));
  get('bundles').append(...rows.map(({ section }) => section));

  function filterBundles() {
    const query = get('search').value.trim().toLocaleLowerCase(lang);
    let matches = 0;
    for (const row of get('bundles').children) {
      row.hidden = !row.dataset.name.includes(query);
      if (!row.hidden) matches++;
    }
    get('no-results').hidden = matches > 0;
  }

  function render() {
    if (disposed) return;
    for (const node of entry.querySelectorAll('[data-native-copy]')) {
      node.textContent = copy()[node.dataset.nativeCopy];
    }
    get('search').placeholder = copy().search;
    get('status').textContent = error ? error.message : copy()[busy ? 'loading' : 'ready'];
    get('status').role = error ? 'alert' : 'status';
    get('status').classList.toggle('visually-hidden', ready && !busy && !error);
    get('status').dataset.error = String(Boolean(error));
    get('retry').hidden = !error || busy;
    get('controls').disabled = busy || !ready;
    get('overlay-control').hidden = !matchingAnatomy;
    get('overlay').checked = overlayVisible;
    get('anatomy-mismatch').hidden = matchingAnatomy;
    get('mri-hint').hidden = !matchingAnatomy;
    entry.querySelector('[data-native-copy="outlineLimit"]').hidden = matchingAnatomy;
    get('provenance').hidden = matchingAnatomy;
    entry.querySelector('[data-native-copy="brainOpacity"]').textContent = matchingAnatomy
      ? copy().cortexOpacity : copy().brainOpacity;
    if (matchingAnatomy) get('opacity').value = cortexOpacity;
    get('opacity-value').value = `${Math.round(Number(get('opacity').value) * 100)}%`;
    engine.group.visible = matchingAnatomy ? overlayVisible : active;
    const loaded = new Map(engine.snapshot().map(bundle => [bundle.catalogId, bundle]));
    const glyphs = t(lang, 'sides').glyphs;
    for (const { row, section } of rows) updateTractRow(section, row, { lang, loaded, glyphs, text: copy() });
    filterBundles();
  }

  async function runLoad(action) {
    if (busy) return;
    const focused = entry.contains(document.activeElement) ? document.activeElement : null;
    busy = true; error = null; render();
    try {
      await action();
      if (disposed) return;
      const firstReference = !ready;
      ready = true;
      if (firstReference) onReady();
    } catch (caught) {
      error = caught; console.error(caught.stack);
    } finally {
      busy = false; render();
      if (focused && active && document.activeElement === document.body) {
        focused.focus({ preventScroll: true });
      }
    }
  }

  function runControl(action) {
    try { action(); error = null; }
    catch (caught) { error = caught; console.error(caught); }
    render();
  }

  listen('retry', 'click', () => runLoad(() => engine.load()));
  listen('mri', 'click', mri.open);
  listen('overlay', 'change', event => {
    overlayVisible = event.target.checked;
    render(); scene.invalidate();
    onVisibility?.();
  });
  listen('search', 'input', filterBundles);
  listen('opacity', 'input', event => runControl(() => {
    const value = Number(event.target.value);
    if (matchingAnatomy) onCortexOpacity(value);
    else engine.setOpacity(value);
  }));
  listen('minimum', 'input', event => { get('minimum-value').value = event.target.value; });
  listen('minimum', 'change', event => runControl(() => engine.setMinimum(Number(event.target.value))));
  listen('restore', 'click', () => runControl(() => {
    for (const bundle of engine.snapshot()) {
      engine.setVisible(bundle.id, Boolean(catalog.bundles.find(entry => entry.id === bundle.id).initial));
    }
  }));
  listen('csv', 'click', () => saveLengths(engine.snapshot(), Number(get('minimum').value)));

  return {
    get anatomy() { return catalog.anatomy; },
    get ready() { return ready; },
    get streamlinesVisible() { return ready && engine.group.visible && engine.anyVisible; },
    get bounds() { return engine.bounds; },
    get defaultOpacity() { return catalog.overlay_cortex_opacity; },
    get mriOpen() { return mri.isOpen; },
    openMri: mri.open,
    enableOverlay() {
      if (!matchingAnatomy) throw new Error('Tracts can only overlay their own SNAIL anatomy.');
      overlayVisible = true;
    },
    setClippingPlanes: engine.setClippingPlanes,
    reference(language) {
      return { label: catalog.name[language], description: DIFFUSION_TEXT[language].outlineLimit,
        detail: DIFFUSION_TEXT[language].bundleCollection,
        canvasLabel: DIFFUSION_TEXT[language].nativeCanvas };
    },
    update(state) {
      const next = state.explorer === 'diffusion';
      lang = state.lang;
      mri.updateLanguage(lang);
      cortexOpacity = state.cortexOpacity;
      if (active !== next) {
        active = next;
        const nextReference = active && !matchingAnatomy;
        if (referenceActive !== nextReference) {
          referenceActive = nextReference;
          onActive(referenceActive);
        }
        if (active && !ready && !busy) runLoad(() => engine.load());
      }
      entry.hidden = !active;
      render();
    },
    focus() { get('search').focus(); },
    dispose() {
      disposed = true;
      listeners.abort();
      mri.dispose();
      engine.dispose();
    },
  };
}
