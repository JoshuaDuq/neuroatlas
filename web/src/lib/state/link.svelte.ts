import { createLinkWriter } from '../core/state/link-writer.ts';
import type { Engine } from '../engine/api.ts';
import type { LesionStore } from './lesion.svelte.ts';
import type { ViewStore } from './view.svelte.ts';

/**
 * Writes the link once the scene settles (app.js:243-254, 1831, 1858): 250 ms after a view
 * change, and when the camera settles. The engine's `cameraSettled` comes 250 ms after a reader's
 * move ends (link-writer.js:7), so that move writes the link ~250 ms after rest; an application
 * move reports it at once, so its link is written when the move starts and again after it rests.
 * `write` is the caller's; hold and release are the link restore's (`createLinkWriter`). It stops
 * with the component that created it.
 */
export function createLink({
  engine,
  view,
  lesion,
  write,
}: {
  engine: Pick<Engine, 'on'>;
  view: ViewStore;
  /** The placed lesion, which the link carries beside the view. */
  lesion: Pick<LesionStore, 'sphere' | 'mode' | 'selectedTract'>;
  write: () => void;
}) {
  const writer = createLinkWriter(write);
  $effect(() => engine.on('cameraSettled', () => writer.schedule(0)));
  $effect(() => {
    // The view and the lesion are this effect's whole input; the writer ignores their values.
    void view.current;
    void lesion.sphere;
    void lesion.mode;
    void lesion.selectedTract;
    writer.schedule();
    return writer.cancel;
  });
  return writer;
}

export type LinkStore = ReturnType<typeof createLink>;
