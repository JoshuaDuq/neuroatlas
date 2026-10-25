import { createLinkWriter } from '../core/state/link-writer.ts';
import type { Engine } from '../engine/api.ts';
import type { ViewStore } from './view.svelte.ts';

/**
 * Writes the link once the scene settles (app.js:243-254, 1831, 1858): after a view change, and
 * when the camera comes to rest. `write` is the caller's; hold and release are the link
 * restore's (`createLinkWriter`). It stops with the component that created it.
 */
export function createLink({
  engine,
  view,
  write,
}: {
  engine: Pick<Engine, 'on'>;
  view: ViewStore;
  write: () => void;
}) {
  const writer = createLinkWriter(write);
  let cameraSettled = $state(0);
  $effect(() =>
    engine.on('cameraSettled', () => {
      cameraSettled += 1;
    }),
  );
  $effect(() => {
    // The view and the camera are this effect's whole input; the writer ignores their values.
    void [view.current, cameraSettled];
    writer.schedule();
    return writer.cancel;
  });
  return writer;
}

export type LinkStore = ReturnType<typeof createLink>;
