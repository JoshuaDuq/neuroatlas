import { belongsToDetail } from '../catalog/visibility.js';

/** Reveal the cited anatomical landmark without inheriting a misleading cut. */
export async function openClinicalRegion(model, sections, id) {
  const region = model.regions.get(id);
  if (!region || !['cortex', 'structure'].includes(region.kind)) {
    throw new Error(`Unknown clinical region: ${id}`);
  }
  if (region.kind === 'cortex' && model.settings.atlas !== region.atlas) {
    await model.setAtlas(region.atlas);
  }
  if (region.kind === 'structure' && !belongsToDetail(region, model.settings.detail)) {
    await model.setDetail(region.atlas);
  }
  await sections.setMode('off');
  model.clearIsolation();
  model.setInternalSystem(null);
  model.setHemisphere('both');
  model.setCortexVisible(region.kind === 'cortex');
  if (region.kind === 'cortex' && model.settings.cortexOpacity === 0) {
    model.setCortexOpacity(1);
  }
  model.select(id);
}
