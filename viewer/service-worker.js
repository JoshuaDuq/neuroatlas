/**
 * Repeat-visit caching for the published anatomy and diffusion data.
 *
 * The model is the expensive part of this site and the part that changes
 * least, yet the app asks for it with `no-cache`, and the HTTP cache lets it
 * go after ten minutes. This worker keeps it across visits.
 *
 * Every published file is requested as `<path>?v=<its own content hash>`, and
 * the build writes the current map of those versions in below. A request is
 * stored only when its version is the one this deploy publishes, and only once
 * its bytes hash to it; on activation, entries whose URL the deploy no longer
 * publishes are deleted, and nothing else. A deploy that changes one file
 * therefore re-downloads that file alone.
 *
 * It does not make the site work offline: the page and its scripts are never
 * stored here, and navigations always go to the network first.
 */

const PUBLISHED = __PUBLISHED_VERSIONS__;
const CACHE = 'planum-models';

/** A same-origin URL's path from the published root, or null. */
function publishedPath(url) {
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PUBLISHED.base)) return null;
  return decodeURIComponent(url.pathname.slice(PUBLISHED.base.length));
}

/** Whether a URL asks for the version of its file this deploy publishes. */
const isCurrent = url => {
  const path = publishedPath(url);
  return path !== null && path in PUBLISHED.files && url.searchParams.get('v') === PUBLISHED.files[path];
};

async function versionOf(buffer) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return [...digest.subarray(0, 8)].map(value => value.toString(16).padStart(2, '0')).join('');
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      // Caches from before the rename to Planum, including the one per model
      // version kept before files were versioned one by one.
      if (name.startsWith('neuroatlas-models')) await caches.delete(name);
    }
    const cache = await caches.open(CACHE);
    for (const request of await cache.keys()) {
      if (!isCurrent(new URL(request.url))) await cache.delete(request);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // The page carries the versions its requests ask for, and GitHub Pages lets
  // the browser keep it ten minutes, so it is always revalidated.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(response => (response.redirected ? fetch(request) : response))
      .catch(() => fetch(request)));
    return;
  }
  const url = new URL(request.url);
  if (!isCurrent(url)) return;

  event.respondWith((async () => {
    const key = url.pathname + url.search;
    const cache = await caches.open(CACHE);
    const stored = await cache.match(key);
    if (stored) return stored;
    // Revalidate: the HTTP cache may still hold bytes from before the deploy.
    const response = await fetch(key, { cache: 'no-cache' });
    // A partial, failed or mismatched response must not become the copy every
    // later visit gets; the page sees it and reports it.
    if (response.ok && response.status === 200) {
      const copy = response.clone();
      const path = publishedPath(url);
      event.waitUntil((async () => {
        const bytes = await copy.arrayBuffer();
        // A `.gz` file a server sends with Content-Encoding arrives as its contents.
        const version = await versionOf(bytes);
        if (version !== PUBLISHED.files[path] && version !== PUBLISHED.gunzipped[path]) return;
        await cache.put(key, new Response(bytes, { status: 200, headers: copy.headers }));
      })());
    }
    return response;
  })());
});
