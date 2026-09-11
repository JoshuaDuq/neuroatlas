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
export const REVALIDATE = { cache: 'no-cache' };

export const fetchPublished = (url, options) => fetch(url, { ...REVALIDATE, ...options });

/** The same instruction, for loaders that build their own request. */
export const REVALIDATE_HEADER = { 'Cache-Control': 'no-cache' };
