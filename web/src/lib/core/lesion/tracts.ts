/** A spherical lesion in RAS millimetres, as far as choosing its bundles reads it. */
interface Sphere {
  centre: readonly [number, number, number];
  radius: number;
}

const SIDE = /-(left|right)$/;
const CALLOSAL_SEGMENT = /^callosum-\d+$/;

/**
 * The bundles a lesion's tracts are counted in: each side the sphere extends into, then the callosal
 * segments. The whole-callosum file is left out: the seven segments cover it at half its download.
 */
export function lesionBundles(bundles: readonly { id: string }[], sphere: Sphere): string[] {
  const [x] = sphere.centre;
  const sides = new Set<string>();
  if (x - sphere.radius < 0) sides.add('left');
  if (x + sphere.radius > 0) sides.add('right');
  const lateral = bundles.filter(({ id }) => sides.has(SIDE.exec(id)?.[1] ?? ''));
  const callosal = bundles.filter(({ id }) => CALLOSAL_SEGMENT.test(id));
  return [...lateral, ...callosal].map(({ id }) => id);
}
