import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import { inspectorEmptyChrome, sourceLabel } from './inspector.ts';

test('a source label names its atlas and keeps the ids apart, in the code voice', () => {
  assert.deepEqual(sourceLabel({ atlas: 'destrieux', source_label_id: 16 }, 'en'), {
    atlas: 'Destrieux',
    ids: '16',
    stacked: false,
  });
  assert.deepEqual(
    sourceLabel(
      { atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: [161, 10161] },
      'en',
    ),
    { atlas: 'NextBrain', ids: '161, 10161', stacked: false },
  );
});

test('a list longer than two ids, or a reference without one, takes the line under its label', () => {
  assert.equal(
    sourceLabel({ atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: [1, 2, 3] }, 'en')
      .stacked,
    true,
  );
  const reference = sourceLabel({ atlas: 'zanatomy' }, 'fr');
  assert.equal(reference.ids, null);
  assert.equal(reference.stacked, true);
});

test('past eight ids the row counts them and keeps the complete list', () => {
  const ids = Array.from({ length: 52 }, (_, index) => index + 100);
  const label = sourceLabel(
    { atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: ids },
    'fr',
  );
  assert.equal(label.atlas, 'NextBrain · 52 étiquettes');
  assert.equal(label.ids, null);
  assert.equal(label.all, ids.join(', '));
});

test('empty inspector is a hint; the title and facts stay reserved for a region', () => {
  assert.deepEqual(inspectorEmptyChrome({ selectedRegion: null, explorer: 'anatomy' }), {
    hideTitle: true,
    hideHint: false,
    hideFacts: true,
    hideActions: true,
  });
});

test('a deficit with no region hides the anatomy hint as well', () => {
  const empty = inspectorEmptyChrome({ selectedRegion: null, explorer: 'deficits' });
  assert.equal(empty.hideHint, true);
  assert.equal(empty.hideTitle, true);
  assert.equal(empty.hideActions, true);
});

test('the circuit introduction replaces the empty anatomical hint', () => {
  assert.equal(inspectorEmptyChrome({ selectedRegion: null, explorer: 'circuits' }).hideHint, true);
});

test('a selected region keeps the hint and reveals its title, facts and actions', () => {
  const selectedRegion = { id: 'destrieux:left:1' } as Region;
  for (const explorer of ['anatomy', 'deficits'] as const) {
    assert.deepEqual(inspectorEmptyChrome({ selectedRegion, explorer }), {
      hideTitle: false,
      hideHint: false,
      hideFacts: false,
      hideActions: false,
    });
  }
});

test('PANEL-17 with no region only Anatomy keeps the hint; every other tab hides it', () => {
  for (const explorer of ['functions', 'deficits', 'circuits', 'diffusion'] as const) {
    assert.deepEqual(
      inspectorEmptyChrome({ selectedRegion: null, explorer }),
      { hideTitle: true, hideHint: true, hideFacts: true, hideActions: true },
      explorer,
    );
  }
});

test('PANEL-18 eight ids are listed, nine are counted and the full list is kept', () => {
  const label = (count: number) =>
    sourceLabel(
      {
        atlas: 'learning',
        source_atlas: 'nextbrain',
        source_label_ids: Array.from({ length: count }, (_, index) => index + 1),
      },
      'en',
    );
  assert.deepEqual(label(8), { atlas: 'NextBrain', ids: '1, 2, 3, 4, 5, 6, 7, 8', stacked: true });
  assert.deepEqual(label(9), {
    atlas: 'NextBrain · 9 labels',
    ids: null,
    stacked: false,
    all: '1, 2, 3, 4, 5, 6, 7, 8, 9',
  });
});
