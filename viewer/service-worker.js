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
 * So freshness is settled by the cache's *name* rather than by revalidating
 * each file. `MODEL_VERSION` is a hash of what the published manifests say, so
 * publishing a new brain opens a new cache and the old one is deleted, while
 * deploying a code change alone leaves the model cache exactly where it is.
 * Within one version the bytes cannot have changed, so serving them from
 * storage without asking is not a guess.
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
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !CACHEABLE.test(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(MODEL_CACHE);
    const stored = await cache.match(url.pathname);
    if (stored) return stored;
    // `no-cache` on the app's own request would defeat the point of storing
    // this, and within a version there is nothing to revalidate against.
    const response = await fetch(url.pathname, { cache: 'default' });
    // A partial or failed response must not become the copy every later visit
    // gets; let the app see the error and try again next time.
    if (response.ok && response.status === 200) {
      cache.put(url.pathname, response.clone()).catch(() => {});
    }
    return response;
  })());
});
