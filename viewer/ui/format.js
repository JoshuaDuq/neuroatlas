const THIN_SPACE = ' ';
const EM_DASH = '—';
const SIGNIFICANT_FIGURES = 4;

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
  const grouped = whole.length > 4
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE)
    : whole;
  const text = fraction ? `${grouped}.${fraction}` : grouped;
  return `${text}${THIN_SPACE}${unit}`;
}
