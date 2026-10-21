import { decimal } from '../format.js';

export function overlapArea(area, lang = 'en') {
  const value = area > 0 && area < 0.1 ? `<${decimal(0.1, 1, lang)}` : decimal(area, 1, lang);
  return `${value}\u2009mm²`;
}

export function overlapShare(fraction, lang = 'en') {
  const percent = fraction * 100;
  const value = percent > 0 && percent < 0.1
    ? `<${decimal(0.1, 1, lang)}` : decimal(percent, 1, lang);
  return `${value}${lang === 'fr' ? '\u202f' : ''}%`;
}
