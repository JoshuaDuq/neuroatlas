import { belongsToDetail } from '../catalog/visibility.js';

const commonestAtlas = regions => {
  const counts = new Map();
  for (const region of regions) counts.set(region.atlas, (counts.get(region.atlas) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
};

/**
 * Draw cited landmarks together without inheriting a misleading cut. Only one
 * detail level is drawn at a time, so structures mapped in another level stay
 * undrawn; the level holding most of them wins.
 */
export async function revealClinicalRegions(model, sections, ids) {
  const regions = ids.map(id => {
    const region = model.regions.get(id);
    if (!region || !['cortex', 'structure'].includes(region.kind)) {
      throw new Error(`Unknown clinical region: ${id}`);
    }
    return region;
  });
  if (!regions.length) return;
  const cortical = regions.filter(region => region.kind === 'cortex');
  const structures = regions.filter(region => region.kind === 'structure');
  if (cortical.length && !cortical.some(region => region.atlas === model.settings.atlas)) {
    await model.setAtlas(commonestAtlas(cortical));
  }
  if (structures.length && !structures.some(region => belongsToDetail(region, model.settings.detail))) {
    await model.setDetail(commonestAtlas(structures));
  }
  await sections.setMode('off');
  model.clearIsolation();
  model.setInternalSystem(null);
  model.setHemisphere('both');
  model.setCortexVisible(cortical.length > 0);
  if (cortical.length && model.settings.cortexOpacity === 0) model.setCortexOpacity(1);
  if (structures.length) model.setInternalVisible(true);
  model.showRegions(ids);
}

/** Reveal the cited anatomical landmark without inheriting a misleading cut. */
export async function openClinicalRegion(model, sections, id) {
  await revealClinicalRegions(model, sections, [id]);
  model.select(id);
}
