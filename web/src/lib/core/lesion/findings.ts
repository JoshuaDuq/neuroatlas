import type { Paint, Rgb } from '../../types/index.ts';
import { FINDING_COLORS } from '../clinical/catalog.ts';

/** A finding whose most-reached cited region is less than this share inside the lesion is folded away. */
export const SLIGHT_SHARE = 0.01;

type Side = 'left' | 'right';

interface Finding {
  id: string;
  laterality: 'left' | 'right' | 'bilateral';
  mappings: readonly { region: string }[];
}

export interface Reach {
  region: string;
  /** mm³ of the region inside the lesion, and the region's whole size. */
  inside: number;
  whole: number;
  share: number;
}

export interface RankedFinding<F extends Finding = Finding> {
  association: F;
  /** The cited regions the lesion reaches, largest share first. */
  reached: Reach[];
  /** How many regions the finding cites in all. */
  cited: number;
  /** The largest share of a cited region inside the lesion. */
  share: number;
  /** A bilateral finding the lesion reaches on this side only; null otherwise. */
  oneSide: Side | null;
}

const sideOf = (region: string): string => region.split(':')[1]!;

/**
 * The findings that cite a region the lesion reaches, ranked by how much of a cited region lies
 * inside it. Overlap with a cited region is all this says: it predicts no deficit.
 */
export function rankFindings<F extends Finding>(
  associations: readonly F[],
  regions: ReadonlyMap<string, { inside: number; whole: number }>,
): { shown: RankedFinding<F>[]; slight: RankedFinding<F>[] } {
  const ranked: RankedFinding<F>[] = [];
  for (const association of associations) {
    const reached = association.mappings
      .flatMap(({ region }) => {
        const measured = regions.get(region);
        return measured ? [{ region, ...measured, share: measured.inside / measured.whole }] : [];
      })
      .sort((a, b) => b.share - a.share);
    if (!reached.length) continue;
    const sides = new Set(reached.map((reach) => sideOf(reach.region)));
    const oneSide =
      association.laterality === 'bilateral' && sides.size === 1 ? ([...sides][0] as Side) : null;
    ranked.push({
      association,
      reached,
      cited: association.mappings.length,
      share: reached[0]!.share,
      oneSide,
    });
  }
  ranked.sort((a, b) => b.share - a.share);
  return {
    shown: ranked.filter((row) => row.share >= SLIGHT_SHARE),
    slight: ranked.filter((row) => row.share < SLIGHT_SHARE),
  };
}

/**
 * The shown findings on the brain, as the Deficits view paints one deficit: the leading findings take
 * the finding colours in rank order, and each region the colour of the first one that cites it. The
 * findings past the palette are listed uncoloured. `key` names the placement, so a new one repaints.
 */
export function findingsPaint<F extends Finding>(
  shown: readonly RankedFinding<F>[],
  key: string,
): { findings: { finding: RankedFinding<F>; color: Rgb | null }[]; paint: Paint } {
  const colors = new Map<string, Rgb>();
  const findings = shown.map((finding, index) => {
    const color = FINDING_COLORS[index] ?? null;
    if (color) {
      for (const { region } of finding.association.mappings)
        if (!colors.has(region)) colors.set(region, color);
    }
    return { finding, color };
  });
  return { findings, paint: { id: `lesion:${key}`, colors } };
}
