import type { Region } from '../../types/index.ts';
import type { EngineModel } from '../../engine/api.ts';
import { belongsToDetail } from '../catalog/visibility.ts';

/** What navigation reads of the model, and the commands it gives. */
export type NavigationModel = Pick<EngineModel, 'regions' | 'settings'>;
export type ShowingModel = NavigationModel &
  Pick<
    EngineModel,
    | 'clearIsolation'
    | 'setInternalSystem'
    | 'setHemisphere'
    | 'setCortexVisible'
    | 'setCortexOpacity'
    | 'setInternalVisible'
    | 'showRegions'
  >;

const commonestAtlas = (regions: readonly Region[]) => {
  const counts = new Map<string, number>();
  for (const region of regions) counts.set(region.atlas!, (counts.get(region.atlas!) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
};

function clinicalRegions(model: NavigationModel, ids: readonly string[]): Region[] {
  return ids.map((id) => {
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
export function clinicalLayers(
  model: NavigationModel,
  ids: readonly string[],
): { atlas: string | null; detail: string | null } {
  const regions = clinicalRegions(model, ids);
  const cortical = regions.filter((region) => region.kind === 'cortex');
  const structures = regions.filter((region) => region.kind === 'structure');
  return {
    atlas:
      cortical.length && !cortical.some((region) => region.atlas === model.settings.atlas)
        ? commonestAtlas(cortical)
        : null,
    detail:
      structures.length &&
      !structures.some((region) => belongsToDetail(region, model.settings.detail))
        ? commonestAtlas(structures)
        : null,
  };
}

/** Show cited landmarks together on their loaded layers, with nothing isolating or hiding them. */
export function showClinicalRegions(model: ShowingModel, ids: readonly string[]): void {
  const regions = clinicalRegions(model, ids);
  if (!regions.length) return;
  const cortical = regions.some((region) => region.kind === 'cortex');
  const structures = regions.some((region) => region.kind === 'structure');
  model.clearIsolation();
  model.setInternalSystem(null);
  model.setHemisphere('both');
  model.setCortexVisible(cortical);
  if (cortical && model.settings.cortexOpacity === 0) model.setCortexOpacity(1);
  if (structures) model.setInternalVisible(true);
  model.showRegions(ids);
}
