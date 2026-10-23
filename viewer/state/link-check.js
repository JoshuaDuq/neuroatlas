import { PARAMS } from './url-state.js';

/**
 * What a decoded link names, judged against what this anatomy publishes.
 * `known` lists the ids on offer; a field naming anything else is dropped and
 * its link parameter returned in `rejected`, so the reader can be told.
 */
export function checkLink(link, known) {
  const state = { ...link };
  const rejected = [];
  const reject = key => {
    delete state[key];
    rejected.push(PARAMS[key]);
  };
  const region = id => {
    const record = known.regions.get(id);
    return Boolean(record) && record.kind !== 'non-region';
  };
  const checks = {
    atlas: id => known.atlases.has(id),
    detail: id => known.details.has(id),
    cutAtlas: id => known.cutAtlases.has(id),
    view: id => known.views.has(id),
    surfaceColor: id => known.surfaceColors.has(id),
    explorer: id => known.explorers.has(id),
    selectedRegion: region,
    isolatedRegion: region,
    hiddenRegions: ids => ids.every(id => known.regions.has(id)),
    selectedFunction: id => known.functions.has(id),
    selectedDeficit: id => known.deficits.has(id),
    circuit: id => known.circuits.has(id),
  };
  for (const [key, valid] of Object.entries(checks)) {
    if (key in state && !valid(state[key])) reject(key);
  }
  if ('circuitStep' in state && !(state.circuitStep < (known.circuits.get(state.circuit) ?? 0))) {
    reject('circuitStep');
  }
  if (state.spinalCordVisible && !known.spinalCord) reject('spinalCordVisible');
  return { state, rejected };
}
