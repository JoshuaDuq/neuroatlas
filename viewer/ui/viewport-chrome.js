import { edgeLabels } from '../render/orientation.js';
import { scaleBar } from '../render/scale-bar.js';
import { t } from '../i18n/translations.js';

const VIEW_KEYS = ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/**
 * Everything drawn over the canvas: anatomical orientation, the scale bar,
 * the view presets, the hover label, and the loading and error stage.
 *
 * Overlays sit on near-opaque chips because the geometry beneath them runs
 * from near-black crevices to near-white speculars, so no fixed text colour
 * would be legible against all of it.
 */
export function createViewportChrome({ onView, onRetry }) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const hover = document.getElementById('hover-label');
  const stage = document.getElementById('stage');
  const stageMessage = document.getElementById('stage-message');
  const stageProgress = document.getElementById('stage-progress');
  const stageBar = document.getElementById('stage-bar');
  const retry = document.getElementById('stage-retry');
  let currentLang = 'en';
  let lastCameraArgs = null;

  const buttons = VIEW_KEYS.map(view => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = view;
    button.addEventListener('click', () => onView(view));
    views.append(button);
    return button;
  });

  retry.addEventListener('click', onRetry);

  return {
    update(state) {
      currentLang = state.lang;
      const i18nViewport = t(state.lang, 'viewport');
      const viewLabels = t(state.lang, 'views');
      views.setAttribute('aria-label', i18nViewport.viewAria);

      for (const button of buttons) {
        button.textContent = viewLabels[button.dataset.view] ?? button.dataset.view;
        button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
      }
      const ready = state.status === 'ready' || state.status === 'switching';
      orientation.hidden = !ready;
      if (!ready) bar.hidden = true;

      if (lastCameraArgs) {
        const labels = edgeLabels(lastCameraArgs.camera, currentLang);
        for (const [edge, node] of Object.entries(edges)) node.textContent = labels[edge];
      }

      if (state.status === 'context-lost') {
        stageMessage.textContent = state.error.message;
        stageProgress.hidden = true;
        retry.hidden = true;
        return;
      }
      if (state.status === 'error') {
        stageMessage.textContent = state.error?.message ?? i18nViewport.error;
        stageProgress.hidden = true;
        retry.hidden = false;
        retry.textContent = i18nViewport.retry;
        return;
      }
      retry.hidden = true;
      retry.textContent = i18nViewport.retry;
      if (state.status === 'loading') {
        const { loaded, total } = state.progress ?? {};
        stageProgress.hidden = !total;
        if (total) {
          stageBar.style.width = `${Math.round((loaded / total) * 100)}%`;
          stageMessage.textContent = i18nViewport.loadingWithTotal(loaded, total);
        } else {
          stageMessage.textContent = i18nViewport.loadingAnatomy;
        }
      }
    },

    /** Called when the camera moves or the viewport resizes, outside the state loop. */
    updateCamera(camera, distance, viewportHeight) {
      lastCameraArgs = { camera, distance, viewportHeight };
      const labels = edgeLabels(camera, currentLang);
      for (const [edge, node] of Object.entries(edges)) node.textContent = labels[edge];
      const measured = scaleBar(camera.fov, distance, viewportHeight);
      bar.hidden = !measured;
      if (!measured) return;
      barRule.style.width = `${Math.round(measured.pixels)}px`;
      barText.textContent = `${measured.millimetres} mm`;
    },

    showHover(label, position) {
      if (!label || !position) {
        hover.hidden = true;
        return;
      }
      hover.hidden = false;
      hover.textContent = label;
      const bounds = hover.parentElement.getBoundingClientRect();
      hover.style.left =
        `${Math.min(position.x + 14, bounds.width - hover.offsetWidth - 8)}px`;
      hover.style.top =
        `${Math.min(position.y + 14, bounds.height - hover.offsetHeight - 8)}px`;
    },

    dispose() {
      retry.removeEventListener('click', onRetry);
      views.replaceChildren();
    },
  };
}
