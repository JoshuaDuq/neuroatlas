import type { LoadProgress } from '../../types/index.ts';

/** A download's progress event: either figure may be missing until the response announces it. */
export type ProgressEvent = Partial<LoadProgress>;

export type ProgressCallback = (event: LoadProgress) => void;

/**
 * Fold several downloads into the one progress bar the stage shows.
 *
 * A part that has not yet reported a total is omitted, so the bar does not
 * sit at zero waiting for a Content-Length that may never come.
 */
export function combineProgress(parts: readonly string[], onProgress?: ProgressCallback) {
  const state = new Map<string, LoadProgress>(parts.map((id) => [id, { loaded: 0, total: 0 }]));
  const emit = () => {
    let loaded = 0;
    let total = 0;
    for (const part of state.values()) {
      if (!(part.total > 0)) continue;
      loaded += part.loaded;
      total += part.total;
    }
    if (total > 0) onProgress?.({ loaded, total });
  };
  return {
    track(id: string) {
      return (event: ProgressEvent) => {
        state.set(id, { loaded: event.loaded ?? 0, total: event.total ?? 0 });
        emit();
      };
    },
  };
}
