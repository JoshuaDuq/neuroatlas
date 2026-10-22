import assert from 'node:assert/strict';
import test from 'node:test';
import {
  controlKeyAction, groupDisplayName, labelledGroups, matchesElsewhere, nextEnabledIndex, regionGroup,
  rowStatesReason, sectionReasons, sharedGroupNames, treeKeyAction, vocabularyOf,
} from './navigator.js';
import { cutAtlasesOf } from '../../catalog/visibility.js';
import { visibilityStateOf } from './visibility-control.js';

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

const closed = { group: true, expanded: false };
const open = { group: true, expanded: true };
const leaf = { group: false, expanded: false };

test('the tree moves by row, and Home and End reach its ends', () => {
  for (const row of [closed, open, leaf]) {
    assert.equal(treeKeyAction('ArrowDown', row), 'next');
    assert.equal(treeKeyAction('ArrowUp', row), 'previous');
    assert.equal(treeKeyAction('Home', row), 'first');
    assert.equal(treeKeyAction('End', row), 'last');
    assert.equal(treeKeyAction('Enter', row), 'activate');
    assert.equal(treeKeyAction(' ', row), 'activate');
  }
});

test('right opens a group, then enters it; left closes it', () => {
  assert.equal(treeKeyAction('ArrowRight', closed), 'expand');
  assert.equal(treeKeyAction('ArrowRight', open), 'child');
  assert.equal(treeKeyAction('ArrowLeft', open), 'collapse');
  assert.equal(treeKeyAction('ArrowLeft', closed), null);
});

test('on a region, right reaches its eye control and left its group', () => {
  assert.equal(treeKeyAction('ArrowRight', leaf), 'controls');
  assert.equal(treeKeyAction('ArrowLeft', leaf), 'parent');
});

test('V hides or shows the focused row, whatever its kind', () => {
  for (const row of [closed, open, leaf]) {
    assert.equal(treeKeyAction('v', row), 'visibility');
    assert.equal(treeKeyAction('V', row), 'visibility');
  }
  assert.equal(treeKeyAction('x', leaf), null);
});

test('eye controls step sideways and hand back to their row', () => {
  const only = { first: true, last: true };
  const middle = { first: false, last: false };
  assert.equal(controlKeyAction('ArrowLeft', only), 'row');
  assert.equal(controlKeyAction('ArrowRight', only), null);
  assert.equal(controlKeyAction('ArrowLeft', middle), 'previousControl');
  assert.equal(controlKeyAction('ArrowRight', middle), 'nextControl');
  assert.equal(controlKeyAction('Escape', middle), 'row');
  assert.equal(controlKeyAction('ArrowDown', middle), 'next');
  assert.equal(controlKeyAction('ArrowUp', middle), 'previous');
  // The button activates itself.
  assert.equal(controlKeyAction('Enter', middle), null);
  assert.equal(controlKeyAction(' ', middle), null);
});

test('an eye is shown, hidden, or partial, so a group with hidden parts stays in view', () => {
  const hidden = new Set(['a', 'b']);
  assert.equal(visibilityStateOf(['c'], hidden), 'shown');
  assert.equal(visibilityStateOf(['a', 'b'], hidden), 'hidden');
  assert.equal(visibilityStateOf(['a', 'c'], hidden), 'partial');
});

const lobe = { kind: 'cortex', atlas: 'destrieux' };
const network = { kind: 'cortex', atlas: 'hcp-mmp' };
const structure = { kind: 'structure', atlas: 'learning' };
const group = (name, region) => ({ name, rows: [{ region }] });

test('a group name says which vocabulary it is from only when two vocabularies share it', () => {
  assert.equal(vocabularyOf(lobe), 'lobe');
  assert.equal(vocabularyOf(network), 'network');
  assert.equal(vocabularyOf(structure), 'system');
  assert.equal(vocabularyOf({ kind: 'tissue-region', atlas: 'nextbrain' }), 'system');
  const shared = sharedGroupNames([
    group('Limbic', lobe), group('Frontal', lobe), group('Limbic', structure), group('Brainstem', structure),
  ]);
  assert.deepEqual([...shared], ['Limbic']);
  assert.equal(groupDisplayName('Limbic', lobe, shared, 'en'), 'Limbic lobe');
  assert.equal(groupDisplayName('Limbic', network, shared, 'en'), 'Limbic network');
  assert.equal(groupDisplayName('Limbic', structure, shared, 'en'), 'Limbic system');
  assert.equal(groupDisplayName('Frontal', lobe, shared, 'en'), 'Frontal');
  assert.equal(groupDisplayName('Limbique', lobe, new Set(['Limbique']), 'fr'), 'Lobe limbique');
  assert.equal(groupDisplayName('Limbique', structure, new Set(['Limbique']), 'fr'), 'Système limbique');
});

test('two families in one vocabulary keep their names', () => {
  const tissue = { kind: 'tissue-region', atlas: 'nextbrain' };
  assert.equal(sharedGroupNames([group('Limbic', structure), group('Limbic', tissue)]).size, 0);
});

test('a qualified name is sorted by what the list shows, within its family', () => {
  const lobeFr = { kind: 'cortex', atlas: 'destrieux' };
  const groups = [
    { ...group('Insula', lobeFr), kind: 'cortex' }, { ...group('Limbique', lobeFr), kind: 'cortex' },
    { ...group('Cervelet', structure), kind: 'structure' }, { ...group('Limbique', structure), kind: 'structure' },
    { ...group('Tronc cérébral', structure), kind: 'structure' },
  ];
  assert.deepEqual(labelledGroups(groups, 'fr').map(entry => entry.label),
    ['Insula', 'Lobe limbique', 'Cervelet', 'Système limbique', 'Tronc cérébral']);
});

test('a region\'s group is the one the tree lists it under, qualified as the tree shows it', () => {
  const row = (id, region) => ({ region: { ...region, id } });
  const groups = [
    { name: 'Limbic', key: 'cortex:Limbic', kind: 'cortex', rows: [row('a', lobe)] },
    { name: 'Frontal', key: 'cortex:Frontal', kind: 'cortex', rows: [row('b', lobe), row('c', lobe)] },
    { name: 'Limbic', key: 'structure:Limbic', kind: 'structure', rows: [row('d', structure)] },
  ];
  assert.deepEqual(regionGroup(groups, 'c', 'en'), { key: 'cortex:Frontal', label: 'Frontal' });
  assert.deepEqual(regionGroup(groups, 'a', 'en'), { key: 'cortex:Limbic', label: 'Limbic lobe' });
  assert.deepEqual(regionGroup(groups, 'd', 'en'), { key: 'structure:Limbic', label: 'Limbic system' });
  assert.equal(regionGroup(groups, 'elsewhere', 'en'), null);
});

test('a match in another cut atlas offers the cut atlas that draws it, not merely another one', () => {
  const cutAtlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }, { id: 'nextbrain' }];
  const row = (id, region) => ({ region: { id, kind: 'tissue-region', ...region } });
  const histological = row('nb', { atlas: 'nextbrain' });
  const gyral = row('wm', { atlas: 'wmparc', cut_atlases: ['destrieux', 'hcp-mmp'] });
  const offered = (rows, current) => matchesElsewhere(rows, cutAtlases, current, cutAtlasesOf)
    .map(({ atlas, rows: drawn }) => [atlas.id, drawn.map(entry => entry.region.id)]);
  assert.deepEqual(offered([histological], 'destrieux'), [['nextbrain', ['nb']]]);
  assert.deepEqual(offered([histological], 'hcp-mmp'), [['nextbrain', ['nb']]]);
  assert.deepEqual(offered([gyral], 'nextbrain'), [['destrieux', ['wm']]]);
  assert.throws(() => matchesElsewhere([histological], cutAtlases.slice(0, 2), 'destrieux', cutAtlasesOf),
    /No other atlas draws nb/);
});

test('a match in another surface atlas offers that atlas', () => {
  const atlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }];
  const rows = [{ region: { id: 'v1', atlas: 'hcp-mmp' } }];
  assert.deepEqual(matchesElsewhere(rows, atlases, 'destrieux', region => [region.atlas])
    .map(({ atlas }) => atlas.id), ['hcp-mmp']);
});

const shown = { visible: true, reason: null };
const hiddenBy = reason => ({ visible: false, reason });

test('a setting that hides rows is said once per section, in the order met', () => {
  const said = sectionReasons([
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('cortex-hidden')] },
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('hemisphere')] },
    { kind: 'structure', rows: [shown, hiddenBy('removed'), hiddenBy('no-mri')] },
    { kind: 'tissue', rows: [hiddenBy('no-cut')] },
  ]);
  assert.deepEqual([...said], [['cortex', ['cortex-hidden', 'hemisphere']], ['tissue', ['no-cut']]]);
});

test('a hidden row prints only a reason of its own', () => {
  assert.equal(rowStatesReason(shown), false);
  assert.equal(rowStatesReason(hiddenBy('hemisphere')), false, 'the caption says it');
  assert.equal(rowStatesReason(hiddenBy('removed')), false, 'the struck eye says it');
  assert.equal(rowStatesReason(hiddenBy('no-mri')), true);
  assert.equal(rowStatesReason(hiddenBy('below-cut-resolution')), true);
});
