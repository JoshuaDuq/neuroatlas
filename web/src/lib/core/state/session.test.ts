import assert from 'node:assert/strict';
import { onTestFinished, test, vi } from 'vitest';
import { createSession, shortcutsAllowed } from './session.ts';

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

test('a masthead choice lifts the open paint until a function, a deficit or a tab is chosen again', () => {
  const s = session();
  s.setExplorer('functions');
  s.setFunctionQuery('memory');
  s.setFunction('language');
  assert.equal(s.assemble(modelState).paintLifted, false);
  for (const choose of [() => s.setFunction('all'), () => s.setDeficit('aphasia'), () => s.setExplorer('functions')]) {
    s.liftPaint();
    assert.equal(s.assemble(modelState).paintLifted, true);
    choose();
    assert.equal(s.assemble(modelState).paintLifted, false);
  }
  const snapshot = s.assemble(modelState);
  assert.equal(snapshot.functionQuery, 'memory');
  assert.equal(snapshot.selectedFunction, 'all');
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

test('circuits is an independent explorer without changing the anatomical selection', () => {
  const s = session();
  s.setExplorer('circuits');
  assert.equal(s.assemble(modelState).explorer, 'circuits');
  assert.equal(s.assemble(modelState).atlas, 'destrieux');
  assert.equal(s.assemble(modelState).selectedRegion, null);
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
  s.notify({ text: 'Selection cleared — cortex hidden.' });
  assert.deepEqual(s.assemble(modelState).notice, { text: 'Selection cleared — cortex hidden.', action: null });
  assert.equal(s.assemble(modelState).notice.text, 'Selection cleared — cortex hidden.');
  s.setQuery('a');
  assert.equal(s.assemble(modelState).notice, null);
  assert.throws(() => s.notify('bare text'), /needs text/);
});

test('download progress is not an action: a standing notice outlives it', () => {
  const s = session();
  s.setStatus('ready');
  s.notify({ text: 'Planum was updated. Reload to continue.', action: 'reload' });
  s.setSwitching({ loaded: 1, total: 4 });
  s.endSwitching();
  assert.equal(s.assemble(modelState).notice.action, 'reload');
  assert.equal(s.assemble(modelState).status, 'ready');
});

test('a download during the first load leaves the first load’s status alone', () => {
  const s = session();
  s.setSwitching({ loaded: 1, total: 4 });
  assert.equal(s.assemble(modelState).status, 'loading');
  s.endSwitching();
  assert.equal(s.assemble(modelState).status, 'loading');
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

test('a slider keeps the keys that move it', () => {
  const slider = { tagName: 'INPUT', type: 'range' };
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']) {
    assert.equal(shortcutsAllowed(slider, key), false, key);
  }
  // Without the key there is no telling, so the slider keeps them all.
  assert.equal(shortcutsAllowed(slider), false);
});

test('a slider passes on keys it does not use, and a checkbox types nothing', () => {
  assert.equal(shortcutsAllowed({ tagName: 'INPUT', type: 'range' }, 'c'), true);
  assert.equal(shortcutsAllowed({ tagName: 'INPUT', type: 'range' }, '3'), true);
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
  s.endSwitching();
  assert.equal(s.assemble(modelState).status, 'ready');
  assert.equal(s.assemble(modelState).progress, null);
});

test('a lost GPU context is said by the stage in the reader’s language, not carried as English text', () => {
  const s = session();
  s.setStatus('ready');
  s.setContextLost();
  assert.equal(s.assemble(modelState).status, 'context-lost');
  assert.equal(s.assemble(modelState).error, null);
});

/**
 * The session keeps its state in closure scope and exposes it only through
 * `assemble`, so `session.state` is undefined and every read of it throws.
 *
 * This silently broke Expand all and Open linked MRI slices:
 * the handlers threw on their first line, so the buttons did nothing. The
 * selection lives on the model, the view state on the session, and both are
 * reachable only from the assembled snapshot.
 */
test('the session exposes its state only through the assembled snapshot', () => {
  assert.equal((session() as { state?: unknown }).state, undefined);
});

test('a notice raised while a link is applied outlives the link’s own steps, beside the link’s notice', () => {
  const s = session();
  s.setStatus('ready');
  s.holdNotices();
  s.notify({ text: 'Could not show the white matter.', action: null });
  s.notify({ text: 'Planum was updated.', action: 'reload' });
  // The link's own steps are actions; without the hold they would clear both.
  s.setExplorer('deficits');
  s.setDeficit('aphasia');
  assert.equal(s.assemble(modelState).notice, null, 'nothing shows until the link has settled');
  s.releaseNotices({ text: 'Not applied from this link: language.' });
  assert.deepEqual(s.assemble(modelState).notice, {
    text: 'Not applied from this link: language. Could not show the white matter. Planum was updated.',
    action: 'reload',
  });
});

test('overlapping links hold notices until the last settles; with nothing to say, nothing shows', () => {
  const s = session();
  s.holdNotices();
  s.holdNotices();
  s.notify({ text: 'A download failed.' });
  s.releaseNotices();
  assert.equal(s.assemble(modelState).notice, null);
  s.releaseNotices({ text: 'Not applied from this link: view.' });
  assert.equal(s.assemble(modelState).notice.text, 'Not applied from this link: view. A download failed.');
  s.holdNotices();
  s.releaseNotices(null);
  assert.equal(s.assemble(modelState).notice.text, 'Not applied from this link: view. A download failed.');
  s.notify({ text: 'Later.' });
  assert.equal(s.assemble(modelState).notice.text, 'Not applied from this link: view. A download failed. Later.',
    'released, notices show at once again');
});

test('a notice arriving while another stands joins it, once, until the next action clears both', () => {
  const s = session();
  s.notify({ text: 'Not applied from this link: view.' });
  s.notify({ text: 'Could not show the white matter.', action: 'reload' });
  s.notify({ text: 'Could not show the white matter.' });
  assert.deepEqual(s.assemble(modelState).notice, {
    text: 'Not applied from this link: view. Could not show the white matter.', action: 'reload',
  });
  s.setQuery('');
  assert.equal(s.assemble(modelState).notice, null);
  s.notify({ text: 'Fresh.' });
  s.notify(null);
  assert.equal(s.assemble(modelState).notice, null, 'dismissing clears everything shown');
});

// Owed by C1 (i18n.test.js:12).
test('session accepts and toggles language', () => {
  const s = createSession({ views: ['oblique', 'left'], lang: 'en' });
  assert.equal(s.assemble(modelState).lang, 'en');
  s.setLang('fr');
  assert.equal(s.assemble(modelState).lang, 'fr');
  s.setLang('invalid');
  assert.equal(s.assemble(modelState).lang, 'en');
});
