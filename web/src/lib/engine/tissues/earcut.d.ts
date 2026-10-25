// Types for the vendored earcut 2.2.4 (earcut.js), which stays untouched.

/** Triangulates a polygon with holes; returns indices into `data`'s vertices, three per triangle. */
export function earcut(
  data: ArrayLike<number>,
  holeIndices?: ArrayLike<number> | null,
  dim?: number,
): number[];

export namespace earcut {
  /** The relative difference between the polygon's area and its triangles'. */
  function deviation(
    data: ArrayLike<number>,
    holeIndices: ArrayLike<number> | null | undefined,
    dim: number,
    triangles: ArrayLike<number>,
  ): number;
}
