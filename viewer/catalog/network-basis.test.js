import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as networks from './networks.js';
import { t } from '../i18n/translations.js';

test('cortical surfaces and projected NextBrain compositions declare their different samples', () => {
  assert.equal(networks.networkBasis({ atlas: 'destrieux', kind: 'cortex' }), 'vertices');
  assert.equal(networks.networkBasis({ atlas: 'hcp-mmp', kind: 'cortex' }), 'vertices');
  assert.equal(networks.networkBasis({ atlas: 'nextbrain', kind: 'tissue-region' }), 'voxels');
  assert.throws(() => networks.networkBasis({ atlas: 'unknown', kind: 'unknown' }), /basis/);
});

test('every published composition has a supported measurement basis', () => {
  const index = JSON.parse(readFileSync(new URL('../../public/models/anatomies.json', import.meta.url)));
  for (const anatomy of index.anatomies) {
    const manifest = JSON.parse(readFileSync(new URL(
      `../../public/models/${anatomy.id}/manifest.json`, import.meta.url,
    )));
    for (const region of manifest.regions.filter(region => region.networks?.length)) {
      assert.ok(['vertices', 'voxels'].includes(networks.networkBasis(region)), region.id);
    }
  }
});

test('both languages explain the actual denominator and the display threshold', () => {
  const english = t('en', 'networks');
  const french = t('fr', 'networks');
  assert.match(english.notes.vertices, /vertices/);
  assert.match(english.notes.voxels, /voxels/);
  assert.match(french.notes.vertices, /sommets/);
  assert.match(french.notes.voxels, /voxels/);
  for (const notes of [english.notes, french.notes]) {
    for (const note of Object.values(notes)) assert.match(note, /5\s?%/);
  }
});
