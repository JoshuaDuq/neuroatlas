import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeState, encodeState } from './url-state.js';

test('a shared dissection link round trips sorted hidden region identifiers', () => {
  const hiddenRegions = new Set(['destrieux:right:18', 'aseg:left:11']);
  const hash = encodeState({ hiddenRegions });
  assert.deepEqual(decodeState(hash).hiddenRegions, ['aseg:left:11', 'destrieux:right:18']);
  assert.equal(encodeState({ hiddenRegions: new Set() }), '');
});

test('MRI appearance survives a shared URL', () => {
  assert.deepEqual(decodeState(encodeState({ surfaceColor: 'mri' })), { surfaceColor: 'mri' });
});

test('a default view produces a bare URL carrying only the atlas', () => {
  assert.equal(encodeState({
    atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1,
    surfaceColor: 'atlas', view: 'oblique', selectedRegion: null, isolatedRegion: null,
  }), 'atlas=destrieux');
});

test('everything that differs from the default survives a round trip', () => {
  const state = {
    atlas: 'hcp-mmp', hemisphere: 'left', cortexVisible: false, cortexOpacity: 0.35,
    surfaceColor: 'network', view: 'superior', selectedRegion: 'aseg:left:11',
    isolatedRegion: 'aseg:left:11',
  };
  assert.deepEqual(decodeState(encodeState(state)), state);
});

test('CAB-NP colours survive a round trip', () => {
  assert.deepEqual(decodeState(encodeState({ surfaceColor: 'cab-np' })), { surfaceColor: 'cab-np' });
});

test('the functional divisions and their level survive a round trip; the named level is the default', () => {
  const state = { surfaceColor: 'functional', functionalLevel: 'sections' };
  assert.equal(encodeState(state), 'colors=functional&level=sections');
  assert.deepEqual(decodeState(encodeState(state)), state);
  assert.equal(encodeState({ surfaceColor: 'functional', functionalLevel: 'named' }), 'colors=functional');
  assert.throws(() => decodeState('level=lobes'), /Invalid URL field level/);
});

test('tissue colors explicitly survive reload over the region default', () => {
  const saved = encodeState({ surfaceColor: 'tissue' });
  assert.equal(saved, 'colors=tissue');
  assert.equal({ surfaceColor: 'atlas', ...decodeState(saved) }.surfaceColor, 'tissue');
});

test('links from when colors was a flag still open with the colouring they meant', () => {
  assert.deepEqual(decodeState('#colors=1'), { surfaceColor: 'atlas' });
  assert.deepEqual(decodeState('#colors=0'), { surfaceColor: 'tissue' });
});

test('a leading hash is accepted, because that is what location.hash gives', () => {
  assert.deepEqual(decodeState('#atlas=destrieux'), { atlas: 'destrieux' });
});

test('empty links and unknown keys carry no scene state', () => {
  for (const hash of ['', '#', '???', '#=&=&', '#%%%%', '#unrelated=1']) {
    assert.deepEqual(decodeState(hash), {}, `${hash} should decode to nothing`);
  }
});

test('invalid known URL fields reject the request and name the field', () => {
  const invalid = {
    anatomy: ['', ' '], atlas: [''], cuts: [''], system: [''], detail: [''],
    region: [''], isolate: [''], view: [''], hemi: ['banana'],
    opacity: ['5', '-0.1', '', ' ', 'NaN', 'Infinity', 'true'],
    cortex: ['maybe'], internal: ['true'], cord: ['2'], colors: ['2', 'true'],
    cut: ['sideways'], pos: ['9999', '', ' '], tilt: ['91'], az: ['181'], rev: ['yes'],
    lang: ['es'],
  };
  for (const [field, values] of Object.entries(invalid)) {
    for (const value of values) {
      assert.throws(() => decodeState(`#${field}=${encodeURIComponent(value)}`),
        new RegExp(field), `${field}=${value} must be rejected`);
    }
  }
  assert.throws(() => decodeState('#atlas'), /atlas/);
});

test('the URL decoder requires a string hash', () => {
  for (const value of [null, 5, {}, []]) assert.throws(() => decodeState(value), /string/i);
});

test('duplicate known fields are ambiguous and reject the request', () => {
  assert.throws(() => decodeState('#opacity=0.2&opacity=0.8'), /opacity/);
});

test('opacity survives at the edges of its range but not beyond', () => {
  assert.equal(decodeState('#opacity=0').cortexOpacity, 0);
  assert.equal(decodeState('#opacity=1').cortexOpacity, 1);
  assert.throws(() => decodeState('#opacity=-0.1'), /opacity/);
});

test('atlas, region and view pass through as opaque strings', () => {
  // url-state cannot know which atlases or regions exist; the session
  // validates those against the manifest and rejects what it does not know.
  const decoded = decodeState('#atlas=made-up&region=not:a:region&view=sideways');
  assert.deepEqual(decoded,
    { atlas: 'made-up', selectedRegion: 'not:a:region', view: 'sideways' });
});

test('region identifiers containing colons are not mangled', () => {
  const encoded = encodeState({ atlas: 'destrieux', selectedRegion: 'destrieux:left:75' });
  assert.equal(decodeState(encoded).selectedRegion, 'destrieux:left:75');
});

test('the selected region encodes by id, even though state holds the object', () => {
  // BrainAtlas.state.selectedRegion is the region record, not its id. Encoding
  // it with String() produced "[object Object]" in the shareable link.
  const encoded = encodeState({
    atlas: 'destrieux',
    selectedRegion: { id: 'destrieux:left:29', label: 'Precentral gyrus' },
  });
  assert.equal(encoded, 'atlas=destrieux&region=destrieux:left:29');
  assert.equal(decodeState(encoded).selectedRegion, 'destrieux:left:29');
});

test('a cut plane survives a shared link, and an uncut brain does not mention one', () => {
  assert.equal(encodeState({ atlas: 'destrieux', cut: 'off' }).includes('cut='), false);
  const sagittal = { atlas: 'destrieux', cut: 'sagittal', cutOffset: 12.5, cutReverse: true };
  assert.deepEqual(decodeState(encodeState(sagittal)), sagittal);
  const oblique = { cut: 'oblique', cutTilt: 10, cutAzimuth: -20 };
  assert.deepEqual(decodeState(encodeState(oblique)), oblique);
  assert.deepEqual(decodeState('#cut=off&pos=-512&tilt=0&az=-180&rev=0'), {
    cut: 'off', cutOffset: -512, cutTilt: 0, cutAzimuth: -180, cutReverse: false,
  });
  assert.deepEqual(decodeState('#pos=512&tilt=90&az=180'), {
    cutOffset: 512, cutTilt: 90, cutAzimuth: 180,
  });
});

test('a system study survives sharing a link', () => {
  const decoded = decodeState(encodeState({ detail: 'learning', internalSystem: 'Basal ganglia' }));
  assert.equal(decoded.detail, 'learning');
  assert.equal(decoded.internalSystem, 'Basal ganglia');
});

test('showing the spinal cord survives sharing a link', () => {
  const encoded = encodeState({ atlas: 'destrieux', spinalCordVisible: true });
  assert.equal(encoded, 'atlas=destrieux&cord=1');
  assert.equal(decodeState(encoded).spinalCordVisible, true);
  assert.equal(decodeState('#atlas=destrieux&cord=0').spinalCordVisible, false);
});

test('hiding internal anatomy survives sharing a link', () => {
  const encoded = encodeState({ atlas: 'destrieux', internalVisible: false });
  assert.equal(encoded, 'atlas=destrieux&internal=0');
  assert.equal(decodeState(encoded).internalVisible, false);
  assert.equal(decodeState('#atlas=destrieux&internal=1').internalVisible, true);
});

test('a default view omits the cord flag, because the cord is off', () => {
  assert.equal(encodeState({ atlas: 'destrieux', spinalCordVisible: false }), 'atlas=destrieux');
});

test('which brain travels in the link', () => {
  // Region ids are shared between brains on purpose: destrieux:left:6 names
  // the same parcel in each. A link that carries the region but not the brain
  // therefore opens the right region on someone else's anatomy.
  const encoded = encodeState({
    atlas: 'destrieux', anatomy: 'aomic', selectedRegion: 'destrieux:left:6',
  });
  assert.ok(encoded.includes('anatomy=aomic'));
  const back = decodeState(encoded);
  assert.equal(back.anatomy, 'aomic');
  assert.equal(back.selectedRegion, 'destrieux:left:6');
});

test('a link naming no brain leaves the choice to the published default', () => {
  // Undefined, not a guess: the index decides, and it is read before anything
  // of a brain is fetched.
  assert.equal(decodeState('#atlas=destrieux').anatomy, undefined);
  assert.ok(!encodeState({ atlas: 'destrieux' }).includes('anatomy'));
});

test('a supplied language survives serialization even when English is active', () => {
  for (const lang of ['en', 'fr']) {
    const hash = encodeState({ atlas: 'destrieux', lang });
    assert.equal(hash, `atlas=destrieux&lang=${lang}`);
    assert.equal(decodeState(hash).lang, lang);
  }
});

test('an absent language is omitted so startup can use the saved preference', () => {
  for (const state of [{}, { lang: undefined }, { lang: null }]) {
    assert.equal(encodeState({ atlas: 'destrieux', ...state }), 'atlas=destrieux');
  }
});
