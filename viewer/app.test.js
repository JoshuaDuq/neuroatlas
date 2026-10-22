import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readerState } from './state/reader-state.js';
import { VIEW_DIRECTIONS, viewForRestoredCut } from './render/camera-views.js';
import { createSession } from './state/session.js';
import { Group } from 'three';
import { createComparisonOverlay } from './comparison/overlay.js';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const startup = source.slice(source.indexOf('  // The camera starts inside the brain;'),
  source.indexOf('  // Before the stage reports ready,'));
assert.ok(startup, 'The app restores shared state before reporting ready.');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runStartup = new AsyncFunction('dependencies', `
  const { applyView, session, model, wanted, readerState, loadedLayers,
    viewForRestoredCut, applyReaderState, dispose } = dependencies;
  ${startup}
`);

function dependencies() {
  const events = [];
  return { events, wanted: {}, model: { state: { view: 'oblique' } },
    session: { assemble: state => state }, readerState, viewForRestoredCut,
    loadedLayers: () => ({ atlas: 'destrieux', detail: 'learning', cutAtlas: 'destrieux' }),
    applyView() { events.push('frame'); },
    async applyReaderState() { events.push('restore'); },
    dispose() { events.push('dispose'); } };
}

test('startup disposes constructed resources before propagating a failed restoration', async () => {
  const fixture = dependencies();
  const failure = new Error('Requested spinal cord failed: HTTP 503');
  fixture.applyReaderState = async () => { throw failure; };
  await assert.rejects(runStartup(fixture), error => error === failure);
  assert.deepEqual(fixture.events, ['frame', 'dispose']);
});

test('a valid startup keeps its constructed resources alive', async () => {
  const fixture = dependencies();
  await runStartup(fixture);
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

const surfaceCommand = source.slice(source.indexOf('  // A later colour choice supersedes'),
  source.indexOf('  /**\n   * Choose the label volume the cut samples.'));
const bindSurfaceCommand = new Function('model', 'setAtlas', 'sections', 'session', 'render',
  `${surfaceCommand}; return chooseSurfaceColor;`);

function surfaceFixture() {
  const applied = [];
  const notices = [];
  let finishAtlas;
  const model = {
    state: { atlas: 'destrieux', surfaceColor: 'atlas', internalVisible: false },
    cabNp: { atlas: 'hcp-mmp' },
    functionalRegions: { atlas: 'hcp-mmp' },
  };
  const setAtlas = id => new Promise(resolve => {
    finishAtlas = loaded => { if (loaded) model.state.atlas = id; resolve(); };
  });
  const sections = { async setSurfaceColor(mode) { applied.push(mode); model.state.surfaceColor = mode; } };
  const session = { notify: text => notices.push(text) };
  const choose = bindSurfaceCommand(model, setAtlas, sections, session, () => {});
  return { applied, notices, model, choose, finishAtlas: loaded => finishAtlas(loaded) };
}

test('a colour chosen while CAB-NP waits on its atlas is not overwritten when the atlas arrives', async () => {
  const fixture = surfaceFixture();
  const cabNp = fixture.choose('cab-np');
  await fixture.choose('tissue');
  fixture.finishAtlas(true);
  await cabNp;
  assert.deepEqual(fixture.applied, ['tissue']);
  assert.equal(fixture.model.state.surfaceColor, 'tissue');
});

test('CAB-NP is applied once its atlas has loaded', async () => {
  const fixture = surfaceFixture();
  const cabNp = fixture.choose('cab-np');
  fixture.finishAtlas(true);
  await cabNp;
  assert.deepEqual(fixture.applied, ['cab-np']);
});

test('a failed atlas switch leaves its own message rather than a second one', async () => {
  const fixture = surfaceFixture();
  const functional = fixture.choose('functional');
  fixture.finishAtlas(false);
  await functional;
  assert.deepEqual(fixture.applied, []);
  assert.deepEqual(fixture.notices, []);
});
