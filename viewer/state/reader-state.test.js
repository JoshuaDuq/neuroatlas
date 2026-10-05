import assert from 'node:assert/strict';
import test from 'node:test';
import { readerState, sameRegions } from './reader-state.js';
import { decodeState, encodeState } from './url-state.js';

const LOADED = { atlas: 'destrieux', detail: 'learning', cutAtlas: 'destrieux' };

test('an empty link is the default scene on the loaded layers, with nothing left implicit', () => {
  assert.deepEqual(readerState({}, LOADED), {
    hemisphere: 'both', cortexVisible: true, cortexOpacity: 1, internalVisible: true,
    spinalCordVisible: false, surfaceColor: 'atlas', internalSystem: null, view: 'oblique',
    cut: 'off', cutOffset: 0, cutReverse: false, cutTilt: 30, cutAzimuth: 30,
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
