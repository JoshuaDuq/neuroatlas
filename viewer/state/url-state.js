/**
 * The shareable part of the viewer's state, encoded into the URL hash.
 *
 * Only durable, meaningful state travels: which atlas, which cut labels, where
 * the plane sits, which detail level, which region, and how the model is
 * displayed. The live camera position does not — it changes continuously, and
 * the named view already records the user's intent.
 *
 * This module deliberately knows nothing about which atlases, regions or
 * views exist. It validates what is checkable without that knowledge and
 * passes the rest through as opaque strings for the session to accept or
 * reject against the manifest.
 */
const DEFAULTS = {
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  internalVisible: true,
  spinalCordVisible: false,
  surfaceColor: 'atlas',
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
  lang: 'en',
};

const HEMISPHERES = ['both', 'left', 'right'];
const SURFACE_COLORS = ['tissue', 'mri', 'atlas', 'network'];

/**
 * `colors` was a flag before the surface could be coloured three ways. Links
 * carrying the old one still mean what they meant, so they are read rather
 * than dropped; nothing writes them any more.
 */
const surfaceColor = value => {
  if (value === '1') return 'atlas';
  if (value === '0') return 'tissue';
  return SURFACE_COLORS.includes(value) ? value : undefined;
};

const flag = value => (value === '1' ? true : value === '0' ? false : undefined);

const CUTS = ['sagittal', 'coronal', 'axial', 'oblique'];

const millimetres = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > 512) return undefined;
  return Math.round(number * 10) / 10;
};

const degrees = (value, minimum, maximum) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) return undefined;
  return Math.round(number);
};

/** State carries the selected region as a record; the URL carries its id. */
const identifier = value => (typeof value === 'object' ? value.id : value);

const FIELDS = [
  /**
   * Which brain. Region ids are shared between brains by design — the same id
   * names the same region in each — so a link without this would open the
   * right region on whichever brain happened to load.
   */
  { key: 'anatomy', param: 'anatomy', read: value => value || undefined },
  { key: 'atlas', param: 'atlas', read: value => value || undefined },
  { key: 'cutAtlas', param: 'cuts', read: value => value || undefined },
  { key: 'internalSystem', param: 'system', read: value => value || undefined },
  { key: 'detail', param: 'detail', read: value => value || undefined },
  {
    key: 'selectedRegion',
    param: 'region',
    read: value => value || undefined,
    write: identifier,
  },
  {
    key: 'isolatedRegion',
    param: 'isolate',
    read: value => value || undefined,
    write: identifier,
  },
  { key: 'view', param: 'view', read: value => value || undefined },
  { key: 'cut', param: 'cut', read: value => (CUTS.includes(value) ? value : undefined) },
  { key: 'cutOffset', param: 'pos', read: millimetres },
  { key: 'cutReverse', param: 'rev', read: flag, write: value => (value ? '1' : '0') },
  { key: 'cutTilt', param: 'tilt', read: value => degrees(value, 0, 90) },
  { key: 'cutAzimuth', param: 'az', read: value => degrees(value, -180, 180) },
  {
    key: 'hemisphere',
    param: 'hemi',
    read: value => (HEMISPHERES.includes(value) ? value : undefined),
  },
  { key: 'cortexVisible', param: 'cortex', read: flag, write: value => (value ? '1' : '0') },
  { key: 'internalVisible', param: 'internal', read: flag, write: value => (value ? '1' : '0') },
  { key: 'spinalCordVisible', param: 'cord', read: flag, write: value => (value ? '1' : '0') },
  { key: 'surfaceColor', param: 'colors', read: surfaceColor },
  {
    key: 'cortexOpacity',
    param: 'opacity',
    read: value => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined;
    },
    write: value => String(Math.round(value * 100) / 100),
  },
  {
    key: 'lang',
    param: 'lang',
    read: value => (['en', 'fr'].includes(value) ? value : undefined),
  },
];

/** Encode state to a hash body, omitting anything still at its default. */
export function encodeState(state) {
  const parameters = new URLSearchParams();
  for (const { key, param, write } of FIELDS) {
    const value = state[key];
    if (value === undefined || value === null) continue;
    if (key in DEFAULTS && value === DEFAULTS[key]) continue;
    parameters.set(param, write ? write(value) : String(value));
  }
  // URLSearchParams percent-encodes colons, which makes region ids unreadable.
  return parameters.toString().replaceAll('%3A', ':');
}

/** Decode a hash body, dropping any field that fails validation. */
export function decodeState(hash) {
  const decoded = {};
  let parameters;
  try {
    parameters = new URLSearchParams(hash.replace(/^#/, ''));
  } catch {
    return decoded;
  }
  for (const { key, param, read } of FIELDS) {
    if (!parameters.has(param)) continue;
    let value;
    try {
      value = read(parameters.get(param));
    } catch {
      continue;
    }
    if (value !== undefined) decoded[key] = value;
  }
  return decoded;
}
