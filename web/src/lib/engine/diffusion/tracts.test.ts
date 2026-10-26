import assert from 'node:assert/strict';
import { Group } from 'three';
import { test, vi } from 'vitest';
import { createTracts } from './tracts.ts';

/** The asset reader serves `public/diffusion/` from disk, so the outline and the bundles load in Node. */
vi.mock('../../core/assets/diffusion-assets.ts', async () => {
  const { readPublishedDiffusion } = await import('./test-support.ts');
  return { readDiffusionAsset: readPublishedDiffusion };
});

test('setActive loads once, announces readiness once and the reference on another anatomy', async () => {
  const other = setup('another-anatomy');
  const events = () => other.emit.mock.calls.map(([type, event]) => [type, event]);
  const first = other.tracts.setActive(true);
  const second = other.tracts.setActive(true);
  await Promise.all([first, second]);
  assert.deepEqual(events(), [
    ['tractsActive', { active: true }],
    ['tractsReady', undefined],
  ]);
  assert.equal(other.tracts.ready, true);
  assert.equal(other.tracts.streamlinesVisible, true);
  assert.ok(other.tracts.snapshot().length > 0);
  await other.tracts.setActive(false);
  assert.equal(other.tracts.streamlinesVisible, false);
  assert.deepEqual(events().at(-1), ['tractsActive', { active: false }]);

  const own = setup('cdmd');
  await own.tracts.setActive(true);
  assert.deepEqual(
    own.emit.mock.calls.map(([type]) => type),
    ['tractsReady'],
  );
  assert.equal(own.tracts.streamlinesVisible, false, 'hidden until the overlay is on');
}, 60_000);

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
