import { createLinkWriter } from '../core/state/link-writer.ts';
import type { Engine } from '../engine/api.ts';
import type { ViewStore } from './view.svelte.ts';

/**
 * Writes the link once the scene settles (app.js:243-254, 1831, 1858): 250 ms after a view
 * change, and as the camera comes to rest, which the engine's `cameraSettled` has already
 * debounced by the same 250 ms (link-writer.js:7), so a camera move writes ~250 ms after rest.
 * `write` is the caller's; hold and release are the link restore's (`createLinkWriter`). It stops
 * with the component that created it.
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
  $effect(() => engine.on('cameraSettled', () => writer.schedule(0)));
  $effect(() => {
    // The view is this effect's whole input; the writer ignores its value.
    void view.current;
    writer.schedule();
    return writer.cancel;
  });
  return writer;
}

export type LinkStore = ReturnType<typeof createLink>;
