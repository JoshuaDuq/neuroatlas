const THIN_SPACE = ' ';
const EM_DASH = '—';
const SIGNIFICANT_FIGURES = 4;

/** Group digits the way quantities do, so counts and measurements agree. */
const grouped = value => {
  const text = String(value);
  return text.length > 4
    ? text.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE)
    : text;
};

/** English adds -es after a sibilant: one match, two matches. */
const plural = noun => (/(?:s|x|z|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`);

const FRENCH_NOUNS = {
  region: { one: 'région', other: 'régions' },
  match: { one: 'correspondance', other: 'correspondances' },
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
export function quantity(value, unit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EM_DASH;
  const rounded = value === 0
    ? 0
    : Number(value.toPrecision(SIGNIFICANT_FIGURES));
  const [whole, fraction] = String(rounded).split('.');
  const text = fraction ? `${grouped(whole)}.${fraction}` : grouped(whole);
  return `${text}${THIN_SPACE}${unit}`;
}
