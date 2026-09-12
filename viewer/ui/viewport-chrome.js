import { edgeLabels } from '../render/orientation.js';
import { scaleBar } from '../render/scale-bar.js';
import { networkCss, networkName } from '../catalog/networks.js';
import { t } from '../i18n/translations.js';

const VIEW_KEYS = ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/** Both margins plus the least gap allowed between the presets and the bar. */
const CHROME_GUTTERS_PX = 48;

/**
 * Everything drawn over the canvas: anatomical orientation, the scale bar,
 * the view presets, and the loading and error stage.
 *
 * Overlays sit on near-opaque chips because the geometry beneath them runs
 * from near-black crevices to near-white speculars, so no fixed text colour
 * would be legible against all of it.
 */
export function createViewportChrome({ networks, onView, onRetry }) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const legend = document.getElementById('network-legend');
  const host = document.getElementById('viewport');
  const stage = document.getElementById('stage');
  const stageMessage = document.getElementById('stage-message');
  const stageProgress = document.getElementById('stage-progress');
  const stageBar = document.getElementById('stage-bar');
  const retry = document.getElementById('stage-retry');
  let currentLang = 'en';
  let lastCameraArgs = null;
  let lastRect = null;

  /*
   * Do the presets and the scale bar still fit on one line? Asked of the
   * rectangle the reader can see, not the window: two 320px rails leave a
   * 1100px window a 460px stage, and the bar was painted over the presets
   * there.
   *
   * Measured from the buttons, never from the row that holds them. The tight
   * rule stretches that row across the stage, so its own width reports the
   * stretch rather than the content: once tight was entered it could never be
   * left, and a 1440px window kept the bar pinned to the top edge.
   */
  function fitChrome() {
    if (!lastRect?.width) return;
    const presets = buttons.reduce((total, button) => total + button.offsetWidth, 0)
      - Math.max(0, buttons.length - 1); // the buttons overlap by their shared border
    const needed = presets + (bar.hidden ? 0 : bar.scrollWidth) + CHROME_GUTTERS_PX;
    host.dataset.chrome = needed > lastRect.width ? 'tight' : 'wide';
  }

  /*
   * The key to the colours on the model. On the stage rather than in a panel:
   * a key that is not beside the picture it explains is not a key, and the
   * reader would have to leave the anatomy to read it.
   */
  function showLegend(state) {
    if (!legend) return;
    legend.hidden = !networks || state.surfaceColor !== 'network'
      || !(state.status === 'ready' || state.status === 'switching');
    if (legend.hidden) return;
    legend.replaceChildren(...networks.networks.map(key => {
      const row = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'network-swatch';
      swatch.style.background = networkCss(networks.colors[key]);
      const label = document.createElement('span');
      label.textContent = networkName(key, state.lang);
      row.append(swatch, label);
      return row;
    }));
  }

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
    /**
     * Place every overlay against the rectangle the reader can actually see.
     *
     * On a phone the sheet covers the lower canvas; markers pinned to the
     * canvas edge would sit behind it, and the inferior marker would be
     * invisible exactly when a reader needs to know which way is down.
     */
    setViewport(rect) {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height || !rect) return;
      lastRect = rect;
      host.style.setProperty('--vis-top', `${Math.round(rect.y)}px`);
      host.style.setProperty('--vis-left', `${Math.round(rect.x)}px`);
      host.style.setProperty('--vis-right', `${Math.round(width - rect.x - rect.width)}px`);
      host.style.setProperty('--vis-bottom', `${Math.round(height - rect.y - rect.height)}px`);
      host.style.setProperty('--vis-cx', `${Math.round(rect.x + rect.width / 2)}px`);
      host.style.setProperty('--vis-cy', `${Math.round(rect.y + rect.height / 2)}px`);
      fitChrome();
    },

    update(state) {
      currentLang = state.lang;
      const i18nViewport = t(state.lang, 'viewport');
      const viewLabels = t(state.lang, 'views');
      views.setAttribute('aria-label', i18nViewport.viewAria);

      for (const button of buttons) {
        button.textContent = viewLabels[button.dataset.view] ?? button.dataset.view;
        button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
      }
      showLegend(state);
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
      fitChrome();
    },

    dispose() {
      retry.removeEventListener('click', onRetry);
      views.replaceChildren();
      legend?.replaceChildren();
    },
  };
}
