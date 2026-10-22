import PUBLISHED from './published-files.js';

/** Thrown for any published download: `asset-fetch` (network or HTTP) or `asset-updated` (bytes from another deploy). */
export class AssetError extends Error {
  constructor(code, message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'AssetError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

/**
 * Revalidate even versioned URLs: the HTTP cache may hold bytes stored under
 * this URL before a deploy finished propagating, and the checksum would then
 * fail the page for a file the server already has right.
 */
const REVALIDATE = { cache: 'no-cache', priority: 'high' };

/**
 * The build's record of a published file, or null when there is no published
 * map. A file the map does not list is an error: the viewer only asks for
 * what the manifests name, and those are in the map.
 */
export function publishedRecord(url) {
  if (!PUBLISHED.files) return null;
  const address = new URL(url, globalThis.location?.href);
  const path = address.pathname.startsWith(PUBLISHED.base)
    ? decodeURIComponent(address.pathname.slice(PUBLISHED.base.length)) : null;
  const record = path === null ? undefined : PUBLISHED.files[path];
  if (!record) throw new AssetError('asset-fetch', `Not a published file: ${address.pathname}`);
  return record;
}

/** Each file carries its own content version, so a deploy re-downloads only what changed. */
function versioned(url) {
  const record = publishedRecord(url);
  if (!record) return String(url);
  const pinned = new URL(url, globalThis.location?.href);
  pinned.searchParams.set('v', record.version);
  return pinned.href;
}

export const fetchPublished = (url, options) => fetch(versioned(url), { ...REVALIDATE, ...options });

/**
 * Reload without the stored anatomy. A retry follows a failure the reader
 * cannot diagnose, and a bad stored copy would otherwise fail the same way.
 */
export async function reloadWithoutStoredModels() {
  try {
    for (const name of await caches.keys()) {
      if (name.startsWith('neuroatlas-models')) await caches.delete(name);
    }
  } catch {
    // No Cache Storage (or blocked): a plain reload is all there is.
  }
  globalThis.location.reload();
}

/** The same instruction, for loaders that build their own request. */
export const REVALIDATE_HEADER = { 'Cache-Control': 'no-cache' };
