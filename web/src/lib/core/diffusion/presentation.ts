import type { SessionState } from '../../types/index.ts';

export function isIndependentTractReference(state: {
  explorer: SessionState['explorer'];
  anatomy?: string | null;
  referenceAnatomy?: string | null;
}): boolean {
  if (state.explorer !== 'diffusion') return false;
  if (!state.anatomy || !state.referenceAnatomy) {
    throw new Error('Tract exploration must identify the anatomy and reference subject.');
  }
  return state.anatomy !== state.referenceAnatomy;
}
