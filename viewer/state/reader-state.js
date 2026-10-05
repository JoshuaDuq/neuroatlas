import { DEFAULTS } from './url-state.js';

/** The scene fields a link carries with a fixed default. Layers default to what is loaded. */
const SCENE_FIELDS = [
  'hemisphere', 'cortexVisible', 'cortexOpacity', 'internalVisible', 'spinalCordVisible',
  'surfaceColor', 'internalSystem', 'view', 'cut', 'cutOffset', 'cutReverse', 'cutTilt',
  'cutAzimuth', 'selectedRegion', 'isolatedRegion',
];

const identifier = value => (value && typeof value === 'object' ? value.id : value);

/**
 * Everything the scene shows, with nothing left implicit: an absent field takes the
 * default a link omits it for, so applying it turns a cut off and clears isolation.
 * `camera` is 'view' (frame the named view), 'cut' (face the cut) or an exact pose.
 */
export function readerState(partial, loaded) {
  const state = {};
  for (const key of SCENE_FIELDS) state[key] = identifier(partial[key]) ?? DEFAULTS[key];
  for (const key of ['atlas', 'detail', 'cutAtlas']) {
    state[key] = partial[key] ?? loaded[key];
    if (!state[key]) throw new Error(`Reader state has no ${key}.`);
  }
  state.hiddenRegions = new Set(partial.hiddenRegions ?? []);
  state.camera = partial.camera ?? 'view';
  return state;
}

export const sameRegions = (a, b) => a.size === b.size && [...a].every(id => b.has(id));
