import { flushSync } from 'svelte';
import { expect, test } from 'vitest';
import { createScene } from './excursion-test-support.ts';

test('whether Restore is offered, and the lesson in front, are reactive', async () => {
  const scene = createScene();
  const seen: [boolean, string | null][] = [];
  const stop = $effect.root(() => {
    $effect(() => {
      seen.push([scene.excursions.restorable, scene.view.current.lesson.circuit]);
    });
  });
  flushSync();
  await scene.excursions.openDeficit('acalculia');
  flushSync();
  await scene.excursions.openCircuit(scene.circuits.all[0]!.id);
  flushSync();
  scene.excursions.closeDeficit();
  flushSync();
  stop();
  expect(seen.at(0)).toEqual([false, null]);
  expect(seen.at(-1)).toEqual([false, scene.circuits.all[0]!.id]);
  expect(seen.some(([restorable]) => restorable)).toBe(true);
});
