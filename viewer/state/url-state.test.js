import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeState, encodeState } from './url-state.js';

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

test('tissue colors explicitly survive reload over the region default', () => {
  const saved = encodeState({ surfaceColor: 'tissue' });
  assert.equal(saved, 'colors=tissue');
  assert.equal({ surfaceColor: 'atlas', ...decodeState(saved) }.surfaceColor, 'tissue');
});

test('a leading hash is accepted, because that is what location.hash gives', () => {
  assert.deepEqual(decodeState('#atlas=destrieux'), { atlas: 'destrieux' });
});

test('malformed input yields nothing instead of throwing', () => {
  for (const hash of ['', '#', '???', '#=&=&', 'atlas', '#%%%%']) {
    assert.deepEqual(decodeState(hash), {}, `${hash} should decode to nothing`);
  }
});

test('out-of-range and unknown values are dropped one by one', () => {
  const decoded = decodeState(
    '#atlas=destrieux&hemi=banana&opacity=5&cortex=maybe&colors=2&nonsense=1');
  assert.deepEqual(decoded, { atlas: 'destrieux' });
});

test('opacity survives at the edges of its range but not beyond', () => {
  assert.equal(decodeState('#opacity=0').cortexOpacity, 0);
  assert.equal(decodeState('#opacity=1').cortexOpacity, 1);
  assert.equal(decodeState('#opacity=-0.1').cortexOpacity, undefined);
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
