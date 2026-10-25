import type { Landmark } from '../../core/learning/catalog.ts';
import type { EngineModel, EngineSections } from '../../engine/api.ts';

/** Once the landmark is drawn and selected: uncover it and show its own side. */
export function showCircuitLandmark(
  model: Pick<EngineModel, 'regions' | 'showRegions' | 'hideRegions' | 'setHemisphere'>,
  step: Pick<Landmark, 'region' | 'restores' | 'covering_regions'>,
): void {
  if (step.restores.length) model.showRegions(step.restores);
  if (step.covering_regions) model.hideRegions(step.covering_regions);
  const region = model.regions.get(step.region);
  if (!region) throw new Error(`Unknown landmark region: ${step.region}`);
  model.setHemisphere(region.hemisphere === 'midline' ? 'both' : region.hemisphere);
}

/** Centre the authored MRI plane on this individual's actual landmark. */
export async function prepareCircuitMri(
  model: Pick<EngineModel, 'centroidOf'>,
  sections: Pick<EngineSections, 'setCrosshair' | 'setDisplay' | 'setMode'>,
  step: Pick<Landmark, 'region' | 'plane'>,
): Promise<void> {
  const centroid = model.centroidOf(step.region);
  if (!centroid || centroid.length !== 3 || !centroid.every(Number.isFinite)) {
    throw new Error(`Missing landmark centroid: ${step.region}`);
  }
  sections.setCrosshair(centroid);
  sections.setDisplay({ reverse: false, overlay: true });
  await sections.setMode(step.plane);
}
