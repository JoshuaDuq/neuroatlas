import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import { createField } from './field.ts';
import type { Coordinate } from './parse.ts';

/*
 * `published-reference.json` is `map_points` (brain_model/layers/coordinate_spaces.py) over the
 * build's own fields, at full precision for the inputs as stored: 44 points per space, among them
 * MNI (0, 0, 0), (−42, 22, 6), (38, −22, 56) and (−24, −4, −20), and three beyond each grid. The two
 * points added here lie inside the grid but beyond the template's dilated brain, where the nodes
 * carry `outside`. Interpolation is the same arithmetic on the same int16 values, so anything
 * larger than the reference's own rounding is a bug.
 */
const BEYOND_THE_BRAIN: Coordinate[] = [
  [60, 0, 70],
  [0, -100, -60],
];

const models = 'public/models/cdmd/';
const { coordinate_spaces: published } = readRepoJson<Manifest>(`${models}manifest.json`);
const expected = readRepoJson<
  Record<
    string,
    { mapped: { template_mm: Coordinate; surface_ras_mm: Coordinate }[]; refused: Coordinate[] }
  >
>('web/src/lib/core/coordinates/published-reference.json');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('each published field carries a coordinate where the build’s mapper does, and refuses where it refuses', () => {
  assert.deepEqual(
    published!.spaces.map(({ id }) => id),
    Object.keys(expected),
  );
  for (const { id, field: record } of published!.spaces) {
    const compressed = readFileSync(resolve(repoRoot, models, record.file));
    assert.equal(sha256(compressed), record.sha256, id);
    const bytes = gunzipSync(compressed);
    assert.equal(bytes.byteLength, record.byte_length, id);
    assert.equal(sha256(bytes), record.decoded_sha256, id);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const field = createField(record, new Int16Array(buffer));
    const { mapped, refused } = expected[id]!;
    assert.equal(mapped.length, 44, id);
    for (const { template_mm: point, surface_ras_mm: wanted } of mapped) {
      const landing = field.map(point);
      assert.ok(landing, `${id} refused ${point}`);
      landing.forEach((value, axis) =>
        assert.ok(Math.abs(value - wanted[axis]!) <= 1e-6, `${id} ${point}: ${landing}`),
      );
    }
    for (const point of [...refused, ...BEYOND_THE_BRAIN]) {
      assert.equal(field.map(point), null, `${id} placed ${point}`);
    }
  }
});
