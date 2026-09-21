import { labelOf } from './labels.js';

/**
 * Where a region's geometry lives, and therefore what can hide it.
 *
 * Cortical patches and the two unlabelled medial surfaces live in a per-atlas
 * surface layer. Structures live in a detail level — two segmentations of the
 * same internal anatomy, of which exactly one is drawn. A tissue region has no
 * mesh at all: it is drawn only where the cut plane samples its label volume,
 * so the surface atlas and the cortex controls cannot hide it, and with no cut
 * on screen it is nowhere at all.
 */
const isSurface = region => region.kind === 'cortex' || region.kind === 'non-region';
const isStructure = region => region.kind === 'structure';
const isTissue = region => region.kind === 'tissue-region';
export const belongsToDetail = (region, detail) => region.supplemental === true || region.atlas === detail;
// Gyral white matter is drawn on the white envelope's cut face, which the cortex controls hide.
const followsCortex = region => isSurface(region) || region.atlas === 'wmparc';

/** The cut atlases whose cuts draw a cut-only region. */
export const cutAtlasesOf = region => region.cut_atlases ?? [region.atlas];

const hemisphereAllows = (region, settings) =>
  settings.hemisphere === 'both' ||
  region.hemisphere === 'midline' ||
  region.hemisphere === settings.hemisphere;

/** The overview's source constituents inherit its system, irrespective of atlas taxonomy. */
export function internalSystemAllows(region, settings) {
  if (!settings.internalSystem || isSurface(region)) return true;
  if (settings.detail === 'learning' && region.atlas !== 'learning' && !region.supplemental) {
    return settings.internalConstituents.has(region.id);
  }
  return labelOf(region, 'en').group === settings.internalSystem;
}

/**
 * Whether a region is currently on screen, and if not, why.
 *
 * The single source of truth for that question. The model applies it to
 * meshes; the navigator uses `reason` to explain an absence instead of
 * silently omitting the row. Two implementations would drift, and the drift
 * would be invisible.
 */
export function visibilityOf(region, settings) {
  const hidden = reason => ({ visible: false, reason });
  if (settings.surfaceColor === 'mri' && region.mri_registered === false) return hidden('no-mri');
  // A region can be drawn as geometry, as a cut label, or both. A structure the
  // inactive detail level owns is still on screen while the cut is painting it.
  const onCut = region.atlas === settings.cutAtlas && settings.cutActive;
  if (isTissue(region)) {
    // Distinct reasons from 'other-atlas': the remedy is a different control.
    if (!cutAtlasesOf(region).includes(settings.cutAtlas)) return hidden('other-cut-atlas');
    if (!settings.cutActive) return hidden('no-cut');
  } else if (isStructure(region)) {
    if (!belongsToDetail(region, settings.detail) && !onCut) return hidden('other-detail');
  } else if (isSurface(region) && region.atlas !== settings.atlas) {
    return hidden('other-atlas');
  }
  if (!internalSystemAllows(region, settings)) return hidden('other-system');
  if (!hemisphereAllows(region, settings)) return hidden('hemisphere');
  if (followsCortex(region) && !(settings.cortexVisible && settings.cortexOpacity > 0)) {
    return hidden('cortex-hidden');
  }
  if (isStructure(region) && settings.internalVisible === false) {
    return hidden('internal-hidden');
  }
  if (region.atlas === 'zanatomy' && settings.spinalCordVisible === false) {
    return hidden('spinal-cord-hidden');
  }
  if (settings.isolatedRegion && region.id !== settings.isolatedRegion) {
    return hidden('isolated');
  }
  return { visible: true, reason: null };
}
