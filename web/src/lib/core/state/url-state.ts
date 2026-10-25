/**
 * The shareable part of the viewer's state, encoded into the URL hash.
 *
 * This module knows nothing about which atlases, regions or views exist. It
 * checks what is checkable without that knowledge and passes the rest through
 * as opaque strings; `link-check.ts` judges those against the loaded anatomy.
 */
import { CUTS, EXPLORERS, FUNCTIONAL_LEVELS, HEMISPHERES, SURFACE_COLORS } from '../../types/constants.ts';
import type { LinkInput, LinkState, Orbit } from '../../types/index.ts';

type Defaults = Pick<
  LinkState,
  | 'hemisphere'
  | 'cortexVisible'
  | 'cortexOpacity'
  | 'internalVisible'
  | 'spinalCordVisible'
  | 'surfaceColor'
  | 'functionalLevel'
  | 'view'
  | 'cut'
  | 'cutOffset'
  | 'cutReverse'
  | 'cutTilt'
  | 'cutAzimuth'
  | 'selectedRegion'
  | 'isolatedRegion'
  | 'internalSystem'
  | 'anatomy'
  | 'explorer'
  | 'selectedFunction'
  | 'selectedDeficit'
  | 'circuit'
  | 'circuitStep'
  | 'orbit'
  | 'mriWindow'
>;

export const DEFAULTS: Defaults = {
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

type Reader<T> = (value: string) => T | undefined;

/**
 * `colors` was a flag before the surface could be coloured several ways. Links
 * carrying the old one still mean what they meant; nothing writes them any more.
 */
const surfaceColor: Reader<LinkState['surfaceColor']> = (value) => {
  if (value === '1') return 'atlas';
  if (value === '0') return 'tissue';
  return SURFACE_COLORS.find((color) => color === value);
};

const flag: Reader<boolean> = (value) => (value === '1' ? true : value === '0' ? false : undefined);
const nonempty: Reader<string> = (value) => (value.trim() ? value : undefined);
const numberOf = (value: string) => (value.trim() ? Number(value) : NaN);
const oneOf =
  <T extends string>(values: readonly T[]): Reader<T> =>
  (value) =>
    values.find((candidate) => candidate === value);

const millimetres: Reader<number> = (value) => {
  const number = numberOf(value);
  if (!Number.isFinite(number) || Math.abs(number) > 512) return undefined;
  return Math.round(number * 10) / 10;
};

const degrees = (value: string, minimum: number, maximum: number) => {
  const number = numberOf(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) return undefined;
  return Math.round(number);
};

/** A comma-separated list of finite numbers, or undefined. */
const numbers = (value: string) => {
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
export function orbitWithin(
  { position, target }: Pick<Orbit, 'position' | 'target'>,
  maxDistanceMm: number,
): boolean {
  const distance = Math.hypot(...position.map((value, axis) => value - target[axis]!));
  return distance > 0 && distance <= maxDistanceMm + ORBIT_ROUNDING_MM;
}

/**
 * The exact camera: position and target in millimetres, then its up vector
 * when that is not the named view's.
 */
const orbit: Reader<Orbit> = (value) => {
  const list = numbers(value);
  if (
    !list ||
    ![6, 9].includes(list.length) ||
    list.slice(0, 6).some((n) => Math.abs(n) > CAMERA_LIMIT_MM)
  ) {
    return undefined;
  }
  const result: Orbit = {
    position: list.slice(0, 3) as Orbit['position'],
    target: list.slice(3, 6) as Orbit['target'],
  };
  if (list.length === 9) {
    const up = list.slice(6);
    const length = Math.hypot(...up);
    if (!(length > 0)) return undefined;
    result.up = up.map((n) => n / length) as NonNullable<Orbit['up']>;
  }
  return result;
};

const tenths = (value: number) => Math.round(value * 10) / 10;

/**
 * A cut offset in tenths of a millimetre, rounded toward zero: the plane's range
 * holds zero, so the written value lies inside it whenever the exact one did.
 * A value a float error short of a tenth counts as that tenth.
 */
export function towardZero(value: number): number {
  const scaled = value * 10;
  const nearest = Math.round(scaled);
  return (Math.abs(scaled - nearest) < 1e-6 ? nearest : Math.trunc(scaled)) / 10;
}

const writeOrbit = ({ position, target, up }: Orbit) =>
  [...position, ...target]
    .map(tenths)
    .concat(up ? up.map((n) => Math.round(n * 1000) / 1000) : [])
    .join(',');

/** MRI level and window over the scan's uint8 intensities. */
const mriWindow: Reader<NonNullable<LinkState['mriWindow']>> = (value) => {
  const list = numbers(value);
  if (list?.length !== 2) return undefined;
  const [center, width] = list as [number, number];
  if (center < 0 || center > 255 || width < 1 || width > 256) return undefined;
  return { center, width };
};

/** Circuit steps are counted from one in the link, as the stepper shows them. */
const circuitStep: Reader<number> = (value) => {
  const number = numberOf(value);
  return Number.isInteger(number) && number >= 1 ? number - 1 : undefined;
};

/** State carries the selected region as a record; the URL carries its id. */
const identifier = (value: NonNullable<LinkInput['selectedRegion']>) =>
  typeof value === 'object' ? value.id : value;

const writeFlag = (value: boolean) => (value ? '1' : '0');

interface Field {
  key: keyof LinkInput;
  param: string;
  read: Reader<unknown>;
  write?: (value: never) => string;
}

/** A field whose reader and writer agree on the type of one link-state key. */
function field<K extends keyof LinkInput>(
  key: K,
  param: string,
  read: Reader<LinkState[K & keyof LinkState]>,
  write?: (value: NonNullable<LinkInput[K]>) => string,
): Field {
  return { key, param, read, write };
}

const FIELDS: Field[] = [
  /**
   * Which brain. Region ids are shared between brains by design — the same id
   * names the same region in each — so a link without this would open the
   * right region on whichever brain happened to load.
   */
  field('anatomy', 'anatomy', nonempty),
  field('atlas', 'atlas', nonempty),
  field('cutAtlas', 'cuts', nonempty),
  field('internalSystem', 'system', nonempty),
  field('detail', 'detail', nonempty),
  field('selectedRegion', 'region', nonempty, identifier),
  field('isolatedRegion', 'isolate', nonempty, identifier),
  field('view', 'view', nonempty),
  field('orbit', 'cam', orbit, writeOrbit),
  field('cut', 'cut', oneOf(CUTS)),
  field('cutOffset', 'pos', millimetres, (value) => String(towardZero(value))),
  field('cutReverse', 'rev', flag, writeFlag),
  field('cutTilt', 'tilt', (value) => degrees(value, 0, 90)),
  field('cutAzimuth', 'az', (value) => degrees(value, -180, 180)),
  field('hemisphere', 'hemi', oneOf(HEMISPHERES)),
  field('cortexVisible', 'cortex', flag, writeFlag),
  field('internalVisible', 'internal', flag, writeFlag),
  field('spinalCordVisible', 'cord', flag, writeFlag),
  field('surfaceColor', 'colors', surfaceColor),
  field('functionalLevel', 'level', oneOf(FUNCTIONAL_LEVELS)),
  field(
    'cortexOpacity',
    'opacity',
    (value) => {
      const number = numberOf(value);
      return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined;
    },
    (value) => String(Math.round(value * 100) / 100),
  ),
  field('mriWindow', 'mri', mriWindow, ({ center, width }) => `${tenths(center)},${tenths(width)}`),
  field('explorer', 'tab', oneOf(EXPLORERS)),
  field('selectedFunction', 'function', nonempty),
  field('selectedDeficit', 'deficit', nonempty),
  field('circuit', 'circuit', nonempty),
  field('circuitStep', 'step', circuitStep, (value) => String(value + 1)),
  field('lang', 'lang', oneOf(['en', 'fr'] as const)),
];

/** The link parameter each state field travels under. */
export const PARAMS: Readonly<Record<string, string>> = Object.fromEntries([
  ...FIELDS.map(({ key, param }) => [key, param]),
  ['hiddenRegions', 'hidden'],
]);

/** Encode state to a hash body, omitting anything still at its default. */
export function encodeState(state: Partial<LinkInput>): string {
  const parameters = new URLSearchParams();
  if (state.hiddenRegions?.size) {
    parameters.set('hidden', [...state.hiddenRegions].sort().join(','));
  }
  for (const { key, param, write } of FIELDS) {
    const value = state[key];
    if (value === undefined || value === null) continue;
    if (key in DEFAULTS && value === DEFAULTS[key as keyof Defaults]) continue;
    parameters.set(param, write ? (write as (value: unknown) => string)(value) : String(value));
  }
  // URLSearchParams percent-encodes colons and commas, which makes ids and coordinates unreadable.
  return parameters.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');
}

/**
 * Decode a hash body field by field. A field that is repeated or does not
 * parse is not guessed at: it is left out of `state` and named in `rejected`.
 */
export function decodeState(hash: string): { state: Partial<LinkState>; rejected: string[] } {
  if (typeof hash !== 'string') throw new TypeError('URL state must be a string.');
  const state: Record<string, unknown> = {};
  const rejected: string[] = [];
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  for (const { key, param, read } of FIELDS) {
    if (!parameters.has(param)) continue;
    const values = parameters.getAll(param);
    const value = values.length === 1 ? read(values[0]!) : undefined;
    if (value === undefined) rejected.push(param);
    else state[key] = value;
  }
  if (parameters.has('hidden')) {
    const values = parameters.getAll('hidden');
    const ids = values.length === 1 ? values[0]!.split(',') : [''];
    if (ids.some((id) => !id)) rejected.push('hidden');
    else state.hiddenRegions = [...new Set(ids)];
  }
  return { state: state as Partial<LinkState>, rejected };
}
