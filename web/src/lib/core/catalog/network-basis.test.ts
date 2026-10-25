/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest } from '../../types/index.ts';
import * as networks from './networks.ts';
import { anatomies, readModel } from './test-support.ts';

// The legacy file's third test (both languages explain the denominator and the 5 % threshold)
// reads `t('en' | 'fr', 'networks')` from i18n, which C1 owns; C1's tests carry it.

test('cortical surfaces and projected NextBrain compositions declare their different samples', () => {
  assert.equal(networks.networkBasis({ atlas: 'destrieux', kind: 'cortex' }), 'vertices');
  assert.equal(networks.networkBasis({ atlas: 'hcp-mmp', kind: 'cortex' }), 'vertices');
  assert.equal(networks.networkBasis({ atlas: 'nextbrain', kind: 'tissue-region' }), 'voxels');
  assert.throws(() => networks.networkBasis({ atlas: 'unknown', kind: 'unknown' }), /basis/);
});

test('every published composition has a supported measurement basis', () => {
  for (const anatomy of anatomies.anatomies) {
    const manifest = readModel<Manifest>(`${anatomy.id}/manifest.json`);
    for (const region of manifest.regions.filter((region) => region.networks?.length)) {
      assert.ok(['vertices', 'voxels'].includes(networks.networkBasis(region)), region.id);
    }
  }
});
