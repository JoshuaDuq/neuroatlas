import { DEFAULTS } from './url-state.js';

/** The scene fields a link carries with a fixed default. Layers default to what is loaded. */
const SCENE_FIELDS = [
  'hemisphere', 'cortexVisible', 'cortexOpacity', 'internalVisible', 'spinalCordVisible',
  'surfaceColor', 'functionalLevel', 'internalSystem', 'view', 'cut', 'cutOffset', 'cutReverse', 'cutTilt',
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

/** Restore requested layers before display, cuts, selection and camera; failures propagate. */
export async function applyReaderState(target, { model, sections, applyCamera, revealInTree }) {
  if (target.atlas !== model.settings.atlas) await model.setAtlas(target.atlas);
  if (target.atlas !== model.settings.atlas) throw new Error(`Atlas not applied: ${target.atlas}`);
  if (target.detail !== model.settings.detail) await model.setDetail(target.detail);
  if (target.detail !== model.settings.detail) throw new Error(`Detail level not applied: ${target.detail}`);
  if (target.internalSystem !== model.settings.internalSystem) model.setInternalSystem(target.internalSystem);

  const settings = model.settings;
  if (target.hemisphere !== settings.hemisphere) model.setHemisphere(target.hemisphere);
  if (target.cortexVisible !== settings.cortexVisible) model.setCortexVisible(target.cortexVisible);
  if (target.internalVisible !== settings.internalVisible) model.setInternalVisible(target.internalVisible);
  if (target.spinalCordVisible !== settings.spinalCordVisible) {
    await model.setSpinalCordVisible(target.spinalCordVisible);
  }
  if (target.cortexOpacity !== settings.cortexOpacity) model.setCortexOpacity(target.cortexOpacity);
  if (!sameRegions(target.hiddenRegions, model.settings.hiddenRegions)) {
    model.loadHiddenRegions([...target.hiddenRegions]);
  }
  if (target.functionalLevel !== model.settings.functionalLevel) model.setFunctionalLevel(target.functionalLevel);
  if (target.surfaceColor !== model.settings.surfaceColor) await sections.setSurfaceColor(target.surfaceColor);
  if (target.cutAtlas !== sections.state.cutAtlas) await sections.setCutAtlas(target.cutAtlas);
  if (target.cut === 'off') {
    if (sections.active) await sections.setMode('off');
  } else {
    if (target.cut === 'oblique') sections.setAngles(target.cutTilt, target.cutAzimuth);
    await sections.setMode(target.cut);
    sections.setDisplay({ reverse: target.cutReverse });
    sections.setOffset(target.cutOffset);
  }

  if (target.isolatedRegion !== model.settings.isolatedRegion) {
    if (target.isolatedRegion) {
      model.select(target.isolatedRegion);
      model.isolate();
    } else {
      model.clearIsolation();
    }
  }
  if (target.selectedRegion !== (model.state.selectedRegion?.id ?? null)) model.select(target.selectedRegion);
  if (target.selectedRegion) revealInTree(target.selectedRegion);
  applyCamera(target);
}
