import type { Region } from '../../types/index.ts';

/**
 * How often NextBrain nearly tied each pair of touching labels in this brain
 * (`manifest.boundary_certainty` file): the model's competition between its own
 * labels, not agreement with another segmentation.
 */
export interface BoundaryCertainty {
  id: 'boundary-certainty';
  atlas: string;
  /** A near tie: the two most probable labels within this posterior of each other. */
  near_tie_margin: number;
  voxel_spacing_mm: number;
  /** [region id, region id, interface voxels, near-tie voxels], one per rated pair. */
  pairs: [string, string, number, number][];
}

/** A boundary nearly tied on at least this share of its interface is drawn and listed as soft. */
export const SOFT_SHARE = 1 / 3;

/** One rated boundary of a region, seen from that region. */
export interface Boundary {
  neighbour: string;
  voxels: number;
  share: number;
  soft: boolean;
}

/** The published ratings, checked against the regions they name. */
export function validateBoundaryCertainty(
  certainty: BoundaryCertainty,
  regions: ReadonlyMap<string, Region>,
): BoundaryCertainty {
  if (
    certainty?.id !== 'boundary-certainty' ||
    !(certainty.near_tie_margin > 0 && certainty.near_tie_margin < 1) ||
    !(certainty.voxel_spacing_mm > 0) ||
    !Array.isArray(certainty.pairs)
  ) {
    throw new Error('Invalid boundary certainty.');
  }
  const seen = new Set<string>();
  for (const [a, b, voxels, near] of certainty.pairs) {
    const left = regions.get(a);
    const right = regions.get(b);
    if (
      left?.atlas !== certainty.atlas ||
      right?.atlas !== certainty.atlas ||
      a === b ||
      left.hemisphere !== right.hemisphere ||
      !Number.isInteger(voxels) ||
      !Number.isInteger(near) ||
      voxels <= 0 ||
      near < 0 ||
      near > voxels
    ) {
      throw new Error(`Invalid boundary rating: ${a}, ${b}`);
    }
    const key = [a, b].sort().join(' ');
    if (seen.has(key)) throw new Error(`Boundary rated twice: ${a}, ${b}`);
    seen.add(key);
  }
  return certainty;
}

/** A region's rated boundaries, the largest interface first. */
export function boundariesOf(certainty: BoundaryCertainty | null, regionId: string): Boundary[] {
  if (!certainty) return [];
  return certainty.pairs
    .filter(([a, b]) => a === regionId || b === regionId)
    .map(([a, b, voxels, near]) => {
      const share = near / voxels;
      return { neighbour: a === regionId ? b : a, voxels, share, soft: share >= SOFT_SHARE };
    })
    .sort((x, y) => y.voxels - x.voxels);
}

/** Near-tie share over all of a region's rated boundaries, weighted by interface size. */
export function overallShare(boundaries: readonly Boundary[]): number {
  const voxels = boundaries.reduce((sum, boundary) => sum + boundary.voxels, 0);
  if (!voxels) throw new Error('A region with no rated boundary has no overall share.');
  return boundaries.reduce((sum, boundary) => sum + boundary.share * boundary.voxels, 0) / voxels;
}
