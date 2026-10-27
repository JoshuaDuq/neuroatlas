import assert from 'node:assert/strict';
import { test } from 'vitest';
import { FINDING_COLORS } from '../clinical/catalog.ts';
import { SLIGHT_SHARE, findingsPaint, rankFindings } from './findings.ts';

type Laterality = 'left' | 'right' | 'bilateral';
const finding = (id: string, regions: string[], laterality: Laterality = 'left') => ({
  id,
  laterality,
  mappings: regions.map((region) => ({ region })),
});
const inside = (entries: [string, number, number][]) =>
  new Map(entries.map(([id, inside, whole]) => [id, { inside, whole }]));

test('ranks findings by the largest share of a cited region inside the lesion', () => {
  const ranked = rankFindings(
    [
      finding('a', ['r:left:1']),
      finding('b', ['r:left:2', 'r:left:3']),
      finding('c', ['r:left:9']),
    ],
    inside([
      ['r:left:1', 10, 100],
      ['r:left:2', 5, 10],
      ['r:left:3', 1, 100],
    ]),
  );
  assert.deepEqual(
    ranked.shown.map((row) => [row.association.id, row.share]),
    [
      ['b', 0.5],
      ['a', 0.1],
    ],
  );
  const [b] = ranked.shown;
  // Its reached regions largest share first, and how many it cites in all.
  assert.deepEqual(
    b!.reached.map((reach) => [reach.region, reach.share]),
    [
      ['r:left:2', 0.5],
      ['r:left:3', 0.01],
    ],
  );
  assert.equal(b!.cited, 2);
});

test('folds findings whose cited regions are barely reached, without dropping them', () => {
  const ranked = rankFindings(
    [finding('kept', ['r:left:1']), finding('slight', ['r:left:2'])],
    inside([
      ['r:left:1', 1, 100],
      ['r:left:2', 9, 5293],
    ]),
  );
  assert.deepEqual(
    ranked.shown.map((row) => row.association.id),
    ['kept'],
  );
  assert.deepEqual(
    ranked.slight.map((row) => row.association.id),
    ['slight'],
  );
  assert.equal(SLIGHT_SHARE, 0.01);
});

test('marks a bilateral finding the lesion reaches on one side only', () => {
  const ranked = rankFindings(
    [
      finding('both', ['r:left:1', 'r:right:1'], 'bilateral'),
      finding('reached-both', ['r:left:2', 'r:right:2'], 'bilateral'),
      finding('left', ['r:left:3']),
    ],
    inside([
      ['r:left:1', 50, 100],
      ['r:left:2', 50, 100],
      ['r:right:2', 50, 100],
      ['r:left:3', 50, 100],
    ]),
  );
  const sides = Object.fromEntries(ranked.shown.map((row) => [row.association.id, row.oneSide]));
  assert.deepEqual(sides, { both: 'left', 'reached-both': null, left: null });
});

test('colours the leading findings, each region in the first colour that cites it', () => {
  const findings = Array.from({ length: FINDING_COLORS.length + 1 }, (_, n) =>
    finding(`f${n}`, [`r:left:${n}`, 'r:left:shared']),
  );
  const ranked = rankFindings(
    findings,
    inside(findings.map((_, n) => [`r:left:${n}`, 100 - n, 100] as [string, number, number])),
  );
  const { findings: coloured, paint } = findingsPaint(ranked.shown, '-45,-25,30:15');
  assert.deepEqual(
    coloured.map((row) => row.color),
    [...FINDING_COLORS, null],
  );
  assert.equal(paint.colors.get('r:left:shared'), FINDING_COLORS[0]);
  assert.equal(paint.colors.get('r:left:1'), FINDING_COLORS[1]);
  // The finding past the palette is listed but not painted.
  assert.equal(paint.colors.has(`r:left:${FINDING_COLORS.length}`), false);
  // A new placement is a new paint: the model ignores a paint whose id it already shows.
  assert.equal(paint.id, 'lesion:-45,-25,30:15');
});
