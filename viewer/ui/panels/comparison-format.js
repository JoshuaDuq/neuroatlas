import { decimal } from '../format.js';

/**
 * Table figures at one decimal, bare: the column heads carry the units. A positive part too
 * small to show is "<0.1", never zero.
 */
const part = (value, lang) => (value > 0 && value < 0.1 ? `<${decimal(0.1, 1, lang)}` : decimal(value, 1, lang));

export function overlapArea(area, lang = 'en') {
  return part(area, lang);
}

export function overlapShare(fraction, lang = 'en') {
  return part(fraction * 100, lang);
}
