/**
 * Fetch a file under `models/`, always revalidating it.
 *
 * The built JavaScript carries a content hash in its filename, so a deploy
 * always replaces it. The published model assets do not: they keep stable
 * names and are served with a cache lifetime, so a browser can pair a freshly
 * deployed bundle with a manifest cached from the previous deploy. The app
 * then fails to start, and the checksums on the volumes fail the same way for
 * the same reason.
 *
 * Revalidating costs one conditional request per asset and returns 304 when
 * nothing changed, which is cheap next to being wrong about what is on screen.
 */
export const REVALIDATE = { cache: 'no-cache', priority: 'high' };

/**
 * Hash of the published model files, stamped in by the build. It rides on
 * every request so the service worker and the CDN key each file by version.
 */
export const MODEL_VERSION = typeof __MODEL_VERSION__ === 'string' ? __MODEL_VERSION__ : '';

export function versioned(url) {
  if (!MODEL_VERSION) return String(url);
  const pinned = new URL(url, globalThis.location?.href);
  pinned.searchParams.set('v', MODEL_VERSION);
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
      if (name.startsWith('neuroatlas-models-')) await caches.delete(name);
    }
  } catch {
    // No Cache Storage (or blocked): a plain reload is all there is.
  }
  globalThis.location.reload();
}

/** The same instruction, for loaders that build their own request. */
export const REVALIDATE_HEADER = { 'Cache-Control': 'no-cache' };
