import { MediaQuery } from 'svelte/reactivity';
import { COARSE_POINTER_QUERY, PHONE_QUERY } from '../types/index.ts';

/**
 * A phone held sideways: the side sheet rather than the bottom sheet
 * (ui/chrome/sheet.js:37). The phone query includes it; a narrow, taller landscape
 * window is phone-width without being sideways.
 */
export const SIDEWAYS_QUERY = '(max-height: 480px) and (orientation: landscape)';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * What kind of device is reading this, asked in one place and kept live: each getter
 * re-evaluates when the viewport, the pointer or the motion preference changes.
 */
export function createMedia() {
  const phone = new MediaQuery(PHONE_QUERY);
  const sideways = new MediaQuery(SIDEWAYS_QUERY);
  const coarse = new MediaQuery(COARSE_POINTER_QUERY);
  const reducedMotion = new MediaQuery(REDUCED_MOTION_QUERY);
  return {
    /** The compact interface (`PHONE_QUERY`): phones, tablets and narrow windows. */
    get phone() {
      return phone.current;
    },
    get sideways() {
      return sideways.current;
    },
    /** A finger rather than a mouse; drives hit-target size. */
    get coarsePointer() {
      return coarse.current;
    },
    get reducedMotion() {
      return reducedMotion.current;
    },
  };
}

export type Media = ReturnType<typeof createMedia>;
