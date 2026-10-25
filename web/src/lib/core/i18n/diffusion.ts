import type { Language } from '../../types/index.ts';
import { decimal, formatRas } from '../format.ts';
import * as diffusionText from './areas/diffusion.ts';
import { t } from './index.ts';

/** The stable codes a diffusion-panel failure is shown by; the English detail stays in the console. */
export type DiffusionErrorCode = keyof typeof diffusionText.en.errors;

/**
 * The words for a failure's code. The legacy `diffusionError(lang, error)` also derived the code
 * from the error (diffusion/translations.js:63): an AssetError's own code, `invalid-data` for a
 * DiffusionInputError, `failed` for anything else. That belongs with the error classes (T2).
 */
export const diffusionError = (lang: string, code: DiffusionErrorCode): string =>
  t(lang, 'diffusion').errors[code];

/**
 * The MRI crosshair as the house writes a point, signed RAS, then the T1 and FA samples under it.
 * `fa` is undefined for a dataset that publishes no FA map.
 */
export function mriReadout(
  mm: readonly number[],
  t1: number,
  fa: number | undefined,
  lang: Language,
): string {
  // French sets a narrow no-break space before a colon; a label never wraps away from its value.
  const colon = lang === 'fr' ? '\u202f:\u00a0' : ':\u00a0';
  const readout = `RAS${colon}${formatRas(mm, lang)} · T1${colon}${decimal(t1, 0, lang)}`;
  return fa === undefined ? readout : `${readout} · FA${colon}${decimal(fa, 2, lang)}`;
}
