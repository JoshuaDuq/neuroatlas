// Ported from viewer/ui/chrome/workspace.test.js (the pure functions); the DOM cases are in
// features/workspace/Workspace.svelte.test.ts.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Explorer } from '../types/index.ts';
import { t } from './i18n/index.ts';
import {
  currentItem,
  detailAvailable,
  locationCrumbs,
  MODES,
  noticeActionLabel,
  registerCurrentItem,
  revealSelected,
  stripVisible,
  viewAfterUpdate,
  type ContextSelection,
  type DetailState,
  type WorkspaceView,
} from './workspace.ts';

test('the tab row is the five content modes, in session order', () => {
  assert.deepEqual(MODES, ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion']);
});

const tracts = { explorer: 'diffusion', anatomy: 'bert', referenceAnatomy: 'bert' } as const;
const state = (fields: DetailState) => fields;

test('a selected region is detail in any mode', () => {
  for (const explorer of ['anatomy', 'functions', 'deficits', 'circuits'] as const) {
    assert.equal(detailAvailable(state({ explorer, selectedRegion: { id: 'a' } })), true, explorer);
  }
  assert.equal(detailAvailable({ ...tracts, selectedRegion: { id: 'a' } }), true);
});

test('a function, a deficit or a lesson is detail only in its own mode', () => {
  assert.equal(detailAvailable({ explorer: 'functions', selectedFunction: 'all' }), true);
  assert.equal(detailAvailable({ explorer: 'functions', selectedFunction: null }), false);
  assert.equal(detailAvailable({ explorer: 'deficits', selectedFunction: 'language' }), false);
  assert.equal(detailAvailable({ explorer: 'deficits', selectedDeficit: 'aphasia' }), true);
  assert.equal(detailAvailable({ explorer: 'anatomy', selectedDeficit: 'aphasia' }), false);
  assert.equal(detailAvailable({ explorer: 'circuits', lesson: { circuit: 'motor' } }), true);
  assert.equal(detailAvailable({ explorer: 'circuits', lesson: { circuit: null } }), false);
  assert.equal(detailAvailable({ explorer: 'anatomy', lesson: { circuit: 'motor' } }), false);
});

test('a placed lesion is detail in Anatomy, where its report is, and nowhere else', () => {
  assert.equal(detailAvailable({ explorer: 'anatomy', lesion: true }), true);
  assert.equal(detailAvailable({ explorer: 'anatomy', lesion: false }), false);
  assert.equal(detailAvailable({ explorer: 'deficits', lesion: true }), false);
});

function view(fields: Partial<Parameters<typeof viewAfterUpdate>[0]>): WorkspaceView {
  return viewAfterUpdate({
    view: 'list',
    reference: false,
    wasAvailable: false,
    available: false,
    previousSelection: null,
    selection: null,
    ...fields,
  });
}

test('tract reference data offers no detail view', () => {
  const reference = { ...tracts, anatomy: 'aomic', selectedRegion: { id: 'a' } };
  assert.equal(detailAvailable(reference), false);
  assert.equal(view({ view: 'detail', reference: true, available: false, selection: 'a' }), 'list');
  assert.throws(() => detailAvailable({ explorer: 'diffusion' }), /anatomy/);
});

test('a new region selection drills into the detail view', () => {
  assert.equal(view({ selection: 'left:1', available: true }), 'detail');
  assert.equal(
    view({
      previousSelection: 'left:1',
      selection: 'left:2',
      available: true,
      wasAvailable: true,
    }),
    'detail',
  );
});

test('going back keeps the list for the same selection', () => {
  assert.equal(
    view({ previousSelection: 'left:1', selection: 'left:1', available: true, wasAvailable: true }),
    'list',
  );
});

test('clearing the last context returns to the list', () => {
  assert.equal(view({ view: 'detail', previousSelection: 'left:1', wasAvailable: true }), 'list');
});

test('a deficit or lesson keeps the detail open once the region is cleared', () => {
  assert.equal(
    view({ view: 'detail', previousSelection: 'left:1', wasAvailable: true, available: true }),
    'detail',
  );
});

test('a detail opened ahead of its context waits for it rather than closing', () => {
  assert.equal(view({ view: 'detail' }), 'detail');
});

test('the selection strip never repeats the detail it would open', () => {
  const region: ContextSelection = { kind: 'region', label: 'Precentral gyrus' };
  for (const mode of MODES) {
    assert.equal(stripVisible({ view: 'detail', mode, selection: region }), false);
  }
});

test('the selection strip leads only from a list that does not show the selection', () => {
  const strip = (mode: Explorer, kind: ContextSelection['kind']) =>
    stripVisible({ view: 'list', mode, selection: { kind, label: 'x' } });
  assert.equal(strip('anatomy', 'region'), false, 'the tree shows the selected row');
  assert.equal(strip('deficits', 'region'), true);
  assert.equal(strip('circuits', 'region'), true);
  assert.equal(strip('diffusion', 'region'), true);
  assert.equal(strip('circuits', 'landmark'), false, 'the step list shows the current landmark');
  assert.equal(strip('deficits', 'deficit'), false);
  assert.equal(strip('functions', 'function'), false);
  assert.equal(strip('anatomy', 'function'), true);
  assert.equal(strip('circuits', 'lesson'), false);
  assert.equal(stripVisible({ view: 'list', mode: 'deficits', selection: {} }), false);
  assert.throws(() => strip('anatomy', 'atlas' as ContextSelection['kind']), /kind/);
});

test('a region read from Anatomy carries its tree group in the location bar', () => {
  const labels = t('en', 'workspace').modes;
  const frontal = { key: 'cortex:Frontal', label: 'Frontal' };
  assert.deepEqual(locationCrumbs({ mode: 'anatomy', place: null, group: frontal, labels }), [
    { kind: 'list', label: 'Anatomy' },
    { kind: 'group', key: 'cortex:Frontal', label: 'Frontal' },
  ]);
  assert.deepEqual(
    locationCrumbs({ mode: 'anatomy', place: null, group: null, labels }),
    [{ kind: 'list', label: 'Anatomy' }],
    'a region the tree does not list has no group to return to',
  );
});

test('every mode reads Mode › Place: the way back is the mode, and a tree group belongs to Anatomy alone', () => {
  const labels = t('fr', 'workspace').modes;
  const group = { key: 'cortex:Frontal', label: 'Frontal' };
  assert.deepEqual(locationCrumbs({ mode: 'deficits', place: 'Langage', group, labels }), [
    { kind: 'list', label: 'Déficits' },
    { kind: 'group', label: 'Langage' },
  ]);
  assert.deepEqual(locationCrumbs({ mode: 'diffusion', place: null, group, labels }), [
    { kind: 'list', label: 'Faisceaux' },
  ]);
  assert.deepEqual(locationCrumbs({ mode: 'circuits', place: 'Voie motrice', group, labels }), [
    { kind: 'list', label: 'Circuits' },
    { kind: 'group', label: 'Voie motrice' },
  ]);
});

test('the path and its group crumb are named in both languages', () => {
  for (const lang of ['en', 'fr']) {
    const copy = t(lang, 'workspace');
    assert.ok(copy.path);
    assert.match(
      copy.showInList('Frontal'),
      /^Frontal\b/,
      'the spoken name starts with the visible one',
    );
  }
});

// The registry only calls what a list gave it; plain objects stand in for rows.
const row = (shownNow: boolean, scrolled: unknown[] = []) =>
  ({
    isConnected: true,
    checkVisibility: () => shownNow,
    scrollIntoView: (options: unknown) => scrolled.push(options),
  }) as unknown as HTMLElement;

test("the current item is the first registered list's item that is on screen", () => {
  const hidden = row(false);
  const scrolled: unknown[] = [];
  const visible = row(true, scrolled);
  const stop = [
    registerCurrentItem(() => null),
    registerCurrentItem(() => hidden),
    registerCurrentItem(() => visible),
  ];
  assert.equal(currentItem(), visible);
  revealSelected();
  assert.deepEqual(scrolled, [{ block: 'nearest' }]);
  for (const unregister of stop) unregister();
  assert.equal(currentItem(), null);
  revealSelected();
  assert.equal(scrolled.length, 1);
});

test('a notice offers a reload or seeing through the cortex, in either language; anything else fails', () => {
  assert.equal(noticeActionLabel('en', 'reload'), 'Reload');
  assert.equal(noticeActionLabel('fr', 'reload'), 'Recharger');
  assert.equal(noticeActionLabel('fr', 'see-through'), 'Voir à travers le cortex');
  assert.throws(() => noticeActionLabel('en', 'fly' as 'reload'), /Unknown notice action: fly/);
});
