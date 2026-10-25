import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import { cutAtlasesOf } from '../catalog/visibility.ts';
import {
  groupDisplayName,
  labelledGroups,
  matchedAlias,
  matchesElsewhere,
  matchSegments,
  nextEnabledIndex,
  regionGroup,
  rowStatesReason,
  sectionReasons,
  sharedGroupNames,
  visibilityStateOf,
  vocabularyOf,
} from './navigator.ts';

const region = (fields: Partial<Region>) => fields as Region;

test('an arrow moves past a row that cannot be chosen', () => {
  assert.equal(nextEnabledIndex([false, true, false], 0, 1), 2);
  assert.equal(nextEnabledIndex([false, true, false], 2, -1), 0);
});

test('an arrow at the end of the list leaves the armed row where it is', () => {
  assert.equal(nextEnabledIndex([false, true], 0, 1), 0);
  assert.equal(nextEnabledIndex([true, false], 1, 1), 1);
  assert.equal(nextEnabledIndex([false], 0, -1), 0);
});

test('the first arrow from an empty field lands on the first choosable row', () => {
  assert.equal(nextEnabledIndex([true, false, false], -1, 1), 1);
});

test('an eye is shown, hidden, or partial, so a group with hidden parts stays in view', () => {
  const hidden = new Set(['a', 'b']);
  assert.equal(visibilityStateOf(['c'], hidden), 'shown');
  assert.equal(visibilityStateOf(['a', 'b'], hidden), 'hidden');
  assert.equal(visibilityStateOf(['a', 'c'], hidden), 'partial');
});

const lobe = region({ kind: 'cortex', atlas: 'destrieux' });
const network = region({ kind: 'cortex', atlas: 'hcp-mmp' });
const structure = region({ kind: 'structure', atlas: 'learning' });
const group = (name: string, rows: Region) => ({ name, kind: 'cortex', rows: [{ region: rows }] });

test('a group name says which vocabulary it is from only when two vocabularies share it', () => {
  assert.equal(vocabularyOf(lobe), 'lobe');
  assert.equal(vocabularyOf(network), 'network');
  assert.equal(vocabularyOf(structure), 'system');
  assert.equal(vocabularyOf(region({ kind: 'tissue-region', atlas: 'nextbrain' })), 'system');
  const shared = sharedGroupNames([
    group('Limbic', lobe),
    group('Frontal', lobe),
    group('Limbic', structure),
    group('Brainstem', structure),
  ]);
  assert.deepEqual([...shared], ['Limbic']);
  assert.equal(groupDisplayName('Limbic', lobe, shared, 'en'), 'Limbic lobe');
  assert.equal(groupDisplayName('Limbic', network, shared, 'en'), 'Limbic network');
  assert.equal(groupDisplayName('Limbic', structure, shared, 'en'), 'Limbic system');
  assert.equal(groupDisplayName('Frontal', lobe, shared, 'en'), 'Frontal');
  assert.equal(groupDisplayName('Limbique', lobe, new Set(['Limbique']), 'fr'), 'Lobe limbique');
  assert.equal(
    groupDisplayName('Limbique', structure, new Set(['Limbique']), 'fr'),
    'Système limbique',
  );
});

test('two families in one vocabulary keep their names', () => {
  const tissue = region({ kind: 'tissue-region', atlas: 'nextbrain' });
  assert.equal(sharedGroupNames([group('Limbic', structure), group('Limbic', tissue)]).size, 0);
});

test('a qualified name is sorted by what the list shows, within its family', () => {
  const groups = [
    { ...group('Insula', lobe), kind: 'cortex' },
    { ...group('Limbique', lobe), kind: 'cortex' },
    { ...group('Cervelet', structure), kind: 'structure' },
    { ...group('Limbique', structure), kind: 'structure' },
    { ...group('Tronc cérébral', structure), kind: 'structure' },
  ];
  assert.deepEqual(
    labelledGroups(groups, 'fr').map((entry) => entry.label),
    ['Insula', 'Lobe limbique', 'Cervelet', 'Système limbique', 'Tronc cérébral'],
  );
});

test("a region's group is the one the tree lists it under, qualified as the tree shows it", () => {
  const row = (id: string, fields: Region) => ({ region: { ...fields, id } });
  const groups = [
    { name: 'Limbic', key: 'cortex:Limbic', kind: 'cortex', rows: [row('a', lobe)] },
    {
      name: 'Frontal',
      key: 'cortex:Frontal',
      kind: 'cortex',
      rows: [row('b', lobe), row('c', lobe)],
    },
    { name: 'Limbic', key: 'structure:Limbic', kind: 'structure', rows: [row('d', structure)] },
  ];
  assert.deepEqual(regionGroup(groups, 'c', 'en'), { key: 'cortex:Frontal', label: 'Frontal' });
  assert.deepEqual(regionGroup(groups, 'a', 'en'), { key: 'cortex:Limbic', label: 'Limbic lobe' });
  assert.deepEqual(regionGroup(groups, 'd', 'en'), {
    key: 'structure:Limbic',
    label: 'Limbic system',
  });
  assert.equal(regionGroup(groups, 'elsewhere', 'en'), null);
});

test('a match in another cut atlas offers the cut atlas that draws it, not merely another one', () => {
  const cutAtlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }, { id: 'nextbrain' }];
  const row = (id: string, fields: Partial<Region>) => ({
    region: region({ id, kind: 'tissue-region', ...fields }),
  });
  const histological = row('nb', { atlas: 'nextbrain' });
  const gyral = row('wm', { atlas: 'wmparc', cut_atlases: ['destrieux', 'hcp-mmp'] });
  const offered = (rows: (typeof histological)[], current: string) =>
    matchesElsewhere(rows, cutAtlases, current, cutAtlasesOf).map(({ atlas, rows: drawn }) => [
      atlas.id,
      drawn.map((entry) => entry.region.id),
    ]);
  assert.deepEqual(offered([histological], 'destrieux'), [['nextbrain', ['nb']]]);
  assert.deepEqual(offered([histological], 'hcp-mmp'), [['nextbrain', ['nb']]]);
  assert.deepEqual(offered([gyral], 'nextbrain'), [['destrieux', ['wm']]]);
  assert.throws(
    () => matchesElsewhere([histological], cutAtlases.slice(0, 2), 'destrieux', cutAtlasesOf),
    /No other atlas draws nb/,
  );
});

test('a match in another surface atlas offers that atlas', () => {
  const atlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }];
  const rows = [{ region: region({ id: 'v1', atlas: 'hcp-mmp' }) }];
  assert.deepEqual(
    matchesElsewhere(rows, atlases, 'destrieux', (found) => [found.atlas]).map(
      ({ atlas }) => atlas.id,
    ),
    ['hcp-mmp'],
  );
});

const shown = { visible: true, reason: null };
const hiddenBy = (reason: string) => ({ visible: false, reason });

test('a setting that hides rows is said once per section, in the order met', () => {
  const said = sectionReasons([
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('cortex-hidden')] },
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('hemisphere')] },
    { kind: 'structure', rows: [shown, hiddenBy('removed'), hiddenBy('no-mri')] },
    { kind: 'tissue', rows: [hiddenBy('no-cut')] },
  ]);
  assert.deepEqual(
    [...said],
    [
      ['cortex', ['cortex-hidden', 'hemisphere']],
      ['tissue', ['no-cut']],
    ],
  );
});

test('a hidden row prints only a reason of its own', () => {
  assert.equal(rowStatesReason(shown), false);
  assert.equal(rowStatesReason(hiddenBy('hemisphere')), false, 'the caption says it');
  assert.equal(rowStatesReason(hiddenBy('removed')), false, 'the struck eye says it');
  assert.equal(rowStatesReason(hiddenBy('no-mri')), true);
  assert.equal(rowStatesReason(hiddenBy('below-cut-resolution')), true);
});

test('a match is marked in the name without regard to case or accents', () => {
  assert.deepEqual(matchSegments('Gyrus cingulaire', 'CINGU'), [
    { text: 'Gyrus ', match: false },
    { text: 'cingu', match: true },
    { text: 'laire', match: false },
  ]);
  assert.deepEqual(matchSegments('Écorce', 'eco'), [
    { text: 'Éco', match: true },
    { text: 'rce', match: false },
  ]);
  assert.deepEqual(matchSegments('Insula', 'insula'), [{ text: 'Insula', match: true }]);
});

test('a name with no match, or no query, is one unmarked segment', () => {
  assert.deepEqual(matchSegments('Insula', 'zz'), [{ text: 'Insula', match: false }]);
  assert.deepEqual(matchSegments('Insula', ''), [{ text: 'Insula', match: false }]);
});

test('a row explains a match its name does not hold with its code, then its first alias', () => {
  const label = {
    name: 'Primary visual cortex',
    code: 'V1',
    aliases: ['striate cortex', 'area 17'],
  };
  assert.equal(matchedAlias(label, 'v1'), 'V1');
  assert.equal(matchedAlias(label, 'striate'), 'striate cortex');
  assert.equal(matchedAlias(label, 'area'), 'area 17');
  assert.equal(matchedAlias(label, 'visual'), null, 'the name holds it');
  assert.equal(matchedAlias(label, 'zz'), null);
  assert.equal(
    matchedAlias({ name: 'Insula', code: null, aliases: ['Île de Reil'] }, 'ile'),
    'Île de Reil',
  );
});

test('a decomposed query or name marks the same span as a composed one', () => {
  const composed = [
    { text: 'Cortex ', match: false },
    { text: 'cérébel', match: true },
    { text: 'leux', match: false },
  ];
  const nfd = (text: string) => text.normalize('NFD');
  assert.deepEqual(matchSegments('Cortex cérébelleux', nfd('cérébel')), composed);
  assert.deepEqual(matchSegments(nfd('Cortex cérébelleux'), 'cerebel'), [
    { text: 'Cortex ', match: false },
    { text: nfd('cérébel'), match: true },
    { text: 'leux', match: false },
  ]);
  assert.deepEqual(matchSegments(nfd('Cortex cérébelleux'), nfd('cérébel')), [
    composed[0],
    { text: nfd('cérébel'), match: true },
    composed[2],
  ]);
});
