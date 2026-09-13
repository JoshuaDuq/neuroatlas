import assert from 'node:assert/strict';
import test from 'node:test';
import { HIGHLIGHT_LIFT, codeIndex, liftFor } from './highlight.js';

const highlight = { hovered: 'destrieux:left:2', selected: 'destrieux:left:9' };

test('only the pointed-at and the selected region are lifted', () => {
  assert.equal(liftFor('destrieux:left:2', highlight), HIGHLIGHT_LIFT.hovered);
  assert.equal(liftFor('destrieux:left:9', highlight), HIGHLIGHT_LIFT.selected);
  assert.equal(liftFor('destrieux:left:3', highlight), 0);
});

test('a region carrying both reads as selected, the stronger of the two', () => {
  assert.ok(HIGHLIGHT_LIFT.selected > HIGHLIGHT_LIFT.hovered);
  const both = { hovered: 'x', selected: 'x' };
  assert.equal(liftFor('x', both), HIGHLIGHT_LIFT.selected);
});

test('tissue carrying no region is never lifted', () => {
  assert.equal(liftFor(null, highlight), 0);
  assert.equal(liftFor(undefined, { hovered: undefined, selected: undefined }), 0);
});

test('nothing is lifted when nothing is pointed at or chosen', () => {
  assert.equal(liftFor('destrieux:left:2', {}), 0);
});

test('a region resolves to the code its cut face is painted from', () => {
  const codes = codeIndex([
    { region_id: null },
    { region_id: 'destrieux:left:2' },
    { region_id: 'destrieux:left:9' },
  ]);
  assert.equal(codes.get('destrieux:left:2'), 1);
  assert.equal(codes.get('destrieux:left:9'), 2);
  assert.equal(codes.has(null), false);
});
