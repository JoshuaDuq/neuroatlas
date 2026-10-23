const EM_DASH = '—';
const MINUS = '−';
/** Between digit groups and before a unit: narrow, and never a line break. */
const NARROW_NBSP = ' ';
const SIGNIFICANT_FIGURES = 4;

/** Group digits the way quantities do, so counts and measurements agree. */
export const grouped = value => {
  const text = String(value);
  return text.length > 4
    ? text.replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP)
    : text;
};

const decimalMark = lang => (lang === 'fr' ? ',' : '.');

/**
 * A number and its unit, held together on one line. English sets a percent sign close up;
 * French, like every other unit, takes the narrow no-break space before it.
 */
export function withUnit(number, unit, lang = 'en') {
  return unit === '%' && lang !== 'fr' ? `${number}%` : `${number}${NARROW_NBSP}${unit}`;
}

/** English adds -es after a sibilant, and -ies for a y after a consonant: two matches, two studies. */
const plural = noun => (/(?:s|x|z|ch|sh)$/.test(noun) ? `${noun}es`
  : /[^aeiou]y$/.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`);

const FRENCH_NOUNS = {
  region: { one: 'région', other: 'régions' },
  match: { one: 'correspondance', other: 'correspondances' },
  label: { one: 'étiquette', other: 'étiquettes' },
  région: { one: 'région', other: 'régions' },
  correspondance: { one: 'correspondance', other: 'correspondances' },
  study: { one: 'étude', other: 'études' },
};

/** A count and its noun, in agreement. "1 regions" is how software looks unfinished. */
export function count(value, noun, lang = 'en') {
  if (lang === 'fr' && FRENCH_NOUNS[noun]) {
    const form = value === 1 ? FRENCH_NOUNS[noun].one : FRENCH_NOUNS[noun].other;
    return `${grouped(value)} ${form}`;
  }
  return `${grouped(value)} ${value === 1 ? noun : plural(noun)}`;
}

/**
 * Render a measured value, as a headline fact: a region's area or volume.
 *
 * Measurements are the reason the atlas exists, so their presentation is
 * fixed rather than left to each call site: four significant figures, grouped
 * digits, the unit held to the number, and an em dash for a value that is
 * absent. An absent quantity is never rendered as zero, because zero is itself
 * a possible measurement. Parts of a table use `decimal` at one fixed place.
 */
export function quantity(value, unit, lang = 'en') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EM_DASH;
  const rounded = value === 0
    ? 0
    : Number(value.toPrecision(SIGNIFICANT_FIGURES));
  const [whole, fraction] = String(rounded).split('.');
  const text = fraction ? `${grouped(whole)}${decimalMark(lang)}${fraction}` : grouped(whole);
  return withUnit(text, unit, lang);
}

/**
 * A number at fixed decimals in the reader's notation: decimal comma in French and a true
 * minus sign. `signed` marks positives with +, as coordinates are; `trim` drops trailing zeros.
 * A value that rounds to zero carries no sign.
 */
export function decimal(value, digits = 1, lang = 'en', { signed = false, trim = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EM_DASH;
  let text = Math.abs(value).toFixed(digits);
  if (trim && text.includes('.')) text = text.replace(/\.?0+$/, '');
  const sign = Number(text) === 0 ? '' : value < 0 ? MINUS : signed ? '+' : '';
  return `${sign}${text.replace('.', decimalMark(lang))}`;
}

/**
 * A point in RAS millimetres: each axis signed, one decimal, true minus sign.
 * French separates the axes with semicolons because its decimal mark is a comma;
 * the no-break space keeps a semicolon from starting a wrapped line.
 */
export function formatRas(values, lang = 'en') {
  if (!Array.isArray(values) || values.length !== 3
      || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) return EM_DASH;
  const axes = values.map(value => decimal(value, 1, lang, { signed: true }));
  const separator = lang === 'fr' ? `${NARROW_NBSP}; ` : ', ';
  return withUnit(axes.join(separator), 'mm', lang);
}

/** A signed coordinate along one axis, as slider readouts and their spoken values give it. */
export function millimetres(value, lang = 'en') {
  return withUnit(decimal(value, 1, lang, { signed: true }), 'mm', lang);
}

/** A fraction as a whole percentage. */
export function percent(fraction, lang = 'en') {
  return withUnit(decimal(fraction * 100, 0, lang), '%', lang);
}
