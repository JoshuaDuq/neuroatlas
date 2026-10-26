// What the Circuits panel says, as plain data (viewer/ui/panels/circuits.js:150-165, 229-257). The
// components only draw it. `stepProgress` and `stepperTargets` are C5's (lib/core/panels/circuits.ts).
import type { Circuit } from '../../lib/core/learning/catalog.ts';

/** The list's foot line counts landmarks as the rows count them: the sum of every circuit's steps. */
export function landmarkTotal(circuits: readonly Pick<Circuit, 'steps'>[]): number {
  return circuits.reduce((total, circuit) => total + circuit.steps.length, 0);
}

/** One landmark of a circuit, by its place in that circuit. */
export interface RelatedLandmark {
  circuit: Circuit;
  index: number;
}

/**
 * Outside a lesson, a region that is, holds or lies in a landmark links to that step of each
 * circuit. `regions` is the region with what holds or contains it (`involved`).
 */
export function relatedLandmarks(
  circuits: readonly Circuit[],
  regions: ReadonlySet<string>,
): RelatedLandmark[] {
  return circuits.flatMap((circuit) =>
    circuit.steps.flatMap((step, index) => (regions.has(step.region) ? [{ circuit, index }] : [])),
  );
}
