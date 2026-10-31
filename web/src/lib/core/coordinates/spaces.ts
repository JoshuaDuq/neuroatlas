import type { CoordinateField, CoordinateSpace, CoordinateSpaces } from '../../types/index.ts';
import { loadField } from './field.ts';
import type { Field } from './field.ts';
import type { Coordinate } from './parse.ts';

/** The choice for a coordinate whose paper names MNI but not the template. */
export const UNSTATED = 'unstated';

/** The published template a coordinate given in `space` is read in. */
export function readIn(metadata: CoordinateSpaces, space: string): CoordinateSpace {
  const id = space === UNSTATED ? metadata.unstated.reads_as : space;
  const record = metadata.spaces.find((entry) => entry.id === id);
  if (!record) throw new RangeError(`Unknown coordinate space: ${space}`);
  return record;
}

/**
 * The anatomy's published coordinate spaces: each template's field downloaded once, when a coordinate
 * in it is first placed, and a coordinate in a template not stated read as `unstated.reads_as`.
 */
export function createCoordinateSpaces(
  metadata: CoordinateSpaces,
  baseUrl: string | URL,
  load: (record: CoordinateField, baseUrl: string | URL) => Promise<Field> = loadField,
) {
  const { radius_mm: radius, spaces, unstated } = metadata;
  if (!(Number.isFinite(radius) && radius > 0)) {
    throw new Error(`A coordinate's sphere needs a positive radius, not ${radius}.`);
  }
  const ids = spaces.map(({ id }) => id);
  if (!ids.length || new Set(ids).size !== ids.length || ids.includes(UNSTATED)) {
    throw new Error('The published coordinate spaces need distinct ids.');
  }
  if (!ids.includes(unstated.reads_as)) {
    throw new Error(
      `An unstated coordinate reads as ${unstated.reads_as}, which is not published.`,
    );
  }
  for (const alternative of unstated.alternatives) {
    if (!alternative.against[unstated.reads_as]) {
      throw new Error(`${alternative.id} was not measured against ${unstated.reads_as}.`);
    }
  }
  const fields = new Map<string, Promise<Field>>();

  return {
    metadata,
    /** Where a coordinate in `space` lands on this brain, or null beyond its template's brain. */
    async map(point: Readonly<Coordinate>, space: string): Promise<Coordinate | null> {
      const { id, field } = readIn(metadata, space);
      let loading = fields.get(id);
      if (!loading) {
        loading = load(field, baseUrl);
        fields.set(id, loading);
        loading.catch(() => fields.delete(id));
      }
      return (await loading).map(point);
    },
  };
}

export type Coordinates = ReturnType<typeof createCoordinateSpaces>;
