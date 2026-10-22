import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLink } from './link-check.js';
import { decodeState } from './url-state.js';
import { publishesSpinalCord } from './scene-commands.js';

const known = {
  atlases: new Set(['destrieux', 'hcp-mmp']),
  details: new Set(['aseg', 'nextbrain', 'learning']),
  cutAtlases: new Set(['destrieux', 'hcp-mmp', 'nextbrain']),
  views: new Set(['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior']),
  explorers: new Set(['anatomy', 'deficits', 'circuits', 'diffusion']),
  surfaceColors: new Set(['tissue', 'mri', 'atlas', 'network', 'cab-np']),
  regions: new Map([
    ['destrieux:left:29', { kind: 'cortex' }],
    ['aseg:left:17', { kind: 'structure' }],
    ['destrieux:left:medial-wall', { kind: 'non-region' }],
  ]),
  deficits: new Set(['aphasia']),
  circuits: new Map([['visual', 4]]),
  spinalCord: true,
};

const check = hash => checkLink(decodeState(hash).state, known);

test('a link naming only what this anatomy publishes passes whole', () => {
  const hash = '#atlas=hcp-mmp&detail=aseg&cuts=nextbrain&view=left&colors=cab-np&region=destrieux:left:29'
    + '&isolate=aseg:left:17&hidden=destrieux:left:medial-wall&tab=circuits&deficit=aphasia&circuit=visual&step=4';
  const { state, rejected } = check(hash);
  assert.deepEqual(rejected, []);
  assert.deepEqual(state, decodeState(hash).state);
});

test('each unknown name is dropped and reported under its link parameter', () => {
  const { state, rejected } = check('#atlas=yeo&detail=fine&cuts=x&view=Left&colors=functional&region=nope'
    + '&isolate=destrieux:left:medial-wall&hidden=aseg:left:17,nope&tab=diffusion&deficit=x&circuit=y&step=2&hemi=left');
  assert.deepEqual(rejected, ['atlas', 'detail', 'cuts', 'view', 'colors', 'region', 'isolate', 'hidden',
    'deficit', 'circuit', 'step']);
  assert.deepEqual(state, { explorer: 'diffusion', hemisphere: 'left' });
});

test('a lesson step must exist in its circuit', () => {
  assert.deepEqual(check('#circuit=visual&step=5').rejected, ['step']);
  assert.deepEqual(check('#step=2').rejected, ['step']);
  assert.equal(check('#circuit=visual&step=4').state.circuitStep, 3);
});

test('the cord field is not applied where the subject publishes no cord; hiding it always is', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../../public/models/bert/manifest.json', import.meta.url)));
  // A subject whose scan ends inside the medulla publishes no cord layer.
  const cordless = { ...manifest, supplemental_layers: (manifest.supplemental_layers ?? []).filter(layer => layer.id !== 'zanatomy') };
  assert.equal(publishesSpinalCord(manifest), true);
  const spinalCord = publishesSpinalCord(cordless);
  assert.equal(spinalCord, false);
  const { state, rejected } = checkLink(decodeState('#cord=1&hemi=left').state, { ...known, spinalCord });
  assert.deepEqual(rejected, ['cord']);
  assert.deepEqual(state, { hemisphere: 'left' });
  assert.deepEqual(checkLink(decodeState('#cord=0').state, { ...known, spinalCord }).rejected, []);
  assert.deepEqual(checkLink(decodeState('#cord=1').state, known).rejected, []);
});
