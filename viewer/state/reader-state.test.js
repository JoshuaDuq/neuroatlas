import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReaderState as restore, readerState, sameRegions } from './reader-state.js';
import { decodeState, encodeState } from './url-state.js';

const LOADED = { atlas: 'destrieux', detail: 'learning', cutAtlas: 'destrieux' };

test('an empty link is the default scene on the loaded layers, with nothing left implicit', () => {
  assert.deepEqual(readerState({}, LOADED), {
    hemisphere: 'both', cortexVisible: true, cortexOpacity: 1, internalVisible: true,
    spinalCordVisible: false, surfaceColor: 'atlas', functionalLevel: 'named', internalSystem: null,
    view: 'oblique', cut: 'off', cutOffset: 0, cutReverse: false, cutTilt: 30, cutAzimuth: 30,
    selectedRegion: null, isolatedRegion: null, ...LOADED, hiddenRegions: new Set(), camera: 'view',
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
  const decoded = decodeState(hash);
  const state = readerState(decoded, LOADED);
  assert.deepEqual(decodeState(encodeState(state)), decoded);
});

test('layers a link does not name stay as loaded; a missing layer is an error, not a guess', () => {
  assert.equal(readerState({ atlas: 'hcp-mmp' }, LOADED).atlas, 'hcp-mmp');
  assert.equal(readerState({}, LOADED).detail, 'learning');
  assert.throws(() => readerState({}, { ...LOADED, cutAtlas: null }), /no cutAtlas/);
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
    async setAtlas(id) { events.push('atlas'); this.settings.atlas = id; },
    async setDetail(id) { events.push('detail'); this.settings.detail = id; },
    setInternalSystem(value) { events.push('system'); this.settings.internalSystem = value; },
    setHemisphere(value) { events.push('hemisphere'); this.settings.hemisphere = value; },
    setCortexVisible(value) { this.settings.cortexVisible = value; },
    setInternalVisible(value) { this.settings.internalVisible = value; },
    async setSpinalCordVisible(value) { events.push('cord'); this.settings.spinalCordVisible = value; },
    setCortexOpacity(value) { this.settings.cortexOpacity = value; },
    setFunctionalLevel(value) { events.push('level'); this.settings.functionalLevel = value; },
    loadHiddenRegions(ids) { events.push('hidden'); this.settings.hiddenRegions = new Set(ids); },
    select(id) { events.push('selection'); this.state.selectedRegion = id ? { id } : null; },
    isolate() { events.push('isolation'); this.settings.isolatedRegion = this.state.selectedRegion.id; },
    clearIsolation() { this.settings.isolatedRegion = null; },
  };
  const sections = {
    state: { cutAtlas: LOADED.cutAtlas }, active: false,
    async setSurfaceColor(value) { events.push('color'); model.settings.surfaceColor = value; },
    async setCutAtlas(value) { events.push('cut-atlas'); this.state.cutAtlas = value; },
    async setMode(mode) { events.push('cut'); this.active = mode !== 'off'; },
    setAngles() { events.push('angles'); },
    setDisplay() { events.push('cut-display'); },
    setOffset() { events.push('cut-position'); },
  };
  return { target, events, model, sections,
    applyCamera() { events.push('camera'); }, revealInTree() { events.push('tree'); } };
}

test('startup restoration propagates requested layer failures', async () => {
  for (const key of ['atlas', 'detail', 'cutAtlas']) {
    const fixture = restorationFixture();
    fixture.target[key] = 'unavailable';
    const failure = new Error(`Requested ${key} unavailable`);
    const owner = key === 'cutAtlas' ? fixture.sections : fixture.model;
    const method = { atlas: 'setAtlas', detail: 'setDetail', cutAtlas: 'setCutAtlas' }[key];
    owner[method] = async () => { throw failure; };
    await assert.rejects(restore(fixture.target, fixture), error => error === failure);
    assert.equal(fixture.events.includes('camera'), false);
  }
});

test('startup restoration propagates region, system and camera failures', async () => {
  for (const [key, method] of [['selectedRegion', 'select'], ['internalSystem', 'setInternalSystem'],
    ['view', 'applyCamera']]) {
    const fixture = restorationFixture();
    fixture.target[key] = 'unavailable';
    const failure = new Error(`Requested ${key} unavailable`);
    const owner = method === 'applyCamera' ? fixture : fixture.model;
    owner[method] = () => { throw failure; };
    await assert.rejects(restore(fixture.target, fixture), error => error === failure);
  }
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
    selectedRegion: 'region', isolatedRegion: 'region' });
  await restore(fixture.target, fixture);
  assert.deepEqual(fixture.events, ['atlas', 'detail', 'system', 'hemisphere', 'cord', 'hidden',
    'color', 'cut-atlas', 'angles', 'cut', 'cut-display', 'cut-position',
    'selection', 'isolation', 'tree', 'camera']);
});
