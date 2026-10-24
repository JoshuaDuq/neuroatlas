/** Once the landmark is drawn and selected: uncover it and show its own side. */
export function showCircuitLandmark(model, step) {
  if (step.restores.length) model.showRegions(step.restores);
  if (step.covering_regions) model.hideRegions(step.covering_regions);
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
