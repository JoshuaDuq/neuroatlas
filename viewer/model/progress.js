/**
 * Fold several downloads into the one progress bar the stage shows.
 *
 * A part that has not yet reported a total is omitted, so the bar does not
 * sit at zero waiting for a Content-Length that may never come.
 */
export function combineProgress(parts, onProgress) {
  const state = Object.fromEntries(parts.map(id => [id, { loaded: 0, total: 0 }]));
  const emit = () => {
    let loaded = 0;
    let total = 0;
    for (const part of Object.values(state)) {
      if (!(part.total > 0)) continue;
      loaded += part.loaded;
      total += part.total;
    }
    if (total > 0) onProgress?.({ loaded, total });
  };
  return {
    track(id) {
      return event => {
        state[id] = { loaded: event.loaded ?? 0, total: event.total ?? 0 };
        emit();
      };
    },
  };
}
