import { belongsToDetail } from '../catalog/visibility.js';

const commonestAtlas = regions => {
  const counts = new Map();
  for (const region of regions) counts.set(region.atlas, (counts.get(region.atlas) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
};

function clinicalRegions(model, ids) {
  return ids.map(id => {
    const region = model.regions.get(id);
    if (!region || !['cortex', 'structure'].includes(region.kind)) {
      throw new Error(`Unknown clinical region: ${id}`);
    }
    return region;
  });
}

/**
 * The layers that draw cited landmarks together. Only one detail level is
 * drawn at a time, so structures mapped in another level stay undrawn; the
 * level holding most of them wins. A layer is null when the loaded one already
 * draws some of them.
 */
export function clinicalLayers(model, ids) {
  const regions = clinicalRegions(model, ids);
  const cortical = regions.filter(region => region.kind === 'cortex');
  const structures = regions.filter(region => region.kind === 'structure');
  return {
    atlas: cortical.length && !cortical.some(region => region.atlas === model.settings.atlas)
      ? commonestAtlas(cortical) : null,
    detail: structures.length && !structures.some(region => belongsToDetail(region, model.settings.detail))
      ? commonestAtlas(structures) : null,
  };
}

/** Show cited landmarks together on their loaded layers, with nothing isolating or hiding them. */
export function showClinicalRegions(model, ids) {
  const regions = clinicalRegions(model, ids);
  if (!regions.length) return;
  const cortical = regions.some(region => region.kind === 'cortex');
  const structures = regions.some(region => region.kind === 'structure');
  model.clearIsolation();
  model.setInternalSystem(null);
  model.setHemisphere('both');
  model.setCortexVisible(cortical);
  if (cortical && model.settings.cortexOpacity === 0) model.setCortexOpacity(1);
  if (structures) model.setInternalVisible(true);
  model.showRegions(ids);
}
