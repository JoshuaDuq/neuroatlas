/**
 * Entering internal anatomy hides the cortex, forces region colouring and
 * switches the detail level. Leaving has to give those back, or the entry is a
 * trapdoor: one click in, four controls across three panels out.
 *
 * Free of the DOM and of Three.js, so all of it is unit tested.
 */

const WHOLE_BRAIN_COLOUR = 'atlas';

/** The cortex being hidden is what makes the reader "inside": nothing else marks it. */
export const insideInternal = state => state.cortexVisible === false;

/** What entering is about to overwrite, alongside the level it is about to apply. */
export function captureBeforeInternal(state, applyingDetail) {
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
 * Hemisphere, cortex opacity and the selection are absent on purpose: entering
 * never touched them, so leaving has no claim on them either.
 */
export function leaveInternal(before, state) {
  const untouched = before && state.detail === before.appliedDetail;
  return {
    cortexVisible: true,
    surfaceColor: before?.surfaceColor ?? WHOLE_BRAIN_COLOUR,
    detail: untouched && before.detail !== state.detail ? before.detail : null,
    internalSystem: null,
  };
}
