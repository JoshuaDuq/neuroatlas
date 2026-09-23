/**
 * Offline and repeat-visit caching for the published anatomy.
 *
 * The model is the expensive part of this site and the part that changes
 * least: a first visit spends about 16 MB on one brain's cortex and interior,
 * and until now every later visit spent it again, because the app asks for
 * those files with `no-cache` and the HTTP cache lets them go after ten
 * minutes. That is the right default for correctness — a manifest cached from
 * a previous deploy paired with a freshly deployed bundle fails to start — and
 * the wrong one for a reader who opens the atlas twice in a lecture.
 *
 * So freshness is settled by the URL rather than by revalidating each file.
 * The page asks for every model file with `?v=<model version>`, a hash of the
 * published model files, and entries are keyed by that full URL. A worker left
 * over from the previous deploy still controls the first load after a new one;
 * keyed by path alone it answered the new manifest with the old geometry.
 * Deploying a code change alone leaves the version, and the cache, alone.
 *
 * Nothing is precached. A first visit fetches what it always did, at the speed
 * it always did, and fills the cache as it goes.
 */

const MODEL_VERSION = '__MODEL_VERSION__';
const MODEL_CACHE = `neuroatlas-models-${MODEL_VERSION}`;

/** Only the large, immutable-within-a-version anatomy. */
const CACHEABLE = /\/models\/.+\.(glb|volume|labels)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      // Another version's anatomy, or a cache from a build that named it
      // differently. Either way nothing here will ask for it again.
      if (name.startsWith('neuroatlas-models-') && name !== MODEL_CACHE) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // The page carries the model version its requests ask for, and GitHub Pages
  // lets the browser keep it ten minutes. A stale page asks for the previous
  // deploy's anatomy by name and pairs it with the current manifest, so the
  // page is always revalidated; offline, the stored copy still opens.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(response => (response.redirected ? fetch(request) : response))
      .catch(() => fetch(request)));
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !CACHEABLE.test(url.pathname)) return;

  event.respondWith((async () => {
    const key = url.pathname + url.search;
    const cache = await caches.open(MODEL_CACHE);
    const stored = await cache.match(key);
    if (stored) return stored;
    // Revalidate: the HTTP cache may still hold the previous deploy's bytes,
    // and storing those under this version would pin them until the next one.
    const response = await fetch(key, { cache: 'no-cache' });
    // A partial or failed response must not become the copy every later visit
    // gets; let the app see the error and try again next time.
    if (response.ok && response.status === 200) {
      cache.put(key, response.clone()).catch(() => {});
    }
    return response;
  })());
});
