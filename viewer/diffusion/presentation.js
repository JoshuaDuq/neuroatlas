export function isIndependentTractReference(state) {
  if (state.explorer !== 'diffusion') return false;
  if (!state.anatomy || !state.referenceAnatomy) {
    throw new Error('Tract exploration must identify the anatomy and reference subject.');
  }
  return state.anatomy !== state.referenceAnatomy;
}
