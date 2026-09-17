import { edgeLabels } from '../render/orientation.js';
import { scaleBar } from '../render/scale-bar.js';
import { networkCss, networkName } from '../catalog/networks.js';
import { t } from '../i18n/translations.js';

const VIEW_KEYS = ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/** Both margins plus the least gap allowed between the presets and the bar. */
const CHROME_GUTTERS_PX = 48;

/**
 * Everything drawn over the canvas: anatomical orientation, the scale bar,
 * the view presets, the hover label, and the loading and error stage.
 *
 * Overlays sit on near-opaque chips because the geometry beneath them runs
 * from near-black crevices to near-white speculars, so no fixed text colour
 * would be legible against all of it.
 */
export function createViewportChrome({ networks, onView, onRetry, onSnapshot }) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const hover = document.getElementById('hover-label');
  const legend = document.getElementById('network-legend');
  const host = document.getElementById('viewport');
  const fullscreenButton = document.getElementById('viewport-fullscreen');
  const snapshotButton = document.getElementById('viewport-snapshot');
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
   * Measured from the buttons, never from the row that holds them. A max-width
   * on the plate can clip it, and scrollWidth would then report the clip.
   */
  let cachedPresetsWidth = null;
  function presetsWidth() {
    if (cachedPresetsWidth === null) {
      cachedPresetsWidth = buttons.reduce((total, button) => total + button.offsetWidth, 0);
    }
    return cachedPresetsWidth;
  }

  function fitChrome() {
    if (!lastRect?.width) return;
    const needed = presetsWidth() + (bar.hidden ? 0 : bar.scrollWidth) + CHROME_GUTTERS_PX;
    const mode = needed > lastRect.width ? 'tight' : 'wide';
    if (host.dataset.chrome !== mode) host.dataset.chrome = mode;
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
  const onSnapshotClick = () => onSnapshot?.();
  snapshotButton?.addEventListener('click', onSnapshotClick);
  const onFullscreenClick = () => {
    if (!document.fullscreenElement) {
      host.requestFullscreen?.().catch(err => console.error('Fullscreen failed:', err));
    } else {
      document.exitFullscreen?.().catch(err => console.error('Exit fullscreen failed:', err));
    }
  };
  fullscreenButton?.addEventListener('click', onFullscreenClick);

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
      if (lastRect && lastRect.x === rect.x && lastRect.y === rect.y &&
          lastRect.width === rect.width && lastRect.height === rect.height) {
        return;
      }
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
      if (currentLang !== state.lang) cachedPresetsWidth = null;
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
      if (snapshotButton) {
        snapshotButton.setAttribute('aria-label', i18nViewport.snapshot);
        snapshotButton.title = i18nViewport.snapshot;
        snapshotButton.disabled = !ready;
        const label = snapshotButton.querySelector('.masthead-action-label');
        if (label) label.textContent = i18nViewport.snapshot;
      }
      if (fullscreenButton) {
        fullscreenButton.setAttribute('aria-label', i18nViewport.fullscreen);
        fullscreenButton.title = i18nViewport.fullscreen;
        fullscreenButton.disabled = !ready;
        const label = fullscreenButton.querySelector('.masthead-action-label');
        if (label) label.textContent = i18nViewport.fullscreen;
      }

      if (lastCameraArgs) {
        const labels = edgeLabels(lastCameraArgs.camera, currentLang);
        for (const [edge, node] of Object.entries(edges)) {
          if (node.textContent !== labels[edge]) node.textContent = labels[edge];
        }
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
      for (const [edge, node] of Object.entries(edges)) {
        if (node.textContent !== labels[edge]) node.textContent = labels[edge];
      }
      const measured = scaleBar(camera.fov, distance, viewportHeight);
      const wasHidden = bar.hidden;
      bar.hidden = !measured;
      if (!measured) {
        if (!wasHidden) fitChrome();
        return;
      }
      const pixels = `${Math.round(measured.pixels)}px`;
      if (barRule.style.width !== pixels) barRule.style.width = pixels;
      const text = `${measured.millimetres} mm`;
      if (barText.textContent !== text) barText.textContent = text;
      if (wasHidden) fitChrome();
    },

    /**
     * Name what the pointer is over, beside the pointer.
     *
     * On the chip rather than in a rail: the reader is reading the cut face,
     * and a name that appears at the far edge of the screen is a name they
     * have to leave the anatomy to find.
     */
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
      snapshotButton?.removeEventListener('click', onSnapshotClick);
      fullscreenButton?.removeEventListener('click', onFullscreenClick);
      views.replaceChildren();
      legend?.replaceChildren();
    },
  };
}
