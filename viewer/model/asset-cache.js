import { fetchPublished } from './published-assets.js';

/**
 * One in-flight request per URL.
 *
 * The head script starts the anatomy downloads before this module graph has
 * even parsed. Those Response promises live on `globalThis.__neuroatlasAssets`
 * and are consumed here so a second fetch of the same 25 MB file never opens.
 */

const inflight = new Map();

export function resetAssetCache() {
  inflight.clear();
}

async function readWithProgress(response, onChunk) {
  const total = Number(response.headers.get('Content-Length')) || 0;
  if (!response.body?.getReader) {
    const buffer = await response.arrayBuffer();
    onChunk?.({ loaded: buffer.byteLength, total: total || buffer.byteLength });
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (total) onChunk?.({ loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onChunk?.({ loaded, total: total || loaded });
  return bytes.buffer;
}

export function fetchAsset(url, { onProgress } = {}) {
  const key = String(url);
  if (inflight.has(key)) {
    const entry = inflight.get(key);
    if (onProgress) entry.listeners.push(onProgress);
    return entry.promise;
  }
  const listeners = onProgress ? [onProgress] : [];
  const notify = event => {
    for (const listener of listeners) listener(event);
  };
  const promise = (async () => {
    const early = globalThis.__neuroatlasAssets?.[key];
    if (early && globalThis.__neuroatlasAssets) delete globalThis.__neuroatlasAssets[key];
    const response = early ? await early : await fetchPublished(key);
    if (!response.ok) throw new Error(`Asset request failed: HTTP ${response.status}`);
    return readWithProgress(response, notify);
  })().finally(() => inflight.delete(key));
  inflight.set(key, { promise, listeners });
  return promise;
}
