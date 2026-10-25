/**
 * Entering internal anatomy hides the cortex, forces region colouring and
 * switches the detail level. Leaving has to give those back, or the entry is a
 * trapdoor: one click in, four controls across three panels out.
 *
 * Free of the DOM and of Three.js, so all of it is unit tested.
 */
import type { DisplaySettings, SurfaceColor } from '../../types/index.ts';

const WHOLE_BRAIN_COLOUR = 'atlas';

/** What entering overwrites, kept to give back on leaving. */
export interface InternalEntry {
  surfaceColor: SurfaceColor;
  detail: string;
  appliedDetail: string;
}

/** The cortex being hidden is what makes the reader "inside": nothing else marks it. */
export const insideInternal = (state: Pick<DisplaySettings, 'cortexVisible'>): boolean =>
  state.cortexVisible === false;

/** What entering is about to overwrite, alongside the level it is about to apply. */
export function captureBeforeInternal(
  state: Pick<DisplaySettings, 'surfaceColor' | 'detail'>,
  applyingDetail: string,
): InternalEntry {
  return {
    surfaceColor: state.surfaceColor,
    detail: state.detail,
    appliedDetail: applyingDetail,
  };
}

/**
 * The model changes that put the whole brain back. A `detail` of null means
 * leave the level alone — either the reader picked it themselves while inside,
 * or it is already the one to return to.
 *
 * `requiredAtlas` maps a colouring to the atlas whose areas it colours. If the
 * reader has since switched away from that atlas, the switch wins, as it does
 * in the masthead: region colours return and `colourLost` names the colouring.
 *
 * Hemisphere, cortex opacity and the selection are absent on purpose: entering
 * never touched them, so leaving has no claim on them either.
 */
export function leaveInternal(
  before: InternalEntry | null | undefined,
  state: Pick<DisplaySettings, 'detail' | 'atlas'>,
  requiredAtlas: Partial<Record<string, string | null | undefined>> = {},
) {
  const untouched = before && state.detail === before.appliedDetail;
  const colour = before?.surfaceColor ?? WHOLE_BRAIN_COLOUR;
  const lost = Boolean(requiredAtlas[colour]) && requiredAtlas[colour] !== state.atlas;
  return {
    cortexVisible: true,
    surfaceColor: lost ? WHOLE_BRAIN_COLOUR : colour,
    colourLost: lost ? colour : null,
    detail: untouched && before.detail !== state.detail ? before.detail : null,
    internalSystem: null,
  };
}
