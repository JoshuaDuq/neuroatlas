import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createDissection, dissectionSaid } from './dissection.ts';

const regions = new Map([
  ['left', {}],
  ['right', {}],
]);

test('published dissection snapshots cannot mutate the live mask or history', () => {
  const dissection = createDissection(regions);
  dissection.hide(['left'], { selectedId: 'left' });
  const snapshot = dissection.state;
  snapshot.hiddenRegions.add('right');
  assert.deepEqual([...dissection.state.hiddenRegions], ['left']);
  assert.deepEqual(dissection.undo(), { selectedId: 'left' });
  assert.equal(dissection.state.hiddenRegions.size, 0);
});

test('loading a shared mask validates all identifiers and begins with no undo history', () => {
  const dissection = createDissection(regions);
  dissection.load(['right']);
  assert.equal(dissection.state.dissectionCanUndo, false);
  assert.throws(() => dissection.load(['left', 'unknown']), /Unknown region/);
  assert.deepEqual([...dissection.state.hiddenRegions], ['right']);
  assert.throws(() => dissection.hide('left' as unknown as string[], {}), /array/);
});

test('the announcer sentence follows the count, in both languages', () => {
  const said = (lang: 'en' | 'fr', count: number) =>
    dissectionSaid({
      lang,
      hiddenRegions: new Set(Array.from({ length: count }, (_, i) => `r${i}`)),
    });
  assert.equal(said('en', 0), 'All parts shown');
  assert.equal(said('en', 1), '1 part hidden');
  assert.equal(said('en', 7), '7 parts hidden');
  assert.equal(said('fr', 0), 'Tout est visible');
  assert.equal(said('fr', 1), '1 partie masquée');
  assert.equal(said('fr', 7), '7 parties masquées');
});
