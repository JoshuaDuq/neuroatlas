import assert from 'node:assert/strict';
import { onTestFinished, test, vi } from 'vitest';
import { applyReaderState as restore, readerState, sameRegions } from './reader-state.ts';
import { decodeState, encodeState } from './url-state.ts';

const LOADED = { atlas: 'destrieux', detail: 'learning', cutAtlas: 'destrieux' };

test('an empty link is the default scene on the loaded layers, with nothing left implicit', () => {
  assert.deepEqual(readerState({}, LOADED), {
    hemisphere: 'both', cortexVisible: true, cortexOpacity: 1, internalVisible: true,
    spinalCordVisible: false, surfaceColor: 'atlas', functionalLevel: 'named', internalSystem: null,
    view: 'oblique', cut: 'off', cutOffset: 0, cutReverse: false, cutTilt: 30, cutAzimuth: 30,
    selectedRegion: null, isolatedRegion: null, orbit: null, mriWindow: null,
    ...LOADED, hiddenRegions: new Set(), camera: 'view',
  });
});

test('the defaults are exactly what a link leaves out', () => {
  assert.equal(encodeState(readerState({}, LOADED)), 'atlas=destrieux&cuts=destrieux&detail=learning');
});

test('false and zero are kept rather than read as missing', () => {
  const state = readerState({ cortexVisible: false, cortexOpacity: 0, cutOffset: 0, cutReverse: false }, LOADED);
  assert.equal(state.cortexVisible, false);
  assert.equal(state.cortexOpacity, 0);
  assert.equal(state.cutOffset, 0);
});

test('a live state is captured as identifiers, so it can be compared and applied', () => {
  const state = readerState({
    selectedRegion: { id: 'aseg:left:17', label: 'Left hippocampus' },
    isolatedRegion: 'aseg:left:17',
    hiddenRegions: new Set(['destrieux:left:30']),
  }, LOADED);
  assert.equal(state.selectedRegion, 'aseg:left:17');
  assert.equal(state.isolatedRegion, 'aseg:left:17');
  assert.deepEqual(state.hiddenRegions, new Set(['destrieux:left:30']));
});

test('a captured scene encodes to the same link it was captured from', () => {
  const hash = 'atlas=hcp-mmp&cuts=aseg&system=Basal+ganglia&detail=aseg&region=aseg:left:11'
    + '&isolate=aseg:left:11&view=left&cut=coronal&pos=-12.5&rev=1&hemi=left&cortex=0'
    + '&internal=0&cord=1&colors=tissue&opacity=0.4&hidden=aseg:left:12,aseg:left:13';
  const { state: decoded } = decodeState(hash);
  const state = readerState(decoded, LOADED);
  assert.deepEqual(decodeState(encodeState(state)).state, decoded);
});

test('layers a link does not name stay as loaded; a missing layer is an error, not a guess', () => {
  assert.equal(readerState({ atlas: 'hcp-mmp' }, LOADED).atlas, 'hcp-mmp');
  assert.equal(readerState({}, LOADED).detail, 'learning');
  assert.throws(() => readerState({}, { ...LOADED, cutAtlas: null }), /no cutAtlas/);
});

test('a link’s exact camera and MRI window ride along as given', () => {
  const orbit = { position: [0, 0, 300], target: [1, 2, 3] };
  const mriWindow = { center: 60, width: 120 };
  const state = readerState({ orbit, mriWindow }, LOADED);
  assert.equal(state.orbit, orbit);
  assert.equal(state.mriWindow, mriWindow);
});

test('an exact camera pose rides along; otherwise the named view frames the scene', () => {
  const pose = { position: [0, 0, 1], target: [0, 0, 0] };
  assert.equal(readerState({ camera: pose }, LOADED).camera, pose);
  assert.equal(readerState({ camera: 'cut' }, LOADED).camera, 'cut');
});

test('hidden sets compare by membership', () => {
  assert.equal(sameRegions(new Set(['a', 'b']), new Set(['b', 'a'])), true);
  assert.equal(sameRegions(new Set(['a']), new Set(['a', 'b'])), false);
  assert.equal(sameRegions(new Set(), new Set()), true);
});

function restorationFixture() {
  const target = readerState({}, LOADED);
  const events = [];
  const model = {
    settings: { ...target },
    state: { selectedRegion: null },
    setInternalSystem(value) { events.push('system'); this.settings.internalSystem = value; },
    setHemisphere(value) { events.push('hemisphere'); this.settings.hemisphere = value; },
    setCortexVisible(value) { this.settings.cortexVisible = value; },
    setInternalVisible(value) { this.settings.internalVisible = value; },
    async setSpinalCordVisible(value) {
      if (value !== this.settings.spinalCordVisible) events.push('cord');
      this.settings.spinalCordVisible = value;
    },
    setCortexOpacity(value) { this.settings.cortexOpacity = value; },
    setFunctionalLevel(value) { events.push('level'); this.settings.functionalLevel = value; },
    loadHiddenRegions(ids) { events.push('hidden'); this.settings.hiddenRegions = new Set(ids); },
    select(id) { events.push('selection'); this.state.selectedRegion = id ? { id } : null; },
    isolate() { events.push('isolation'); this.settings.isolatedRegion = this.state.selectedRegion.id; },
    clearIsolation() { this.settings.isolatedRegion = null; },
  };
  const commands = {
    async loadAtlas(id) { if (id !== model.settings.atlas) { events.push('atlas'); model.settings.atlas = id; } },
    async loadDetail(id) { if (id !== model.settings.detail) { events.push('detail'); model.settings.detail = id; } },
    async applySurfaceColor(value) {
      if (value !== model.settings.surfaceColor) { events.push('color'); model.settings.surfaceColor = value; }
      return true;
    },
    async showSpinalCord(visible) { await model.setSpinalCordVisible(visible); return true; },
    async cut(mode) { await sections.setMode(mode); return true; },
  };
  const sections = {
    state: { cutAtlas: LOADED.cutAtlas }, active: false, offsetRange: [-128, 128],
    async setCutAtlas(value) { events.push('cut-atlas'); this.state.cutAtlas = value; },
    async setMode(mode) { events.push('cut'); this.active = mode !== 'off'; },
    setAngles() { events.push('angles'); },
    setDisplay() { events.push('cut-display'); },
    setOffset(offset) {
      const [minimum, maximum] = this.offsetRange;
      if (offset < minimum || offset > maximum) throw new RangeError(`Cut position must be between ${minimum} and ${maximum} mm.`);
      events.push('cut-position');
    },
    async load() { events.push('mri-load'); },
    setWindow() { events.push('mri-window'); },
  };
  return { target, events, model, sections, commands, current: () => true,
    applyCamera() { events.push('camera'); }, applyOrbit() { events.push('orbit'); },
    revealInTree() { events.push('tree'); } };
}

test('a failed layer is reported with its field, and the rest of the scene still applies', async () => {
  for (const key of ['atlas', 'detail', 'cutAtlas']) {
    const fixture = restorationFixture();
    fixture.target[key] = 'unavailable';
    const failure = new Error(`Requested ${key} unavailable`);
    const owner = key === 'cutAtlas' ? fixture.sections : fixture.commands;
    const method = { atlas: 'loadAtlas', detail: 'loadDetail', cutAtlas: 'setCutAtlas' }[key];
    owner[method] = async () => { throw failure; };
    const failures = await restore(fixture.target, fixture);
    assert.deepEqual(failures, [{ fields: [{ atlas: 'atlas', detail: 'detail', cutAtlas: 'cuts' }[key]], error: failure }]);
    assert.equal(fixture.events.at(-1), 'camera', 'the camera is still framed');
  }
});

test('region, system and camera failures are reported under their own link fields', async () => {
  for (const [key, method, field] of [['selectedRegion', 'select', 'region'],
    ['internalSystem', 'setInternalSystem', 'system'], ['view', 'applyCamera', 'view']]) {
    const fixture = restorationFixture();
    fixture.target[key] = 'unavailable';
    const failure = new Error(`Requested ${key} unavailable`);
    const owner = method === 'applyCamera' ? fixture : fixture.model;
    owner[method] = () => { throw failure; };
    const failures = await restore(fixture.target, fixture);
    assert.deepEqual(failures, [{ fields: [field], error: failure }]);
  }
});

test('a cut position outside the plane’s own range is the one field not applied', async () => {
  const fixture = restorationFixture();
  Object.assign(fixture.target, { cut: 'coronal', cutOffset: 150, selectedRegion: 'region' });
  const failures = await restore(fixture.target, fixture);
  assert.deepEqual(failures.map(({ fields }) => fields), [['pos']]);
  assert.match(failures[0].error.message, /between -128 and 128/);
  assert.deepEqual(fixture.events, ['cut', 'cut-display', 'selection', 'tree', 'camera']);
});

test('a plane that cannot be cut takes its position, angles and side with it', async () => {
  const fixture = restorationFixture();
  Object.assign(fixture.target, { cut: 'axial', cutOffset: 10 });
  fixture.sections.setMode = async () => { throw new Error('Tissue volume unavailable'); };
  const failures = await restore(fixture.target, fixture);
  assert.deepEqual(failures.map(({ fields }) => fields), [['cut', 'tilt', 'az', 'rev', 'pos']]);
  assert.equal(fixture.events.includes('cut-position'), false);
});

test('a restore that a later command overtakes stops applying', async () => {
  const fixture = restorationFixture();
  Object.assign(fixture.target, { atlas: 'hcp-mmp', hemisphere: 'left', selectedRegion: 'region' });
  let live = true;
  fixture.current = () => live;
  fixture.commands.loadAtlas = async () => { live = false; };
  assert.deepEqual(await restore(fixture.target, fixture), []);
  assert.deepEqual(fixture.events, []);
});

test('a scene without an MRI window of its own returns a loaded scan to its published window', async () => {
  const fixture = restorationFixture();
  const windows = [];
  fixture.sections.setWindow = (center, width) => windows.push([center, width]);
  fixture.sections.publishedWindow = { center: 128, width: 256 };
  fixture.sections.display = { windowCenter: 60, windowWidth: 120 };
  await restore(fixture.target, fixture);
  assert.deepEqual(windows, [[128, 256]]);
  fixture.sections.display = { windowCenter: 128, windowWidth: 256 };
  await restore(fixture.target, fixture);
  assert.equal(windows.length, 1, 'a window already published is left alone');
  delete fixture.sections.publishedWindow;
  delete fixture.sections.display;
  await restore(fixture.target, fixture);
  assert.equal(windows.length, 1, 'an unloaded scan is not fetched for nothing');
});

test('startup restoration awaits requested cord anatomy before selection and framing', async () => {
  const fixture = restorationFixture();
  fixture.target.spinalCordVisible = true;
  fixture.target.selectedRegion = 'cord';
  let complete;
  fixture.model.setSpinalCordVisible = () => new Promise(resolve => {
    complete = () => { fixture.model.settings.spinalCordVisible = true; resolve(); };
  });
  const applying = restore(fixture.target, fixture);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(fixture.events, []);
  complete();
  await applying;
  assert.deepEqual(fixture.events, ['selection', 'tree', 'camera']);
});

test('startup restoration preserves layer, display, cut, selection and camera ordering', async () => {
  const fixture = restorationFixture();
  Object.assign(fixture.target, { atlas: 'hcp-mmp', detail: 'aseg', internalSystem: 'Brainstem',
    hemisphere: 'left', spinalCordVisible: true, surfaceColor: 'tissue',
    hiddenRegions: new Set(['hidden']), cutAtlas: 'aseg', cut: 'oblique',
    selectedRegion: 'region', isolatedRegion: 'region',
    mriWindow: { center: 90, width: 180 }, orbit: { position: [0, 0, 300], target: [0, 0, 0] } });
  assert.deepEqual(await restore(fixture.target, fixture), []);
  assert.deepEqual(fixture.events, ['atlas', 'detail', 'system', 'hemisphere', 'cord', 'hidden',
    'color', 'cut-atlas', 'angles', 'cut', 'cut-display', 'cut-position',
    'selection', 'isolation', 'tree', 'mri-load', 'mri-window', 'camera', 'orbit']);
});

test('a scene without the cord hides it even while an earlier showing is still downloading', async () => {
  const fixture = restorationFixture();
  const asked = [];
  // Still downloading, the earlier showing has not yet set the cord visible.
  fixture.commands.showSpinalCord = async visible => { asked.push(visible); return true; };
  await restore(fixture.target, fixture);
  assert.deepEqual(asked, [false], 'asked, so the model drops the showing still on its way');
});
