import assert from 'node:assert/strict';
import { test } from 'vitest';
import { FINDING_COLORS } from '../clinical/catalog.ts';
import { functionReach, functionsPaint, lesionProfile } from './functions.ts';

const domains = {
  domains: [
    { id: 'language', group: 'language-number' },
    { id: 'auditory', group: 'perception' },
    { id: 'motor', group: 'sensorimotor' },
  ],
  regions: {
    'hcp-mmp:left:1': [
      { domain: 'language', z: 6 },
      { domain: 'auditory', z: 4 },
    ],
    'hcp-mmp:left:2': [{ domain: 'language', z: 5 }],
    'hcp-mmp:right:2': [{ domain: 'language', z: 5 }],
    'hcp-mmp:left:3': [{ domain: 'motor', z: 9 }],
    'aseg:left:10': [{ domain: 'auditory', z: 3.5 }],
  },
};
const sizes = new Map([
  ['hcp-mmp:left:1', 100],
  ['hcp-mmp:left:2', 300],
  ['hcp-mmp:right:2', 300],
  ['hcp-mmp:left:3', 500],
  ['aseg:left:10', 100],
]);

test('takes the share of each function’s territory, on the sides the lesion reaches, inside it', () => {
  const reach = functionReach(
    domains,
    new Map([['hcp-mmp:left:1', { inside: 50, whole: 100 }]]),
    sizes,
  );
  // Auditory: 50 of its left 100 + 100 mm³. Language: 50 of its left 100 + 300; the right area is not counted.
  assert.deepEqual(
    reach.map((row) => [row.id, row.inside, row.whole, row.share, row.areas]),
    [
      ['auditory', 50, 200, 0.25, 1],
      ['language', 50, 400, 0.125, 1],
    ],
  );
  assert.equal(reach[0]!.group, 'perception');
});

test('a function the lesion does not reach is not listed', () => {
  const reach = functionReach(
    domains,
    new Map([['hcp-mmp:left:3', { inside: 5, whole: 500 }]]),
    sizes,
  );
  assert.deepEqual(
    reach.map((row) => row.id),
    ['motor'],
  );
});

test('a territory with an area the label volumes do not size is refused, not shrunk', () => {
  const partial = new Map([...sizes].filter(([id]) => id !== 'hcp-mmp:left:2'));
  assert.throws(
    () =>
      functionReach(domains, new Map([['hcp-mmp:left:1', { inside: 50, whole: 100 }]]), partial),
    /hcp-mmp:left:2/,
  );
});

test('groups the functions and the deficits it reaches, strongest group first', () => {
  const finding = (deficit: string, share: number) => ({
    association: { id: `${deficit}-finding`, deficit },
    share,
  });
  const profile = lesionProfile(
    ['attention-executive', 'language-number', 'perception', 'sensorimotor'],
    [
      { id: 'language', group: 'language-number', share: 0.1 },
      { id: 'auditory', group: 'perception', share: 0.3 },
    ],
    [finding('aphasia', 0.6), finding('aphasia', 0.2), finding('word-deafness', 0.05)],
    (deficit) => (deficit === 'aphasia' ? 'language-number' : 'perception'),
  );
  assert.deepEqual(
    profile.map((group) => [
      group.group,
      group.functions.map((row) => row.id),
      group.deficits.map((row) => [row.deficit, row.findings.length, row.share]),
    ]),
    [
      ['language-number', ['language'], [['aphasia', 2, 0.6]]],
      ['perception', ['auditory'], [['word-deafness', 1, 0.05]]],
    ],
  );
});

test('paints the leading functions’ territories, each area in the first colour that claims it', () => {
  const reach = functionReach(
    domains,
    new Map([
      ['hcp-mmp:left:1', { inside: 50, whole: 100 }],
      ['hcp-mmp:left:3', { inside: 400, whole: 500 }],
    ]),
    sizes,
  );
  const { paint, rows } = functionsPaint(domains, reach, 'k');
  assert.deepEqual(
    rows.map((row) => [row.id, row.color]),
    [
      ['motor', FINDING_COLORS[0]],
      ['auditory', FINDING_COLORS[1]],
      ['language', FINDING_COLORS[2]],
    ],
  );
  // Area 1 is auditory's before language's; both hemispheres of a territory are drawn.
  assert.equal(paint.colors.get('hcp-mmp:left:1'), FINDING_COLORS[1]);
  assert.equal(paint.colors.get('hcp-mmp:right:2'), FINDING_COLORS[2]);
  assert.equal(paint.id, 'lesion:functions:k');
});
