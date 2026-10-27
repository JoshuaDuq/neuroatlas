/** Where a landmark stands in the reader's lesson: the one shown, one already seen, or one ahead. */
export function stepProgress(
  index: number,
  lesson: { step: number; visited: readonly number[] },
): 'current' | 'visited' | 'upcoming' {
  if (index === lesson.step) return 'current';
  return lesson.visited.includes(index) ? 'visited' : 'upcoming';
}

/** Which way a stepper control moves, and whether there is a landmark in that direction. */
export function stepperTargets(
  step: number,
  total: number,
): { previous: number | null; next: number | null } {
  return {
    previous: step > 0 ? step - 1 : null,
    next: step < total - 1 ? step + 1 : null,
  };
}
