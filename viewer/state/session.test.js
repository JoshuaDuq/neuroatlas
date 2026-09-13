import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, shortcutsAllowed } from './session.js';

const VIEWS = ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];
const modelState = {
  atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1,
  surfaceColor: 'tissue', selectedRegion: null, isolatedRegion: null,
};

const session = () => createSession({ views: VIEWS });

test('clinical navigation preserves anatomical search and selection independently', () => {
  const s = session();
  s.setQuery('hippocampus');
  s.setExplorer('deficits');
  s.setClinicalQuery('memory');
  s.setDeficit('amnesia');
  const snapshot = s.assemble(modelState);
  assert.equal(snapshot.explorer, 'deficits');
  assert.equal(snapshot.query, 'hippocampus');
  assert.equal(snapshot.clinicalQuery, 'memory');
  assert.equal(snapshot.selectedDeficit, 'amnesia');
  assert.equal(snapshot.selectedRegion, null);
  s.setExplorer('anatomy');
  assert.equal(s.assemble(modelState).selectedDeficit, 'amnesia');
  assert.throws(() => s.setExplorer('unknown'), /Unknown explorer/);
});

test('assembly merges model state and view state into one snapshot', () => {
  const s = session();
  s.setView('left');
  s.setQuery('putamen');
  const snapshot = s.assemble(modelState);
  assert.equal(snapshot.atlas, 'destrieux');
  assert.equal(snapshot.view, 'left');
  assert.equal(snapshot.query, 'putamen');
  assert.equal(snapshot.status, 'loading');
});

test('the snapshot never carries derived data', () => {
  // results and groups are computed by the catalog at render time; storing
  // them is how a list comes to disagree with the model.
  const snapshot = session().assemble(modelState);
  for (const derived of ['results', 'groups', 'visibleCount']) {
    assert.ok(!(derived in snapshot), `${derived} must not be stored in state`);
  }
});

test('an unknown view is refused rather than stored', () => {
  const s = session();
  assert.equal(s.setView('sideways'), false);
  assert.equal(s.assemble(modelState).view, 'oblique');
  assert.equal(s.setView('superior'), true);
  assert.equal(s.assemble(modelState).view, 'superior');
});

test('groups expand and collapse independently', () => {
  const s = session();
  s.toggleGroup('Frontal');
  s.toggleGroup('Temporal');
  s.toggleGroup('Frontal');
  assert.deepEqual([...s.assemble(modelState).expanded], ['Temporal']);
});

test('groups can be expanded or collapsed in bulk', () => {
  const s = session();
  s.setExpanded(['Frontal', 'Temporal', 'Parietal']);
  assert.deepEqual([...s.assemble(modelState).expanded].sort(), ['Frontal', 'Parietal', 'Temporal']);
  s.setExpanded([]);
  assert.deepEqual([...s.assemble(modelState).expanded], []);
});

test('a notice survives until the next action, and is never timed out', () => {
  const s = session();
  s.notify('Selection cleared — cortex hidden.');
  assert.equal(s.assemble(modelState).notice, 'Selection cleared — cortex hidden.');
  assert.equal(s.assemble(modelState).notice, 'Selection cleared — cortex hidden.');
  s.setQuery('a');
  assert.equal(s.assemble(modelState).notice, null);
});

test('loading progress is carried through to the snapshot', () => {
  const s = session();
  s.setProgress({ loaded: 12_400_000, total: 27_900_000 });
  assert.deepEqual(s.assemble(modelState).progress,
    { loaded: 12_400_000, total: 27_900_000 });
  s.setStatus('ready');
  assert.equal(s.assemble(modelState).status, 'ready');
  assert.equal(s.assemble(modelState).progress, null);
});

test('an error is carried without pretending the viewer is ready', () => {
  const s = session();
  s.setError(new Error('Manifest request failed: HTTP 404'));
  const snapshot = s.assemble(modelState);
  assert.equal(snapshot.status, 'error');
  assert.equal(snapshot.error.message, 'Manifest request failed: HTTP 404');
});

test('global shortcuts are suppressed while text is being typed', () => {
  // "3b" is a real HCP area, so digits must reach the search field.
  assert.equal(shortcutsAllowed({ tagName: 'INPUT', type: 'text' }), false);
  assert.equal(shortcutsAllowed({ tagName: 'TEXTAREA' }), false);
  assert.equal(shortcutsAllowed({ tagName: 'SELECT' }), false);
  assert.equal(shortcutsAllowed({ tagName: 'DIV', isContentEditable: true }), false);
});

test('shortcuts still work from the canvas, buttons and the page body', () => {
  assert.equal(shortcutsAllowed({ tagName: 'CANVAS' }), true);
  assert.equal(shortcutsAllowed({ tagName: 'BUTTON' }), true);
  assert.equal(shortcutsAllowed({ tagName: 'BODY' }), true);
  assert.equal(shortcutsAllowed(null), true);
});

test('a range input still accepts shortcuts, since it types nothing', () => {
  assert.equal(shortcutsAllowed({ tagName: 'INPUT', type: 'range' }), true);
  assert.equal(shortcutsAllowed({ tagName: 'INPUT', type: 'checkbox' }), true);
});

test('switching atlas is a distinct status from first load', () => {
  // On first load there is nothing to show, so the stage covers the viewport.
  // Switching atlas must leave the model on screen and usable.
  const s = session();
  s.setStatus('ready');
  s.setSwitching({ loaded: 1, total: 4 });
  const snapshot = s.assemble(modelState);
  assert.equal(snapshot.status, 'switching');
  assert.deepEqual(snapshot.progress, { loaded: 1, total: 4 });
  s.setStatus('ready');
  assert.equal(s.assemble(modelState).status, 'ready');
});

test('a failed atlas switch reports without declaring the viewer broken', () => {
  const s = session();
  s.setStatus('ready');
  s.failSwitch('HCP-MMP1.0 multimodal atlas', new Error('boom'));
  const snapshot = s.assemble(modelState);
  assert.equal(snapshot.status, 'ready', 'the model still on screen is still usable');
  assert.equal(snapshot.error, null);
  assert.match(snapshot.notice, /HCP-MMP1\.0 multimodal atlas/);
});

test('a failure message names the atlas, not the parser that gave up', () => {
  // A missing file makes GLTFLoader parse the 404 page and report
  // "Unexpected token '<'". That is an implementation detail leaking into
  // the interface; the reader is told what failed instead.
  const s = session();
  s.failSwitch('HCP-MMP1.0 multimodal atlas',
    new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`));
  const notice = s.assemble(modelState).notice;
  assert.ok(!notice.includes('Unexpected token'), notice);
  assert.ok(!notice.includes('doctype'), notice);
});
