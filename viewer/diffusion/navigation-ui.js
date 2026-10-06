import { createMriNavigationViewer } from './navigation-viewer.js';
import { isPhone } from '../render/device.js';

const TEXT = {
  en: {
    title: 'MRI with tracts · SNAIL subject 1', close: 'Close',
    hint: 'Click a slice to position the crosshair. Scroll through slices; arrow keys move one voxel.',
    plane: 'View', all: 'Linked slices + 3D', axial: 'Axial', coronal: 'Coronal', sagittal: 'Sagittal',
    voxel: 'Source voxel (0-based)', go: 'Go to voxel', window: 'T1 window',
    center: 'T1 level', faOpacity: 'FA overlay opacity',
    loading: 'Loading the reference MRI and selected tracts…', retry: 'Reload MRI',
    canvas: 'Linked SNAIL MRI slices and tracts. Click to position the crosshair; arrows move one voxel.',
    scope: 'Scanner RAS millimeters · R/L marked. Tracts use the complete source geometry and current length filter. The published scan has cropped inferior coverage; cortical atlas parcels remain surface labels.',
    grid: (dims, spacing) => `${dims.join(' × ')} source voxels · ${spacing.join(' × ')} mm spacing`,
  },
  fr: {
    title: 'IRM avec faisceaux · SNAIL sujet 1', close: 'Fermer',
    hint: 'Cliquer une coupe pour placer le réticule. Défiler pour parcourir les coupes ; les flèches déplacent d’un voxel.',
    plane: 'Vue', all: 'Coupes liées + 3D', axial: 'Axiale', coronal: 'Coronale', sagittal: 'Sagittale',
    voxel: 'Voxel source (indice 0)', go: 'Aller au voxel', window: 'Fenêtre T1',
    center: 'Niveau T1', faOpacity: 'Opacité de la superposition FA',
    loading: 'Chargement de l’IRM de référence et des faisceaux sélectionnés…', retry: 'Recharger l’IRM',
    canvas: 'Coupes IRM SNAIL liées et faisceaux. Cliquer pour placer le réticule ; les flèches déplacent d’un voxel.',
    scope: 'Millimètres RAS du scanner · L/R (gauche/droite) indiquées. Les faisceaux conservent la géométrie source complète et le filtre de longueur courant. La couverture inférieure de l’image publiée est tronquée ; les régions corticales restent des étiquettes de surface.',
    grid: (dims, spacing) => `${dims.join(' × ')} voxels source · espacement de ${spacing.join(' × ')} mm`,
  },
};

export function createMriNavigator({ catalog, getTracts, getMinimum, getPoint, onPoint }) {
  const dialog = document.getElementById('diffusion-mri-dialog');
  const get = id => dialog.querySelector(`#diffusion-mri-${id}`);
  const canvas = get('canvas');
  const listeners = new AbortController();
  const listen = (id, event, action) => get(id).addEventListener(event, action, { signal: listeners.signal });
  let language = 'en';
  let engine = null;
  let busy = false;
  let disposed = false;
  let error = null;
  let location = null;
  const map = catalog.maps[0];
  get('window').max = map.range[1] - map.range[0];
  get('window').value = get('window').max;
  get('center').min = map.range[0];
  get('center').max = map.range[1];
  get('center').value = (map.range[0] + map.range[1]) / 2;
  get('plane').value = isPhone() ? 'AXIAL' : 'MULTIPLANAR';

  function render() {
    const copy = TEXT[language];
    for (const node of dialog.querySelectorAll('[data-mri-copy]')) node.textContent = copy[node.dataset.mriCopy];
    canvas.setAttribute('aria-label', copy.canvas);
    canvas.tabIndex = busy || !engine ? -1 : 0;
    get('controls').disabled = busy || !engine;
    get('status').textContent = error ? error.message : busy ? copy.loading : '';
    get('status').hidden = !busy && !error;
    get('status').role = error ? 'alert' : 'status';
    get('status').dataset.error = String(Boolean(error));
    get('retry').hidden = !error || busy;
    for (const name of ['window', 'center', 'fa']) get(`${name}-value`).value = get(name).value;
    if (engine) {
      const header = engine.header;
      get('grid').textContent = copy.grid(header.dims.slice(1, 4), header.pixDims.slice(1, 4));
      for (const [axis, id] of ['i', 'j', 'k'].entries()) get(id).max = header.dims[axis + 1] - 1;
    }
    if (location) {
      const number = value => Number.isFinite(value) ? value.toLocaleString(language,
        { maximumFractionDigits: 3 }) : String(value);
      // French sets a narrow no-break space before a colon; a label never wraps away from its value.
      const colon = language === 'fr' ? '\u202f:\u00a0' : ':\u00a0';
      get('readout').textContent = `RAS${colon}${Array.from(location.mm).slice(0, 3).map(number).join(' · ')}\u202fmm`
        + ` · T1${colon}${number(location.values[0].value)} · FA${colon}${number(location.values[1].value)}`;
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
    for (const [axis, id] of ['i', 'j', 'k'].entries()) get(id).value = Math.round(next.vox[axis]);
    render();
    if (!busy && dialog.open) onPoint(Array.from(next.mm).slice(0, 3));
  }

  async function load() {
    if (busy || disposed) return;
    busy = true; error = null; render();
    try {
      if (!engine) {
        const loaded = await createMriNavigationViewer(catalog, canvas, updateLocation);
        if (disposed) { loaded.dispose(); return; }
        engine = loaded;
        engine.setVoxel(engine.header.dims.slice(1, 4).map(size => Math.floor(size / 2)));
      }
      const point = getPoint();
      if (point) engine.setScannerPoint(point);
      await engine.syncTracts(getTracts().filter(bundle => bundle.visible).map(bundle => bundle.id), getMinimum());
      engine.setPlane(get('plane').value);
      if (dialog.open) engine.resize();
    } catch (caught) { if (!disposed) report(caught); }
    finally { busy = false; if (!disposed) render(); }
  }

  listen('close', 'click', () => dialog.close());
  listen('retry', 'click', load);
  listen('plane', 'change', () => run(() => engine.setPlane(get('plane').value)));
  listen('position', 'submit', event => {
    event.preventDefault();
    run(() => engine.setVoxel(['i', 'j', 'k'].map(id => Number(get(id).value))));
  });
  for (const name of ['window', 'center', 'fa']) listen(name, 'input', render);
  for (const name of ['window', 'center']) listen(name, 'change', () => run(() =>
    engine.setWindow(Number(get('center').value), Number(get('window').value))));
  listen('fa', 'change', () => run(() => engine.setFaOpacity(Number(get('fa').value))));
  canvas.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0],
      ArrowDown: [0, -1, 0], ArrowUp: [0, 1, 0], PageDown: [0, 0, -1], PageUp: [0, 0, 1] };
    if (!engine || busy || !moves[event.key]) return;
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
    dispose() { disposed = true; listeners.abort(); if (dialog.open) dialog.close(); engine?.dispose(); },
  };
}
