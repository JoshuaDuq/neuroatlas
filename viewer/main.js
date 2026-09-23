import { startApp } from './app.js';
import { reloadWithoutStoredModels } from './model/published-assets.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/clinical.css';
import './styles/phone.css';

/**
 * Whether this browser can draw the model at all.
 *
 * The renderer needs WebGL 2 — integer 3D textures carry the label grids, and
 * there is no fallback path. Without this check the failure surfaces as
 * whatever three.js says when context creation returns null, which tells a
 * reader nothing about what to do. Reloading will not help, so the retry
 * button stays hidden for it.
 */
function webgl2Unavailable() {
  try {
    const probe = document.createElement('canvas');
    if (probe.getContext('webgl2')) return null;
  } catch {
    // Some privacy modes throw rather than return null.
  }
  return 'This viewer needs WebGL 2, which this browser or device does not '
    + 'provide. A current desktop Firefox, Chrome, Edge or Safari will run it.';
}

function fail(message, { retryable }) {
  document.getElementById('app').dataset.status = 'error';
  document.getElementById('stage-message').textContent = message;
  const retry = document.getElementById('stage-retry');
  retry.hidden = !retryable;
  if (retryable) retry.addEventListener('click', reloadWithoutStoredModels);
}

/**
 * Keep the published anatomy across visits.
 *
 * Registered after the app has started, so it never competes with the model
 * download it exists to spare. Only in a built site: in development the files
 * change under it, and a stale cache there would be a bug hunt rather than a
 * feature. A browser without service workers simply keeps fetching.
 */
function keepAnatomyCached() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
    .catch(() => {});
}

const unsupported = webgl2Unavailable();
if (unsupported) {
  fail(unsupported, { retryable: false });
} else {
  try {
    const app = await startApp();
    globalThis.addEventListener('pagehide', () => app.dispose(), { once: true });
    keepAnatomyCached();
  } catch (error) {
    fail(error.message, { retryable: true });
    console.error(error);
  }
}
