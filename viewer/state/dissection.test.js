import assert from 'node:assert/strict';
import test from 'node:test';
import { createDissection } from './dissection.js';

const regions = new Map([['left', {}], ['right', {}]]);

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
  assert.throws(() => dissection.hide('left'), /array/);
});
