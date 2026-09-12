import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeState, encodeState } from './url-state.js';

test('a default view produces a bare URL carrying only the atlas', () => {
  assert.equal(encodeState({
    atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1,
    surfaceColor: 'tissue', view: 'oblique', selectedRegion: null, isolatedRegion: null,
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

test('atlas colors explicitly survive reload over the neutral default', () => {
  const saved = encodeState({ surfaceColor: 'atlas' });
  assert.equal(saved, 'colors=atlas');
  assert.equal({ surfaceColor: 'tissue', ...decodeState(saved) }.surfaceColor, 'atlas');
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
