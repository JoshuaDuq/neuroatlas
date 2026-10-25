import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FRAME_FILL, VIEW_DIRECTIONS, fitDistance, frameTo, upFor } from './render/camera-views.js';
import { planFraming } from './render/scene.js';
import { orbitPath } from './render/camera-path.js';
import { createSession, shortcutsAllowed } from './state/session.js';
import { characterShortcutAllowed } from './ui/chrome/shortcuts.js';
import { Box3, Group, PerspectiveCamera, Vector3 } from 'three';
import { createComparisonOverlay } from './comparison/overlay.js';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('./render/scene.js', import.meta.url), 'utf8');
const mriKeys = source.slice(source.indexOf('  const onKeyDown = event => {'),
  source.indexOf('    if (event.metaKey || event.ctrlKey || event.altKey) return;'));
const bindMriKeys = new Function('document', 'nativeTracts', 'keyPreference', 'shortcutsAllowed',
  'characterShortcutAllowed', `${mriKeys}\n}; return onKeyDown;`);

function mriShortcut({ enabled = true, key = 'm', target = { tagName: 'BUTTON' }, ...modifiers } = {}) {
  let closed = false;
  let prevented = false;
  const dialog = { open: true, close() { closed = true; } };
  const press = bindMriKeys({ getElementById: () => dialog }, { mriOpen: false }, { enabled },
    shortcutsAllowed, characterShortcutAllowed);
  press({ key, target, ...modifiers, preventDefault() { prevented = true; } });
  return { closed, prevented };
}

test('the linked MRI M shortcut respects the disabled single-key preference', () => {
  assert.deepEqual(mriShortcut({ enabled: false }), { closed: false, prevented: false });
});

test('the linked MRI M shortcut leaves editable inputs and modified keys alone', () => {
  for (const target of [{ tagName: 'INPUT', type: 'text' }, { tagName: 'TEXTAREA' }, { isContentEditable: true }]) {
    assert.deepEqual(mriShortcut({ target }), { closed: false, prevented: false });
  }
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    assert.deepEqual(mriShortcut({ [modifier]: true }), { closed: false, prevented: false });
  }
});

test('a key used by an input composition does not trigger the linked MRI shortcut', () => {
  assert.deepEqual(mriShortcut({ isComposing: true }), { closed: false, prevented: false });
});

test('enabled M closes linked MRI while Escape remains the native dialog action', () => {
  assert.deepEqual(mriShortcut({ key: 'M' }), { closed: true, prevented: true });
  assert.deepEqual(mriShortcut({ enabled: false, key: 'Escape' }), { closed: false, prevented: false });
});

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

const currentFrameCommand = source.slice(source.indexOf('  function frameCurrent('),
  source.indexOf('  /** The lesson step whose landmark'));
const viewportRefitCommand = source.slice(source.indexOf('  refitViewport = () => {'),
  source.indexOf('  // Framing fits above'));
const resetCommand = source.match(/onReset: \(\) => \{([\s\S]*?)\n    \},/)[1];
const bindViewportFraming = new Function('dependencies', `
  const { scene, session, model, bounds, VIEW_DIRECTIONS, frameTo, upFor, planFraming, fitDistance, Vector3 } = dependencies;
  let framed = true, zoom = 0.2, refitViewport;
  let fit = { horizontal: 1, vertical: 0.45 };
  const framingFit = () => fit, framingBounds = () => bounds, framingPoints = () => null;
  const isTargetingSpine = () => false, chrome = { holdView() {} }, render = () => {};
  const commands = { begin() {} }, sections = { setMode() {} };
  const viewDirection = () => scene.camera.position.clone().sub(scene.controls.target).normalize();
  const fittedDistance = direction => fitDistance(scene.camera, bounds, direction, fit);
  const moveCamera = (plan, options) => scene.moveTo(plan, options);
  ${currentFrameCommand}
  ${viewportRefitCommand}
  return {
    applyView,
    reset() { ${resetCommand} },
    resize() {
      scene.camera.aspect = 537 / 695;
      scene.camera.updateProjectionMatrix();
      fit = { horizontal: 1, vertical: 1 };
      refitViewport();
    },
  };
`);

const cameraMoveCommand = sceneSource.slice(sceneSource.indexOf('  function moveTo('),
  sceneSource.indexOf('  /** An eased move between'));
const cameraStepCommand = sceneSource.slice(sceneSource.indexOf('  function step('), sceneSource.indexOf('  function tick('));
const bindCameraMovement = new Function('camera', 'controls', 'orbitPath', `
  let transition = null, chromeMove = null, insetMove = null, lastMotion = 0;
  const TRANSITION_MS = 240, invalidate = () => {}, prefersReducedMotion = () => false;
  const easeSheet = t => t, easeInOut = t => t;
  ${cameraMoveCommand}
  ${cameraStepCommand}
  return {
    moveTo,
    finish() { step(performance.now() + 1000); },
    get destination() {
      return transition?.plan ?? {
        position: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone(),
        near: camera.near, far: camera.far, minDistance: controls.minDistance, maxDistance: controls.maxDistance,
      };
    },
  };
`);

function viewportFramingFixture({ animated = false } = {}) {
  const bounds = new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1));
  const camera = new PerspectiveCamera(35, 390 / 792, 0.001, 10);
  const controls = {
    target: new Vector3(), minDistance: 0, maxDistance: Infinity, dispatchEvent() {},
    update() { camera.lookAt(this.target); camera.updateMatrixWorld(); },
  };
  const movement = bindCameraMovement(camera, controls, orbitPath);
  const scene = {
    camera, controls, invalidate() {},
    moveTo(plan, options) { movement.moveTo(plan, animated ? options : { immediate: true }); },
    get destination() { return movement.destination; },
  };
  const model = { state: {}, reset() {} };
  const session = createSession({ views: Object.keys(VIEW_DIRECTIONS) });
  const framing = bindViewportFraming({ scene, session, model, bounds, VIEW_DIRECTIONS, frameTo, upFor, planFraming, fitDistance, Vector3 });
  const assertBrainFits = () => {
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new Vector3(x, y, z).project(camera);
          assert.ok(Math.abs(projected.x) <= FRAME_FILL + 1e-9, 'brain stays inside the horizontal frame');
          assert.ok(Math.abs(projected.y) <= FRAME_FILL + 1e-9, 'brain stays inside the vertical frame');
        }
      }
    }
  };
  return { ...framing, assertBrainFits, finish: movement.finish, camera, controls };
}

test('Reset view replaces an earlier close zoom across a phone-to-desktop resize', () => {
  const framing = viewportFramingFixture();
  framing.reset();
  framing.assertBrainFits();
  framing.resize();
  framing.assertBrainFits();
});

test('named view presets replace an earlier close zoom before the next resize', () => {
  for (const view of ['left', 'superior']) {
    const framing = viewportFramingFixture();
    framing.applyView(view, { immediate: true });
    framing.assertBrainFits();
    framing.resize();
    framing.assertBrainFits();
  }
});

test('resizing during an animated Reset cancels the old viewport endpoint', () => {
  const framing = viewportFramingFixture({ animated: true });
  framing.applyView('left', { immediate: true });
  framing.reset();
  framing.resize();
  const resizedPosition = framing.camera.position.clone();
  const resizedTarget = framing.controls.target.clone();
  framing.finish();
  assert.deepEqual(framing.camera.position.toArray(), resizedPosition.toArray(), 'the phone-fit tween cannot overwrite the resized frame');
  assert.deepEqual(framing.controls.target.toArray(), resizedTarget.toArray());
  framing.assertBrainFits();
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

const restoreCommand = source.slice(source.indexOf('  async function restoreBeforeExcursion() {'),
  source.indexOf('  /** Closing a deficit ends its excursion'));
const bindRestore = new Function('dependencies', `
  let { commands, applyReaderState, render, session, beforeExcursion, CLINICAL_TEXT } = dependencies;
  ${restoreCommand}
  return { restore: restoreBeforeExcursion, get before() { return beforeExcursion; } };
`);

test('a restore that a later command overtakes says so, and keeps the scene to restore; one that lands closes the item and says so', async () => {
  let live = true;
  const scene = { view: 'left' };
  const said = [];
  const closed = [];
  const session = explorer => ({
    assemble: () => ({ explorer, lang: 'en' }), notify: notice => said.push(notice.text),
    setFunction: id => closed.push(['function', id]), setDeficit: id => closed.push(['deficit', id]),
  });
  const CLINICAL_TEXT = { en: { stageRestored: 'Previous view restored.' } };
  const restoring = bindRestore({
    commands: { begin: () => () => live }, render() {}, session: session('functions'), beforeExcursion: scene, CLINICAL_TEXT,
    async applyReaderState() { live = false; return []; },
  });
  assert.equal(await restoring.restore(), false);
  assert.equal(restoring.before, scene);
  assert.deepEqual(closed, []);
  for (const explorer of ['functions', 'deficits']) {
    const finished = bindRestore({
      commands: { begin: () => () => true }, render() {}, session: session(explorer), beforeExcursion: scene, CLINICAL_TEXT,
      async applyReaderState() { return []; },
    });
    assert.equal(await finished.restore(), true);
    assert.equal(finished.before, null);
  }
  assert.deepEqual(closed, [['function', null], ['deficit', null]], 'the previous view had no item open');
  assert.deepEqual(said, ['Previous view restored.', 'Previous view restored.']);
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
