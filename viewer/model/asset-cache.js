import { AssetError, fetchPublished, publishedRecord } from './published-assets.js';

/**
 * One in-flight request per URL.
 *
 * The head script starts the anatomy downloads before this module graph has
 * even parsed. Those Response promises live on `globalThis.__neuroatlasAssets`
 * and are consumed here so a second fetch of the same 25 MB file never opens.
 */

const inflight = new Map();

export async function sha256Hex(buffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
}

/**
 * `size` is the decoded byte count the build recorded. Content-Length is only
 * a fallback, and never under Content-Encoding: it then counts the gzip
 * bytes while the stream yields decoded ones, and the bar passes 100%.
 */
async function readWithProgress(response, onChunk, size) {
  const length = response.headers.get('Content-Encoding') ? 0 : Number(response.headers.get('Content-Length'));
  const total = size ?? (length || 0);
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

async function download(key, early, notify) {
  const record = publishedRecord(key);
  let buffer;
  let expected = record;
  try {
    const response = early ? await early : await fetchPublished(key);
    if (!response.ok) {
      throw new AssetError('asset-fetch', `Asset request failed: HTTP ${response.status} (${key})`,
        { status: response.status });
    }
    // A `.gz` file sent with Content-Encoding arrives as its contents.
    if (record?.gunzipped && response.headers.get('Content-Encoding')) expected = record.gunzipped;
    buffer = await readWithProgress(response, notify, expected?.size);
  } catch (error) {
    // fetch and a dropped body stream both reject with a TypeError.
    if (!(error instanceof TypeError)) throw error;
    throw new AssetError('asset-fetch', `Asset download failed: ${key}`, { cause: error });
  }
  if (expected && await sha256Hex(buffer) !== expected.sha256) {
    throw new AssetError('asset-updated', `Published file changed since this page loaded: ${key}`);
  }
  return buffer;
}

/** The verified bytes of one published file, as an ArrayBuffer shared by concurrent callers. */
export function fetchAsset(url, { onProgress } = {}) {
  const key = new URL(url, globalThis.location?.href).href;
  if (inflight.has(key)) {
    const entry = inflight.get(key);
    if (onProgress) entry.listeners.push(onProgress);
    return entry.promise;
  }
  const listeners = onProgress ? [onProgress] : [];
  const notify = event => {
    for (const listener of listeners) listener(event);
  };
  const early = globalThis.__neuroatlasAssets?.[key];
  if (early) delete globalThis.__neuroatlasAssets[key];
  const promise = download(key, early, notify).finally(() => inflight.delete(key));
  inflight.set(key, { promise, listeners });
  return promise;
}
