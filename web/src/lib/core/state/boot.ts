/** Connections too slow, or asked to save data, for a download nobody requested. */
const SLOW_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);

/** What the browser reports about the connection (`navigator.connection`), where it does. */
export interface ConnectionHints {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * The cortical atlas worth fetching ahead of a switch: the one not shown, and only
 * on a GPU that can hold both and a connection that is neither slow nor metered.
 */
export function prefetchAtlas<A extends { id: string }>(
  atlases: readonly A[],
  shown: string,
  { prefetchLayers, connection }: { prefetchLayers: boolean; connection?: ConnectionHints },
): A | null {
  if (
    !prefetchLayers ||
    connection?.saveData ||
    SLOW_CONNECTIONS.has(connection?.effectiveType ?? '')
  ) {
    return null;
  }
  return atlases.find((atlas) => atlas.id !== shown) ?? null;
}
