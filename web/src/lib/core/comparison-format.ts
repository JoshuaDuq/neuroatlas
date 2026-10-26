import type { Language } from '../types/index.ts';
import { decimal } from './format.ts';

/**
 * Table figures at one decimal, bare: the column heads carry the units. A positive part too
 * small to show is "<0.1", never zero.
 */
const part = (value: number, lang: Language) =>
  value > 0 && value < 0.1 ? `<${decimal(0.1, 1, lang)}` : decimal(value, 1, lang);

export const overlapArea = (area: number, lang: Language = 'en'): string => part(area, lang);

export const overlapShare = (fraction: number, lang: Language = 'en'): string =>
  part(fraction * 100, lang);
