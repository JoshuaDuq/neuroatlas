import assert from 'node:assert/strict';
import test from 'node:test';
import { MODES, detailAvailable, stripVisible, viewAfterUpdate } from './workspace.js';

test('the tab row is the four content modes, in session order', () => {
  assert.deepEqual(MODES, ['anatomy', 'deficits', 'circuits', 'diffusion']);
});

const tracts = { explorer: 'diffusion', anatomy: 'bert', referenceAnatomy: 'bert' };

test('a selected region is detail in any mode', () => {
  for (const explorer of ['anatomy', 'deficits', 'circuits']) {
    assert.equal(detailAvailable({ explorer, selectedRegion: { id: 'a' } }), true, explorer);
  }
  assert.equal(detailAvailable({ ...tracts, selectedRegion: { id: 'a' } }), true);
});

test('a deficit or a lesson is detail only in its own mode', () => {
  assert.equal(detailAvailable({ explorer: 'deficits', selectedDeficit: 'aphasia' }), true);
  assert.equal(detailAvailable({ explorer: 'anatomy', selectedDeficit: 'aphasia' }), false);
  assert.equal(detailAvailable({ explorer: 'circuits', lesson: { circuit: 'motor' } }), true);
  assert.equal(detailAvailable({ explorer: 'circuits', lesson: { circuit: null } }), false);
  assert.equal(detailAvailable({ explorer: 'anatomy', lesson: { circuit: 'motor' } }), false);
});

test('tract reference data offers no detail view', () => {
  const reference = { ...tracts, anatomy: 'aomic', selectedRegion: { id: 'a' } };
  assert.equal(detailAvailable(reference), false);
  assert.equal(view({ view: 'detail', reference: true, available: false, selection: 'a' }), 'list');
  assert.throws(() => detailAvailable({ explorer: 'diffusion' }), /anatomy/);
});

function view(state) {
  return viewAfterUpdate({
    view: 'list', reference: false, wasAvailable: false, available: false,
    previousSelection: null, selection: null, ...state,
  });
}

test('a new region selection drills into the detail view', () => {
  assert.equal(view({ selection: 'left:1', available: true }), 'detail');
  assert.equal(view({ previousSelection: 'left:1', selection: 'left:2', available: true, wasAvailable: true }), 'detail');
});

test('going back keeps the list for the same selection', () => {
  assert.equal(view({
    previousSelection: 'left:1', selection: 'left:1', available: true, wasAvailable: true,
  }), 'list');
});

test('clearing the last context returns to the list', () => {
  assert.equal(view({ view: 'detail', previousSelection: 'left:1', wasAvailable: true }), 'list');
});

test('a deficit or lesson keeps the detail open once the region is cleared', () => {
  assert.equal(view({
    view: 'detail', previousSelection: 'left:1', wasAvailable: true, available: true,
  }), 'detail');
});

test('a detail opened ahead of its context waits for it rather than closing', () => {
  assert.equal(view({ view: 'detail' }), 'detail');
});

test('the selection strip never repeats the detail it would open', () => {
  const region = { kind: 'region', label: 'Precentral gyrus' };
  for (const mode of MODES) assert.equal(stripVisible({ view: 'detail', mode, selection: region }), false);
});

test('the selection strip leads only from a list that does not show the selection', () => {
  const strip = (mode, kind) => stripVisible({ view: 'list', mode, selection: { kind, label: 'x' } });
  assert.equal(strip('anatomy', 'region'), false, 'the tree shows the selected row');
  assert.equal(strip('deficits', 'region'), true);
  assert.equal(strip('circuits', 'region'), true);
  assert.equal(strip('diffusion', 'region'), true);
  assert.equal(strip('circuits', 'landmark'), false, 'the step list shows the current landmark');
  assert.equal(strip('deficits', 'deficit'), false);
  assert.equal(strip('circuits', 'lesson'), false);
  assert.equal(stripVisible({ view: 'list', mode: 'deficits', selection: {} }), false);
  assert.throws(() => strip('anatomy', 'atlas'), /kind/);
});
