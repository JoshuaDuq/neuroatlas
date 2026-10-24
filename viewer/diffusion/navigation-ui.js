import { createMriNavigationViewer } from './navigation-viewer.js';
import { diffusionError, diffusionErrorCode, mriReadout } from './translations.js';
import { isPhone } from '../render/device.js';
import { t } from '../i18n/translations.js';
import { reloadWithoutStoredModels } from '../model/published-assets.js';
import { decimal, percent, withUnit } from '../ui/format.js';

const TEXT = {
  en: {
    close: 'Close',
    hint: 'Click a slice to position the crosshair. Scroll through slices; arrow keys move one voxel.',
    plane: 'View', all: 'Linked slices + 3D', axial: 'Axial', coronal: 'Coronal', sagittal: 'Sagittal',
    voxel: 'Source voxel (0-based)', go: 'Go to voxel', window: 'Window',
    center: 'Level', faOpacity: 'FA opacity',
    loading: 'Loading the reference MRI and selected tracts…', retry: 'Reload MRI',
    outside: 'The atlas crosshair lies outside this scan’s field of view; the MRI keeps its position.',
    grid: (dims, spacing) => `${dims.join(' × ')} source voxels · ${spacing} spacing`,
  },
  fr: {
    close: 'Fermer',
    hint: 'Cliquer une coupe pour placer le réticule. Défiler pour parcourir les coupes ; les flèches déplacent d’un voxel.',
    plane: 'Vue', all: 'Coupes liées + 3D', axial: 'Axiale', coronal: 'Coronale', sagittal: 'Sagittale',
    voxel: 'Voxel source (indice 0)', go: 'Aller au voxel', window: 'Fenêtre',
    center: 'Niveau', faOpacity: 'Opacité FA',
    loading: 'Chargement de l’IRM de référence et des faisceaux sélectionnés…', retry: 'Recharger l’IRM',
    outside: 'Le réticule de l’atlas est hors du champ de cette image ; l’IRM garde sa position.',
    grid: (dims, spacing) => `${dims.join(' × ')} voxels source · espacement de ${spacing}`,
  },
};

/**
 * The MRI navigator holds a NiiVue engine, a WebGL 2 context and the float32
 * scan volumes only while its dialog is open; closing it frees all three.
 */
export function createMriNavigator({ catalog, getTracts, getMinimum, getPoint, onPoint, loadTract }) {
  const dialog = document.getElementById('diffusion-mri-dialog');
  const get = id => dialog.querySelector(`#diffusion-mri-${id}`);
  let canvas = get('canvas');
  const listeners = new AbortController();
  const listen = (id, event, action) => get(id).addEventListener(event, action, { signal: listeners.signal });
  let language = 'en';
  let engine = null;
  let busy = false;
  let queued = false;
  let disposed = false;
  let error = null;
  let location = null;
  let outside = false;
  const map = catalog.maps[0];
  get('window').max = map.range[1] - map.range[0];
  get('window').value = get('window').max;
  get('center').min = map.range[0];
  get('center').max = map.range[1];
  get('center').value = (map.range[0] + map.range[1]) / 2;
  get('plane').value = isPhone() ? 'AXIAL' : 'MULTIPLANAR';
  // The second map, when there is one, is FA.
  const hasFa = catalog.maps.length > 1;
  get('fa').closest('label').hidden = !hasFa;
  dialog.querySelector('.diffusion-source-file').textContent = catalog.maps.map(map => map.file.split('/').pop()).join(' · ');

  function render() {
    const dataset = catalog.text[language];
    const copy = { ...TEXT[language], title: dataset.mriTitle, canvas: dataset.mriCanvas, scope: dataset.mriScope };
    for (const node of dialog.querySelectorAll('[data-mri-copy]')) node.textContent = copy[node.dataset.mriCopy];
    canvas.setAttribute('aria-label', copy.canvas);
    canvas.tabIndex = busy || !engine ? -1 : 0;
    get('controls').disabled = busy || !engine;
    get('status').textContent = error ? diffusionError(language, error) : busy ? copy.loading : outside ? copy.outside : '';
    get('status').hidden = !busy && !error && !outside;
    get('status').role = error ? 'alert' : 'status';
    get('status').dataset.error = String(Boolean(error));
    get('retry').hidden = !error || busy;
    // Bytes from a newer deploy cannot be fetched again into this page: only a reload helps.
    if (diffusionErrorCode(error) === 'asset-updated') get('retry').textContent = t(language, 'errors').reload;
    for (const name of ['window', 'center']) get(`${name}-value`).value = decimal(Number(get(name).value), 0, language);
    get('fa-value').value = percent(Number(get('fa').value), language);
    for (const name of ['window', 'center', 'fa']) get(name).setAttribute('aria-valuetext', get(`${name}-value`).value);
    if (engine) {
      const header = engine.header;
      const spacing = header.pixDims.slice(1, 4).map(value => decimal(value, 2, language, { trim: true }));
      get('grid').textContent = copy.grid(header.dims.slice(1, 4), withUnit(spacing.join(' × '), 'mm', language));
      for (const [axis, id] of ['i', 'j', 'k'].entries()) get(id).max = header.dims[axis + 1] - 1;
    }
    if (location) {
      get('readout').textContent = mriReadout(Array.from(location.mm).slice(0, 3),
        location.values[0].value, location.values[1]?.value, language);
    }
  }

  function report(caught) { error = caught; console.error(caught); render(); }
  function run(action) {
    try { action(); error = null; render(); }
    catch (caught) { report(caught); }
  }
  function updateLocation(next) {
    if (next.values.length !== catalog.maps.length) return;
    location = next;
    if (!busy) outside = false;
    for (const [axis, id] of ['i', 'j', 'k'].entries()) get(id).value = Math.round(next.vox[axis]);
    render();
    if (!busy && dialog.open) onPoint(Array.from(next.mm).slice(0, 3));
  }

  async function load() {
    if (disposed) return;
    if (busy) { queued = true; return; }
    busy = true; error = null; outside = false; render();
    try {
      if (!engine) {
        const loaded = await createMriNavigationViewer(catalog, canvas, updateLocation, loadTract);
        if (disposed || !dialog.open) { retire(loaded); return; }
        engine = loaded;
        // Reopened, it resumes where the reader left it.
        engine.setWindow(Number(get('center').value), Number(get('window').value));
        if (hasFa) engine.setFaOpacity(Number(get('fa').value));
        engine.setVoxel(location ? Array.from(location.vox, Math.round)
          : engine.header.dims.slice(1, 4).map(size => Math.floor(size / 2)));
      }
      const current = engine;
      const point = getPoint();
      if (point) outside = !current.setScannerPoint(point);
      await current.syncTracts(getTracts().filter(bundle => bundle.visible).map(bundle => bundle.id), getMinimum());
      // Closed while the tracts were added.
      if (current !== engine) return;
      current.setPlane(get('plane').value);
      if (dialog.open) current.resize();
    } catch (caught) { if (!disposed) report(caught); }
    finally {
      busy = false;
      if (!disposed) {
        render();
        if (queued) { queued = false; if (dialog.open) load(); }
      }
    }
  }

  /** A lost context stays bound to its canvas, so the next engine draws on a fresh one. */
  function retire(viewer) {
    viewer.dispose();
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    canvas = fresh;
  }

  function release() {
    if (!engine) return;
    retire(engine);
    engine = null;
    render();
  }

  listen('close', 'click', () => dialog.close());
  dialog.addEventListener('close', release, { signal: listeners.signal });
  listen('retry', 'click', () => {
    if (diffusionErrorCode(error) === 'asset-updated') reloadWithoutStoredModels();
    else load();
  });
  listen('plane', 'change', () => run(() => engine.setPlane(get('plane').value)));
  listen('position', 'submit', event => {
    event.preventDefault();
    run(() => engine.setVoxel(['i', 'j', 'k'].map(id => Number(get(id).value))));
  });
  for (const name of ['window', 'center', 'fa']) listen(name, 'input', render);
  for (const name of ['window', 'center']) listen(name, 'change', () => run(() =>
    engine.setWindow(Number(get('center').value), Number(get('window').value))));
  listen('fa', 'change', () => run(() => engine.setFaOpacity(Number(get('fa').value))));
  dialog.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0],
      ArrowDown: [0, -1, 0], ArrowUp: [0, 1, 0], PageDown: [0, 0, -1], PageUp: [0, 0, 1] };
    if (event.target !== canvas || !engine || busy || !moves[event.key]) return;
    event.preventDefault();
    run(() => engine.moveVoxel(moves[event.key]));
  }, { signal: listeners.signal });
  dialog.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'm' && !event.metaKey && !event.ctrlKey && !event.altKey
      && !event.target.matches('input, select')) {
      event.preventDefault(); dialog.close();
    }
  }, { signal: listeners.signal });
  render();
  return {
    get isOpen() { return dialog.open; },
    open() { if (!dialog.open) dialog.showModal(); load(); },
    updateLanguage(value) { language = value; render(); },
    dispose() { disposed = true; listeners.abort(); if (dialog.open) dialog.close(); engine?.dispose(); engine = null; },
  };
}
