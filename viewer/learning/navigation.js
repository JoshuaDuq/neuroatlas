import { openClinicalRegion } from '../clinical/navigation.js';

export async function openCircuitLandmark(model, sections, step) {
  await openClinicalRegion(model, sections, step.region);
  if (step.covering_region) model.hideRegions([step.covering_region]);
  const region = model.regions.get(step.region);
  model.setHemisphere(region.hemisphere === 'midline' ? 'both' : region.hemisphere);
}

/** Centre the authored MRI plane on this individual's actual landmark. */
export async function prepareCircuitMri(model, sections, step) {
  const centroid = model.centroidOf(step.region);
  if (!Array.isArray(centroid) || centroid.length !== 3 || !centroid.every(Number.isFinite)) {
    throw new Error(`Missing landmark centroid: ${step.region}`);
  }
  sections.setCrosshair(centroid);
  sections.setDisplay({ reverse: false, overlay: true });
  await sections.setMode(step.plane);
}
