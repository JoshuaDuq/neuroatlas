/** Cortical patches live in a per-atlas layer; structures live in a shared one. */
const isCortical = region => region.kind !== 'structure';

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
  if (isCortical(region) && region.atlas !== settings.atlas) return hidden('other-atlas');
  if (!hemisphereAllows(region, settings)) return hidden('hemisphere');
  if (isCortical(region) && !(settings.cortexVisible && settings.cortexOpacity > 0)) {
    return hidden('cortex-hidden');
  }
  if (settings.isolatedRegion && region.id !== settings.isolatedRegion) {
    return hidden('isolated');
  }
  return { visible: true, reason: null };
}
