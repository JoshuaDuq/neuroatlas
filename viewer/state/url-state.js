/**
 * The shareable part of the viewer's state, encoded into the URL hash.
 *
 * This module knows nothing about which atlases, regions or views exist. It
 * checks what is checkable without that knowledge and passes the rest through
 * as opaque strings; `link-check.js` judges those against the loaded anatomy.
 */
export const DEFAULTS = {
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  internalVisible: true,
  spinalCordVisible: false,
  surfaceColor: 'atlas',
  functionalLevel: 'named',
  view: 'oblique',
  cut: 'off',
  cutOffset: 0,
  cutReverse: false,
  cutTilt: 30,
  cutAzimuth: 30,
  selectedRegion: null,
  isolatedRegion: null,
  internalSystem: null,
  anatomy: null,
  explorer: 'anatomy',
  selectedFunction: null,
  selectedDeficit: null,
  circuit: null,
  circuitStep: 0,
  orbit: null,
  mriWindow: null,
};

const HEMISPHERES = ['both', 'left', 'right'];
const SURFACE_COLORS = ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional'];
const FUNCTIONAL_LEVELS = ['named', 'sections'];
const EXPLORERS = ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion'];

/**
 * `colors` was a flag before the surface could be coloured several ways. Links
 * carrying the old one still mean what they meant; nothing writes them any more.
 */
const surfaceColor = value => {
  if (value === '1') return 'atlas';
  if (value === '0') return 'tissue';
  return SURFACE_COLORS.includes(value) ? value : undefined;
};

const flag = value => (value === '1' ? true : value === '0' ? false : undefined);
const nonempty = value => (value.trim() ? value : undefined);
const numberOf = value => (value.trim() ? Number(value) : NaN);
const oneOf = values => value => (values.includes(value) ? value : undefined);

const CUTS = ['off', 'sagittal', 'coronal', 'axial', 'oblique'];

const millimetres = value => {
  const number = numberOf(value);
  if (!Number.isFinite(number) || Math.abs(number) > 512) return undefined;
  return Math.round(number * 10) / 10;
};

const degrees = (value, minimum, maximum) => {
  const number = numberOf(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) return undefined;
  return Math.round(number);
};

/** A comma-separated list of finite numbers, or undefined. */
const numbers = value => {
  const list = value.split(',').map(numberOf);
  return list.every(Number.isFinite) ? list : undefined;
};

/**
 * Camera positions and targets travel in millimetres. The orbit limits allow 25
 * framed radii (camera-views.js `cameraConstraints`); the widest frame, brain and
 * cord together, is under a metre across, so no camera the app can reach lies
 * past about 14 m. This bound only rejects nonsense; the model judges the rest.
 */
const CAMERA_LIMIT_MM = 100_000;

/** The most that writing to tenths can lengthen a camera's distance: half a tenth on each axis of both ends. */
export const ORBIT_ROUNDING_MM = 2 * Math.hypot(0.05, 0.05, 0.05);

/** Whether a decoded camera sits within the orbit limit it was written under, allowing for that rounding. */
export function orbitWithin({ position, target }, maxDistanceMm) {
  const distance = Math.hypot(...position.map((value, axis) => value - target[axis]));
  return distance > 0 && distance <= maxDistanceMm + ORBIT_ROUNDING_MM;
}

/**
 * The exact camera: position and target in millimetres, then its up vector
 * when that is not the named view's.
 */
const orbit = value => {
  const list = numbers(value);
  if (!list || ![6, 9].includes(list.length) || list.slice(0, 6).some(n => Math.abs(n) > CAMERA_LIMIT_MM)) {
    return undefined;
  }
  const result = { position: list.slice(0, 3), target: list.slice(3, 6) };
  if (list.length === 9) {
    const up = list.slice(6);
    const length = Math.hypot(...up);
    if (!(length > 0)) return undefined;
    result.up = up.map(n => n / length);
  }
  return result;
};

const tenths = value => Math.round(value * 10) / 10;

/**
 * A cut offset in tenths of a millimetre, rounded toward zero: the plane's range
 * holds zero, so the written value lies inside it whenever the exact one did.
 * A value a float error short of a tenth counts as that tenth.
 */
export function towardZero(value) {
  const scaled = value * 10;
  const nearest = Math.round(scaled);
  return (Math.abs(scaled - nearest) < 1e-6 ? nearest : Math.trunc(scaled)) / 10;
}

const writeOrbit = ({ position, target, up }) =>
  [...position, ...target].map(tenths)
    .concat(up ? up.map(n => Math.round(n * 1000) / 1000) : []).join(',');

/** MRI level and window over the scan's uint8 intensities. */
const mriWindow = value => {
  const list = numbers(value);
  if (list?.length !== 2) return undefined;
  const [center, width] = list;
  if (center < 0 || center > 255 || width < 1 || width > 256) return undefined;
  return { center, width };
};

/** Circuit steps are counted from one in the link, as the stepper shows them. */
const circuitStep = value => {
  const number = numberOf(value);
  return Number.isInteger(number) && number >= 1 ? number - 1 : undefined;
};

/** State carries the selected region as a record; the URL carries its id. */
const identifier = value => (typeof value === 'object' ? value.id : value);

const FIELDS = [
  /**
   * Which brain. Region ids are shared between brains by design — the same id
   * names the same region in each — so a link without this would open the
   * right region on whichever brain happened to load.
   */
  { key: 'anatomy', param: 'anatomy', read: nonempty },
  { key: 'atlas', param: 'atlas', read: nonempty },
  { key: 'cutAtlas', param: 'cuts', read: nonempty },
  { key: 'internalSystem', param: 'system', read: nonempty },
  { key: 'detail', param: 'detail', read: nonempty },
  { key: 'selectedRegion', param: 'region', read: nonempty, write: identifier },
  { key: 'isolatedRegion', param: 'isolate', read: nonempty, write: identifier },
  { key: 'view', param: 'view', read: nonempty },
  { key: 'orbit', param: 'cam', read: orbit, write: writeOrbit },
  { key: 'cut', param: 'cut', read: oneOf(CUTS) },
  { key: 'cutOffset', param: 'pos', read: millimetres, write: value => String(towardZero(value)) },
  { key: 'cutReverse', param: 'rev', read: flag, write: value => (value ? '1' : '0') },
  { key: 'cutTilt', param: 'tilt', read: value => degrees(value, 0, 90) },
  { key: 'cutAzimuth', param: 'az', read: value => degrees(value, -180, 180) },
  { key: 'hemisphere', param: 'hemi', read: oneOf(HEMISPHERES) },
  { key: 'cortexVisible', param: 'cortex', read: flag, write: value => (value ? '1' : '0') },
  { key: 'internalVisible', param: 'internal', read: flag, write: value => (value ? '1' : '0') },
  { key: 'spinalCordVisible', param: 'cord', read: flag, write: value => (value ? '1' : '0') },
  { key: 'surfaceColor', param: 'colors', read: surfaceColor },
  { key: 'functionalLevel', param: 'level', read: oneOf(FUNCTIONAL_LEVELS) },
  {
    key: 'cortexOpacity',
    param: 'opacity',
    read: value => {
      const number = numberOf(value);
      return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined;
    },
    write: value => String(Math.round(value * 100) / 100),
  },
  {
    key: 'mriWindow',
    param: 'mri',
    read: mriWindow,
    write: ({ center, width }) => `${tenths(center)},${tenths(width)}`,
  },
  { key: 'explorer', param: 'tab', read: oneOf(EXPLORERS) },
  { key: 'selectedFunction', param: 'function', read: nonempty },
  { key: 'selectedDeficit', param: 'deficit', read: nonempty },
  { key: 'circuit', param: 'circuit', read: nonempty },
  { key: 'circuitStep', param: 'step', read: circuitStep, write: value => String(value + 1) },
  { key: 'lang', param: 'lang', read: oneOf(['en', 'fr']) },
];

/** The link parameter each state field travels under. */
export const PARAMS = Object.fromEntries([
  ...FIELDS.map(({ key, param }) => [key, param]), ['hiddenRegions', 'hidden'],
]);

/** Encode state to a hash body, omitting anything still at its default. */
export function encodeState(state) {
  const parameters = new URLSearchParams();
  if (state.hiddenRegions?.size) {
    parameters.set('hidden', [...state.hiddenRegions].sort().join(','));
  }
  for (const { key, param, write } of FIELDS) {
    const value = state[key];
    if (value === undefined || value === null) continue;
    if (key in DEFAULTS && value === DEFAULTS[key]) continue;
    parameters.set(param, write ? write(value) : String(value));
  }
  // URLSearchParams percent-encodes colons and commas, which makes ids and coordinates unreadable.
  return parameters.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');
}

/**
 * Decode a hash body field by field. A field that is repeated or does not
 * parse is not guessed at: it is left out of `state` and named in `rejected`.
 */
export function decodeState(hash) {
  if (typeof hash !== 'string') throw new TypeError('URL state must be a string.');
  const state = {};
  const rejected = [];
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  for (const { key, param, read } of FIELDS) {
    if (!parameters.has(param)) continue;
    const values = parameters.getAll(param);
    const value = values.length === 1 ? read(values[0]) : undefined;
    if (value === undefined) rejected.push(param);
    else state[key] = value;
  }
  if (parameters.has('hidden')) {
    const values = parameters.getAll('hidden');
    const ids = values.length === 1 ? values[0].split(',') : [''];
    if (ids.some(id => !id)) rejected.push('hidden');
    else state.hiddenRegions = [...new Set(ids)];
  }
  return { state, rejected };
}
