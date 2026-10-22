import { decodeState } from './url-state.js';

/** The language to start in: the link's, else the reader's saved choice, else English. */
export function startLanguage(hash, saved) {
  const { lang } = decodeState(hash).state;
  return lang ?? (saved === 'fr' ? 'fr' : 'en');
}

/** Connections too slow, or asked to save data, for a download nobody requested. */
const SLOW_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);

/**
 * The cortical atlas worth fetching ahead of a switch: the one not shown, and only
 * on a GPU that can hold both and a connection that is neither slow nor metered.
 */
export function prefetchAtlas(atlases, shown, { prefetchLayers, connection }) {
  if (!prefetchLayers || connection?.saveData || SLOW_CONNECTIONS.has(connection?.effectiveType)) return null;
  return atlases.find(atlas => atlas.id !== shown) ?? null;
}
