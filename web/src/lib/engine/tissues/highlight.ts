/**
 * How far a cut face is lifted toward white when it is pointed at or chosen.
 *
 * A lift rather than an outline: the outline passes draw a silhouette from
 * an unclipped depth render, so on a cut they would ring the whole solid
 * instead of the face, and the cap they would ring is one shared quad.
 */
export const HIGHLIGHT_LIFT = { hovered: 0.26, selected: 0.45 } as const;

/** How far one region's cut face is lifted. Both cut paths read this. */
export function liftFor(
  regionId: string | null | undefined,
  { hovered, selected }: { hovered?: string | null; selected?: string | null } = {},
): number {
  if (!regionId) return 0;
  if (regionId === selected) return HIGHLIGHT_LIFT.selected;
  if (regionId === hovered) return HIGHLIGHT_LIFT.hovered;
  return 0;
}

/** Where in a cut atlas's label table each region is painted from. */
export function codeIndex(labels: readonly { region_id?: string | null }[]): Map<string, number> {
  const codes = new Map<string, number>();
  for (const [code, label] of labels.entries()) {
    if (label.region_id) codes.set(label.region_id, code);
  }
  return codes;
}

/*
 * One definition of the lift, so a sampled cut face and a capped one separate
 * by the same amount. Toward white, never away: the stage is dark, and a face
 * that darkened under the pointer would read as receding from it.
 */
export const HIGHLIGHT_CHUNK = `
  vec3 liftHighlight(vec3 base, float lift) {
    return mix(base, vec3(1.0), lift);
  }`;
