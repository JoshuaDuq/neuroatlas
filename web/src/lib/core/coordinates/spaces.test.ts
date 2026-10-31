import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import type { CoordinateSpaces } from '../../types/index.ts';
import { UNSTATED, createCoordinateSpaces, readIn } from './spaces.ts';

const offsets = {
  cortex_offset_mm: { median: 1.56, p95: 3.2, max: 6 },
  subcortical_offset_mm: {},
  sphere_overlap: {},
};
const space = (id: string) => ({
  id,
  label: id.toUpperCase(),
  description: '',
  citation: '',
  doi: '',
  license: '',
  copyright: '',
  field: { file: `coordinates-${id}.field` } as never,
  registration: {},
});
const metadata: CoordinateSpaces = {
  label: 'Published coordinates',
  radius_mm: 5,
  spaces: [space('first'), space('second')],
  unstated: {
    reads_as: 'first',
    alternatives: [{ id: 'fsl', label: 'FSL', description: '', against: { first: offsets } }],
  },
  method: '',
};

/** Each space's field moves every point by its own shift along x. */
function spaces(failFirst = false) {
  let failing = failFirst;
  const load = vi.fn(async ({ file }: { file: string }) => {
    if (failing) {
      failing = false;
      throw new Error('offline');
    }
    const shift = file.includes('second') ? 2 : 1;
    return {
      map: ([x, y, z]: readonly number[]) =>
        x! > 90 ? null : ([x! + shift, y!, z!] as [number, number, number]),
    };
  });
  return { coordinates: createCoordinateSpaces(metadata, 'https://example.test/', load), load };
}

test('loads only the chosen space’s field, once, and reads an unstated template as reads_as', async () => {
  const { coordinates, load } = spaces();
  assert.deepEqual(await coordinates.map([-42, 22, 6], 'second'), [-40, 22, 6]);
  assert.deepEqual(
    load.mock.calls.map(([record]) => record.file),
    ['coordinates-second.field'],
  );
  assert.deepEqual(await coordinates.map([-42, 22, 6], UNSTATED), [-41, 22, 6]);
  assert.deepEqual(await coordinates.map([10, 0, 0], 'first'), [11, 0, 0]);
  assert.equal(await coordinates.map([95, 0, 0], 'first'), null);
  assert.equal(load.mock.calls.length, 2);
  assert.equal(readIn(metadata, UNSTATED).id, 'first');
  assert.equal(readIn(metadata, 'second').id, 'second');
  await assert.rejects(coordinates.map([0, 0, 0], 'talairach'), /Unknown coordinate space/);
});

test('a field that failed to download is asked for again', async () => {
  const { coordinates, load } = spaces(true);
  await assert.rejects(coordinates.map([0, 0, 0], 'first'), /offline/);
  assert.deepEqual(await coordinates.map([0, 0, 0], 'first'), [1, 0, 0]);
  assert.equal(load.mock.calls.length, 2);
});

test('refuses metadata it could not honour', () => {
  const create = (changes: Partial<CoordinateSpaces>) => () =>
    createCoordinateSpaces({ ...metadata, ...changes }, 'https://example.test/');
  assert.throws(create({ radius_mm: 0 }), /positive radius/);
  assert.throws(create({ spaces: [space('first'), space('first')] }), /distinct/);
  assert.throws(create({ spaces: [space(UNSTATED)] }), /distinct/);
  assert.throws(create({ unstated: { ...metadata.unstated, reads_as: 'fsl' } }), /not published/);
  assert.throws(
    create({
      unstated: {
        reads_as: 'second',
        alternatives: metadata.unstated.alternatives,
      },
    }),
    /not measured against second/,
  );
});
