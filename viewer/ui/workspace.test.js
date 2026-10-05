import assert from 'node:assert/strict';
import test from 'node:test';
import * as workspace from './workspace.js';

function panel(state) {
  assert.equal(typeof workspace.panelAfterSelection, 'function');
  return workspace.panelAfterSelection({
    active: 'find', previousSelection: null, selection: null,
    hasContext: false, ...state,
  });
}

test('selecting anatomy while exploring opens its contextual details', () => {
  assert.equal(panel({ selection: 'left:1', hasContext: true }), 'region');
});

test('selection does not interrupt cutting or view adjustments', () => {
  for (const active of ['cuts', 'display']) {
    assert.equal(panel({ active, selection: 'left:1', hasContext: true }), active);
  }
});

test('returning to exploration keeps the list open for the same selection', () => {
  assert.equal(panel({
    previousSelection: 'left:1', selection: 'left:1', hasContext: true,
  }), 'find');
});

test('clearing the last selection returns an empty details panel to exploration', () => {
  assert.equal(panel({ active: 'region', previousSelection: 'left:1' }), 'find');
});

test('a circuit or deficit profile remains open without an anatomical selection', () => {
  assert.equal(panel({ active: 'region', hasContext: true }), 'region');
});
