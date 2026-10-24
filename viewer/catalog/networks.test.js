import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';

import {
  MINIMUM_SHARE, cabNpName, dominantNetwork, networkName, networksOf, validateCabNp,
} from './networks.js';
import { labelOf } from './labels.js';

const region = networks => ({ networks });

test('published abbreviations resolve to their spelled-out names', () => {
  assert.equal(networkName('SomMot'), 'Somatomotor');
  assert.equal(networkName('SomMot', 'fr'), 'Somatomoteur');
  assert.equal(networkName('Default', 'fr'), 'Mode par défaut');
});

test('an unknown key is shown rather than dropped', () => {
  assert.equal(networkName('Invented'), 'Invented');
});

test('a language with no table falls back to the published English name', () => {
  assert.equal(networkName('Cont', 'de'), 'Frontoparietal control');
});

test('shares below the display threshold are hidden, and the rest are not rescaled', () => {
  const shares = networksOf(region([
    { network: 'SomMot', fraction: 0.75 },
    { network: 'DorsAttn', fraction: 0.21 },
    { network: 'Default', fraction: 0.04 },
  ]));
  assert.deepEqual(shares.map(s => s.network), ['SomMot', 'DorsAttn']);
  assert.equal(shares.reduce((total, s) => total + s.fraction, 0), 0.96);
});

test('a share exactly at the minimum is kept', () => {
  const shares = networksOf(region([{ network: 'Vis', fraction: MINIMUM_SHARE }]));
  assert.equal(shares.length, 1);
});

test('a region the build carried no networks for reports none', () => {
  assert.deepEqual(networksOf({}), []);
  assert.deepEqual(networksOf(undefined), []);
  assert.equal(dominantNetwork({}), null);
});

test('the dominant network is the largest share that survived the minimum', () => {
  assert.equal(dominantNetwork(region([
    { network: 'Limbic', fraction: 0.6 },
    { network: 'Vis', fraction: 0.4 },
  ])), 'Limbic');
});

test('a region whose shares are all below threshold has no displayed dominant network', () => {
  assert.equal(dominantNetwork(region([{ network: 'Vis', fraction: 0.01 }])), null);
});

test('HCP-MMP areas group by the network they mostly fall in', () => {
  const area = {
    atlas: 'hcp-mmp',
    kind: 'cortex',
    source_name: 'L_V1_ROI',
    networks: [{ network: 'Vis', fraction: 1 }],
  };
  assert.deepEqual(labelOf(area), {
    name: 'V1', code: 'V1', group: 'Visual', aliases: [],
  });
  assert.equal(labelOf(area, 'fr').group, 'Visuel');
});

test('an HCP-MMP area with no network keeps an alphabetical bucket', () => {
  const area = { atlas: 'hcp-mmp', kind: 'cortex', source_name: 'L_V1_ROI' };
  assert.equal(labelOf(area).group, 'V–Z');
});

test('Destrieux keeps its lobes: a fold is named by where it is', () => {
  const gyrus = {
    atlas: 'destrieux',
    kind: 'cortex',
    source_name: 'G_precentral',
    networks: [{ network: 'SomMot', fraction: 0.75 }],
  };
  assert.equal(labelOf(gyrus).group, 'Frontal');
});

test('CAB-NP networks read as Ji et al. name them, in both languages', () => {
  assert.equal(cabNpName('Visual1'), 'Primary visual');
  assert.equal(cabNpName('Orbito-Affective', 'fr'), 'Orbito-affectif');
  assert.throws(() => cabNpName('Invented'), /Unknown CAB-NP network: Invented/);
});

test('the published partition names every network the viewer can name', () => {
  const partition = JSON.parse(readFileSync(
    new URL('../../public/models/cdmd/cab-np.json', import.meta.url), 'utf8'));
  for (const network of partition.networks) {
    assert.ok(cabNpName(network, 'en') && cabNpName(network, 'fr'));
  }
});

test('a CAB-NP network without a colour is rejected', () => {
  const regions = new Map([['hcp-mmp:left:1', { atlas: 'hcp-mmp' }]]);
  const partition = { id: 'cab-np', atlas: 'hcp-mmp', networks: ['Default'], colors: {},
    regions: { 'hcp-mmp:left:1': 'Default' } };
  assert.throws(() => validateCabNp(partition, regions), /has no colour: Default/);
  partition.colors.Default = [255, 0, 0];
  assert.equal(validateCabNp(partition, regions), partition);
  partition.regions['hcp-mmp:left:1'] = 'Visual1';
  assert.throws(() => validateCabNp(partition, regions), /Invalid CAB-NP assignment/);
});
