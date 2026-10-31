import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson, readRepoYaml } from '../../../../test/repo.ts';
import type { CircuitData } from '../learning/catalog.ts';
import type { Manifest } from '../../types/index.ts';
import { checkLink, type KnownLinkIds } from './link-check.ts';
import { decodeState } from './url-state.ts';
import { publishesSpinalCord } from './scene-commands.ts';

const known: KnownLinkIds = {
  atlases: new Set(['destrieux', 'hcp-mmp']),
  details: new Set(['aseg', 'nextbrain', 'learning']),
  cutAtlases: new Set(['destrieux', 'hcp-mmp', 'nextbrain']),
  views: new Set(['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior']),
  explorers: new Set(['anatomy', 'functions', 'deficits', 'circuits', 'diffusion']),
  // A build without Yeo 7 networks: `network` decodes but is not published.
  surfaceColors: new Set(['tissue', 'mri', 'atlas', 'cab-np']),
  regions: new Map([
    ['destrieux:left:29', { kind: 'cortex' }],
    ['aseg:left:17', { kind: 'structure' }],
    ['destrieux:left:medial-wall', { kind: 'non-region' }],
  ]),
  functions: new Set(['all', 'language']),
  deficits: new Set(['aphasia']),
  circuits: new Map([['visual', 4]]),
  spinalCord: true,
  // The left bundle while the sphere reaches the left of the midline.
  lesionBundles: ({ centre: [x], radius }) => (x - radius < 0 ? ['af-left'] : []),
};

const check = (hash: string) => checkLink(decodeState(hash).state, known);

test('a link naming only what this anatomy publishes passes whole', () => {
  const hash =
    '#atlas=hcp-mmp&detail=aseg&cuts=nextbrain&view=left&colors=cab-np&region=destrieux:left:29' +
    '&isolate=aseg:left:17&hidden=destrieux:left:medial-wall&tab=circuits&function=language&deficit=aphasia&circuit=visual&step=4';
  const { state, rejected } = check(hash);
  assert.deepEqual(rejected, []);
  assert.deepEqual(state, decodeState(hash).state);
});

test('each unknown name is dropped and reported under its link parameter', () => {
  const { state, rejected } = check(
    '#atlas=yeo&detail=fine&cuts=x&view=Left&colors=network&region=nope' +
      '&isolate=destrieux:left:medial-wall&hidden=aseg:left:17,nope&tab=diffusion&function=praxis&deficit=x&circuit=y&step=2&hemi=left',
  );
  assert.deepEqual(rejected, [
    'atlas',
    'detail',
    'cuts',
    'view',
    'colors',
    'region',
    'isolate',
    'hidden',
    'function',
    'deficit',
    'circuit',
    'step',
  ]);
  assert.deepEqual(state, { explorer: 'diffusion', hemisphere: 'left' });
});

test('a lesson step must exist in its circuit', () => {
  assert.deepEqual(check('#circuit=visual&step=5').rejected, ['step']);
  assert.deepEqual(check('#step=2').rejected, ['step']);
  assert.equal(check('#circuit=visual&step=4').state.circuitStep, 3);
});

test('links to withdrawn tours reject only the circuit and step while retained pathway links still work', () => {
  const active = readRepoYaml<CircuitData>('data/circuits.yaml');
  const archived = readRepoYaml<CircuitData>('data/archived-circuit-tours.yaml');
  const published = {
    ...known,
    circuits: new Map(active.circuits.map((circuit) => [circuit.id, circuit.steps.length])),
  };
  for (const circuit of archived.circuits) {
    const link = decodeState(`#tab=circuits&circuit=${circuit.id}&step=1&lang=fr`).state;
    const result = checkLink(link, published);
    assert.deepEqual(result.rejected, ['circuit', 'step'], circuit.id);
    assert.deepEqual(result.state, { explorer: 'circuits', lang: 'fr' });
  }
  for (const circuit of active.circuits) {
    const link = decodeState(`#tab=circuits&circuit=${circuit.id}&step=1`).state;
    assert.deepEqual(checkLink(link, published), { state: link, rejected: [] });
  }
});

test('the cord field is not applied where the subject publishes no cord; hiding it always is', () => {
  const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
  // A subject whose scan ends inside the medulla publishes no cord layer.
  const cordless = {
    ...manifest,
    supplemental_layers: (manifest.supplemental_layers ?? []).filter(
      (layer) => layer.id !== 'pam50',
    ),
  };
  assert.equal(publishesSpinalCord(manifest), true);
  const spinalCord = publishesSpinalCord(cordless);
  assert.equal(spinalCord, false);
  const { state, rejected } = checkLink(decodeState('#cord=1&hemi=left').state, {
    ...known,
    spinalCord,
  });
  assert.deepEqual(rejected, ['cord']);
  assert.deepEqual(state, { hemisphere: 'left' });
  assert.deepEqual(checkLink(decodeState('#cord=0').state, { ...known, spinalCord }).rejected, []);
  assert.deepEqual(checkLink(decodeState('#cord=1').state, known).rejected, []);
});

test('a lesion’s colouring and drawn tract need the lesion, and the tract one it reaches', () => {
  assert.deepEqual(
    check('lesion=-30,0,10,8&lesionmode=functions&lesiontract=af-left').rejected,
    [],
  );
  assert.deepEqual(check('lesion=30,0,10,8&lesiontract=af-left').rejected, ['lesiontract']);
  const orphan = check('lesionmode=functions&lesiontract=af-left');
  assert.deepEqual(orphan.rejected, ['lesionmode', 'lesiontract']);
  assert.deepEqual(orphan.state, {});
});
