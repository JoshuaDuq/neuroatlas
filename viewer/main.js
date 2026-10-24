import { startApp } from './app.js';
import { startFailure } from './i18n/errors.js';
import { t } from './i18n/translations.js';
import { reloadWithoutStoredModels } from './model/published-assets.js';
import { startLanguage } from './state/boot.js';
import { bindAppLifecycle } from './state/lifecycle.js';
import { startTooltips } from './ui/tooltip.js';
import '@fontsource-variable/source-sans-3/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/detail.css';
import './styles/navigator.css';
import './styles/masthead.css';
import './styles/stage.css';
import './styles/dialogs.css';
import './styles/clinical.css';
import './styles/circuits.css';
import './styles/diffusion.css';
import './styles/phone.css';
import './styles/a11y.css';

/**
 * What this browser's WebGL lacks for the renderer, or null. Integer 3D textures
 * carry the label grids (WebGL 2), and the frame is drawn into half-float
 * multisampled targets (EXT_color_buffer_float). There is no fallback path, and
 * reloading will not help, so the retry button stays hidden for these.
 */
function missingWebgl() {
  let gl = null;
  try {
    gl = document.createElement('canvas').getContext('webgl2');
  } catch {
    // Some privacy modes throw rather than return null.
  }
  if (!gl) return 'webgl2';
  const float = gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return float ? null : 'floatTargets';
}

function fail(lang, message, retry, label) {
  document.documentElement.lang = lang;
  document.getElementById('app').dataset.status = 'error';
  document.getElementById('stage-message').textContent = message;
  document.getElementById('announcer').textContent = message;
  const button = document.getElementById('stage-retry');
  button.hidden = !retry;
  button.textContent = label;
  if (retry) button.addEventListener('click', retry);
}

function failStart(error, lang) {
  const { text, button, dropLink } = startFailure(error, lang, globalThis.location.hash.replace(/^#/, '') !== '');
  fail(lang, text, () => {
    if (dropLink) history.replaceState(null, '', globalThis.location.pathname + globalThis.location.search);
    reloadWithoutStoredModels();
  }, button);
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
    // The atlas works without it, but a missing or broken sw.js should not pass unseen.
    .catch(error => console.warn('Service worker registration failed:', error));
}

let savedLang = null;
try { savedLang = localStorage.getItem('planum-lang'); } catch {}
const lang = startLanguage(globalThis.location.hash, savedLang);
startTooltips();
const missing = missingWebgl();
if (missing) {
  fail(lang, t(lang, 'errors')[missing], null);
} else {
  try {
    const app = await startApp();
    bindAppLifecycle(app);
    keepAnatomyCached();
  } catch (error) {
    console.error(error);
    failStart(error, lang);
  }
}
