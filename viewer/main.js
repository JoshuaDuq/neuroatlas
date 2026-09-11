import { startApp } from './app.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/clinical.css';

try {
  const app = await startApp();
  globalThis.addEventListener('pagehide', () => app.dispose(), { once: true });
} catch (error) {
  document.getElementById('app').dataset.status = 'error';
  document.getElementById('stage-message').textContent = error.message;
  document.getElementById('stage-retry').hidden = false;
  document.getElementById('stage-retry')
    .addEventListener('click', () => globalThis.location.reload());
  console.error(error);
}
