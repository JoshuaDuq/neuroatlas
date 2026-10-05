const THIN_SPACE = ' ';
const EM_DASH = '—';
const MINUS = '\u2212';
const NARROW_NBSP = '\u202f';
const SIGNIFICANT_FIGURES = 4;

/** Group digits the way quantities do, so counts and measurements agree. */
const grouped = value => {
  const text = String(value);
  return text.length > 4
    ? text.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE)
    : text;
};

const decimalMark = lang => (lang === 'fr' ? ',' : '.');

/** English adds -es after a sibilant: one match, two matches. */
const plural = noun => (/(?:s|x|z|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`);

const FRENCH_NOUNS = {
  region: { one: 'région', other: 'régions' },
  match: { one: 'correspondance', other: 'correspondances' },
  label: { one: 'étiquette', other: 'étiquettes' },
  région: { one: 'région', other: 'régions' },
  correspondance: { one: 'correspondance', other: 'correspondances' },
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
 * Render a measured value.
 *
 * Measurements are the reason the atlas exists, so their presentation is
 * fixed rather than left to each call site: four significant figures, a thin
 * space before the unit and between digit groups, and an em dash for a value
 * that is absent. An absent quantity is never rendered as zero, because zero
 * is itself a possible measurement.
 */
export function quantity(value, unit, lang = 'en') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EM_DASH;
  const rounded = value === 0
    ? 0
    : Number(value.toPrecision(SIGNIFICANT_FIGURES));
  const [whole, fraction] = String(rounded).split('.');
  const text = fraction ? `${grouped(whole)}${decimalMark(lang)}${fraction}` : grouped(whole);
  return `${text}${THIN_SPACE}${unit}`;
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
 * French separates the axes with semicolons because its decimal mark is a comma.
 * The no-break spaces keep a unit or a semicolon from starting a wrapped line.
 */
export function formatRas(values, lang = 'en') {
  if (!Array.isArray(values) || values.length !== 3
      || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) return EM_DASH;
  const axes = values.map(value => decimal(value, 1, lang, { signed: true }));
  const separator = lang === 'fr' ? `${NARROW_NBSP}; ` : ', ';
  return `${axes.join(separator)}${NARROW_NBSP}mm`;
}
