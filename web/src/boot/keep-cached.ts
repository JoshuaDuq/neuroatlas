/**
 * Keep the published anatomy across visits.
 *
 * Registered after the app has started, so it never competes with the model
 * download it exists to spare. Only in a built site: in development the files
 * change under it, and a stale cache there would be a bug hunt rather than a
 * feature. A browser without service workers simply keeps fetching.
 */
export function keepAnatomyCached(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
    // The atlas works without it, but a missing or broken sw.js should not pass unseen.
    .catch((error) => console.warn('Service worker registration failed:', error));
}
