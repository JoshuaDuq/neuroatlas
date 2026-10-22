import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { VIEW_DIRECTIONS } from './render/camera-views.js';
import { createSession } from './state/session.js';
import { Group } from 'three';
import { createComparisonOverlay } from './comparison/overlay.js';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const startup = source.slice(source.indexOf('  // The camera starts inside the brain;'),
  source.indexOf('  // Before the stage reports ready,'));
assert.ok(startup, 'The app restores shared state before reporting ready.');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runStartup = new AsyncFunction('dependencies', `
  const { applyView, session, model, link, restoreLink, dispose } = dependencies;
  ${startup}
  return notApplied;
`);

function dependencies() {
  const events = [];
  return { events, link: { state: {}, rejected: [] }, model: { state: { view: 'oblique' } },
    session: { assemble: state => state },
    applyView() { events.push('frame'); },
    async restoreLink() { events.push('restore'); return ['pos']; },
    dispose() { events.push('dispose'); } };
}

test('startup disposes constructed resources before propagating an unexpected restore failure', async () => {
  const fixture = dependencies();
  const failure = new TypeError('restoreLink is broken');
  fixture.restoreLink = async () => { throw failure; };
  await assert.rejects(runStartup(fixture), error => error === failure);
  assert.deepEqual(fixture.events, ['frame', 'dispose']);
});

test('a link with fields it cannot apply still starts, and reports them', async () => {
  const fixture = dependencies();
  assert.deepEqual(await runStartup(fixture), ['pos']);
  assert.deepEqual(fixture.events, ['frame', 'restore']);
});

const viewCommand = source.slice(source.indexOf('  function applyView('),
  source.indexOf('  /** The lesson step whose landmark'));
const bindViewCommand = new Function('session', 'frameCurrent', `${viewCommand}; return applyView;`);

test('an unknown requested view fails with the real camera session', () => {
  const session = createSession({ views: Object.keys(VIEW_DIRECTIONS) });
  const frames = [];
  const applyView = bindViewCommand(session, movement => frames.push(movement));
  assert.throws(() => applyView('missing'), /Unknown view: missing/);
  assert.equal(session.assemble({}).view, 'oblique');
  assert.deepEqual(frames, []);
});

test('a published view frames the real camera session', () => {
  const session = createSession({ views: Object.keys(VIEW_DIRECTIONS) });
  const frames = [];
  const applyView = bindViewCommand(session, movement => frames.push(movement));
  applyView('left', { immediate: true });
  assert.equal(session.assemble({}).view, 'left');
  assert.deepEqual(frames, [{ immediate: true }]);
});

const comparisonCommand = source.match(/highlight: async id => \{([\s\S]*?)\n    \},/)[1];
const bindComparisonCommand = new AsyncFunction('overlapOverlay', 'outline', 'id', comparisonCommand);

test('late comparison geometry cannot restart a disposed app renderer', async () => {
  let finish;
  const overlay = createComparisonOverlay(() => new Promise(resolve => { finish = resolve; }));
  let frames = 0;
  const pending = bindComparisonCommand(overlay, () => frames++, 'pair');
  overlay.dispose();
  finish(new Group());
  assert.equal(await pending, false);
  assert.equal(frames, 0);
});

const anatomyCommand = source.match(/onAnatomy: id => \{([\s\S]*?)\n    \},/)[1];
const switchAnatomy = new Function('anatomy', 'linkWriter', 'encodeState', 'linkState', 'history', 'globalThis', 'id',
  anatomyCommand);

test('another subject keeps the cut, view and panel, replaces the link in place and reloads', async () => {
  const { encodeState, decodeState } = await import('./state/url-state.js');
  const calls = [];
  const history = { replaceState: (state, title, url) => calls.push(['replace', url]), pushState: () => calls.push(['push']) };
  const page = { location: { reload: () => calls.push(['reload']) } };
  const linkWriter = { cancel: () => calls.push(['cancel']) };
  const linkState = () => ({
    anatomy: 'snail', atlas: 'hcp-mmp', cut: 'coronal', cutOffset: 12.34, view: 'left', explorer: 'deficits',
    selectedDeficit: 'aphasia', selectedRegion: { id: 'destrieux:left:29' }, hiddenRegions: new Set(['x']),
    orbit: { position: [0, 0, 300], target: [0, 0, 0] }, mriWindow: { center: 90, width: 180 }, lang: 'fr',
  });
  switchAnatomy('snail', linkWriter, encodeState, linkState, history, page, 'bert');
  assert.deepEqual(calls.map(([kind]) => kind), ['cancel', 'replace', 'reload']);
  const { state } = decodeState(calls[1][1]);
  assert.deepEqual(state, {
    anatomy: 'bert', atlas: 'hcp-mmp', cut: 'coronal', cutOffset: 12.3, view: 'left', explorer: 'deficits',
    selectedDeficit: 'aphasia', lang: 'fr',
  });
});

const restoreCommand = source.slice(source.indexOf('  async function restoreBeforeDeficit() {'),
  source.indexOf('  /** Closing a deficit ends its excursion'));
const bindRestore = new Function('dependencies', `
  let { commands, applyReaderState, render, beforeDeficit } = dependencies;
  ${restoreCommand}
  return { restore: restoreBeforeDeficit, get before() { return beforeDeficit; } };
`);

test('a restore that a later command overtakes says so, and keeps the scene to restore', async () => {
  let live = true;
  const scene = { view: 'left' };
  const restoring = bindRestore({
    commands: { begin: () => () => live }, render() {}, beforeDeficit: scene,
    async applyReaderState() { live = false; return []; },
  });
  assert.equal(await restoring.restore(), false);
  assert.equal(restoring.before, scene);
  const finished = bindRestore({
    commands: { begin: () => () => true }, render() {}, beforeDeficit: scene,
    async applyReaderState() { return []; },
  });
  assert.equal(await finished.restore(), true);
  assert.equal(finished.before, null);
});

const leaveCommand = source.slice(source.indexOf('  async function leaveLesson() {'),
  source.indexOf('  // A tab chosen during a lesson'));
const bindLeave = new Function('dependencies', `
  let { circuitSession, session, model, render, commands, applyReaderState, workspace, beforeLesson } = dependencies;
  ${leaveCommand}
  return { leave: leaveLesson, get before() { return beforeLesson; } };
`);

function lessonFixture({ explorer = 'circuits', before = { view: 'right' }, live = () => true } = {}) {
  const events = [];
  let lesson = 'vision';
  return {
    events,
    circuitSession: { snapshot: () => ({ circuit: lesson }), close() { lesson = null; events.push('close'); } },
    session: { assemble: () => ({ explorer }) },
    model: { state: {} },
    render() { events.push('render'); },
    commands: { begin: () => live, fail: operation => events.push(`fail:${operation}`) },
    async applyReaderState(target) { events.push(['apply', target]); return []; },
    workspace: { showList() { events.push('list'); } },
    beforeLesson: before,
  };
}

test('leaving a lesson ends it and puts back the scene from before it, with the list in front', async () => {
  const scene = { view: 'right' };
  const fixture = lessonFixture({ before: scene });
  const leaving = bindLeave(fixture);
  await leaving.leave();
  assert.deepEqual(fixture.events, ['close', 'render', ['apply', scene], 'list', 'render']);
  assert.equal(leaving.before, null);
});

test('a lesson a link opened on its landmark ends without a scene to put back', async () => {
  const fixture = lessonFixture({ before: null });
  await bindLeave(fixture).leave();
  assert.deepEqual(fixture.events, ['close', 'render']);
});

test('a lesson is left only from Circuits; a command that overtakes the restore keeps the panel as it set it', async () => {
  const elsewhere = lessonFixture({ explorer: 'deficits' });
  await bindLeave(elsewhere).leave();
  assert.deepEqual(elsewhere.events, []);
  const overtaken = lessonFixture({ live: () => false });
  await bindLeave(overtaken).leave();
  assert.deepEqual(overtaken.events.slice(-1)[0][0], 'apply');
  assert.ok(!overtaken.events.includes('list'));
});
