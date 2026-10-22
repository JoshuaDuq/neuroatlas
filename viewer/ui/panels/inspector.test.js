import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLabel } from './inspector.js';

test('a source label names its atlas and keeps the ids apart, in the code voice', () => {
  assert.deepEqual(sourceLabel({ atlas: 'destrieux', source_label_id: 16 }, 'en'),
    { atlas: 'Destrieux', ids: '16', stacked: false });
  assert.deepEqual(sourceLabel({ atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: [161, 10161] }, 'en'),
    { atlas: 'NextBrain', ids: '161, 10161', stacked: false });
});

test('a list longer than two ids, or a reference without one, takes the line under its label', () => {
  assert.equal(sourceLabel({ atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: [1, 2, 3] }, 'en').stacked, true);
  const reference = sourceLabel({ atlas: 'zanatomy' }, 'fr');
  assert.equal(reference.ids, null);
  assert.equal(reference.stacked, true);
});

test('past eight ids the row counts them and keeps the list for the tooltip', () => {
  const ids = Array.from({ length: 52 }, (_, index) => index + 100);
  const label = sourceLabel({ atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: ids }, 'fr');
  assert.equal(label.atlas, 'NextBrain · 52 étiquettes');
  assert.equal(label.ids, null);
  assert.equal(label.all, ids.join(', '));
});
