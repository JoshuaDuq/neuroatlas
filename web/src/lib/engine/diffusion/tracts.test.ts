import assert from 'node:assert/strict';
import { Group } from 'three';
import { test, vi } from 'vitest';
import { createTracts } from './tracts.ts';

const setup = (anatomy: string) => {
  const scene = new Group();
  const invalidate = vi.fn();
  const emit = vi.fn();
  const tracts = createTracts({
    anatomy,
    scene: { add: (object) => scene.add(object), invalidate },
    emit,
  });
  return { scene, invalidate, emit, tracts };
};

test('the tracts of their own anatomy overlay it; another anatomy gets the independent reference', () => {
  const own = setup('cdmd');
  assert.equal(own.tracts.anatomy, 'cdmd');
  assert.equal(own.scene.children.length, 1);
  assert.equal(own.tracts.ready, false);
  assert.equal(own.tracts.streamlinesVisible, false);
  own.tracts.setOverlay(true);
  assert.deepEqual(own.emit.mock.calls, [['tractsVisibility', undefined]]);
  assert.equal(own.scene.children[0]!.visible, true);

  const other = setup('another-anatomy');
  assert.equal(other.tracts.anatomy, 'cdmd');
  assert.throws(() => other.tracts.setOverlay(true), /own anatomy/);
  other.tracts.setOverlay(false);
});

test('an unknown bundle is a RangeError', async () => {
  await assert.rejects(setup('cdmd').tracts.loadBundle('missing'), RangeError);
});
