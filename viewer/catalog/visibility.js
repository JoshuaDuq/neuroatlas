/**
 * Where a region's geometry lives, and therefore what can hide it.
 *
 * Cortical patches and the two unlabelled medial surfaces live in a per-atlas
 * surface layer. Structures live in one shared mesh layer. A tissue region has
 * no mesh at all: it is drawn only where the cut plane samples its label
 * volume, so the surface atlas and the cortex controls cannot hide it, and
 * with no cut on screen it is nowhere at all.
 */
const isSurface = region => region.kind === 'cortex' || region.kind === 'non-region';
const isTissue = region => region.kind === 'tissue-region';

const hemisphereAllows = (region, settings) =>
  settings.hemisphere === 'both' ||
  region.hemisphere === 'midline' ||
  region.hemisphere === settings.hemisphere;

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
  if (isTissue(region)) {
    // A distinct reason from 'other-atlas': the remedy is a different control.
    if (region.atlas !== settings.cutAtlas) return hidden('other-cut-atlas');
    if (!settings.cutActive) return hidden('no-cut');
  } else if (isSurface(region) && region.atlas !== settings.atlas) {
    return hidden('other-atlas');
  }
  if (!hemisphereAllows(region, settings)) return hidden('hemisphere');
  if (isSurface(region) && !(settings.cortexVisible && settings.cortexOpacity > 0)) {
    return hidden('cortex-hidden');
  }
  if (settings.isolatedRegion && region.id !== settings.isolatedRegion) {
    return hidden('isolated');
  }
  return { visible: true, reason: null };
}
