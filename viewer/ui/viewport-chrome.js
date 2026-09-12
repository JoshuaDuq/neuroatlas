import { edgeLabels } from '../render/orientation.js';
import { scaleBar } from '../render/scale-bar.js';
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
export function createViewportChrome({ onView, onRetry, onReticleSelect }) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const hover = document.getElementById('hover-label');
  const host = document.getElementById('viewport');
  const reticle = document.getElementById('reticle');
  const readout = document.getElementById('reticle-readout');
  const readoutName = document.createElement('span');
  readoutName.className = 'reticle-readout-name';
  const readoutAction = document.createElement('span');
  readoutAction.className = 'reticle-readout-action';
  readout.append(readoutName, readoutAction);
  const stage = document.getElementById('stage');
  const stageMessage = document.getElementById('stage-message');
  const stageProgress = document.getElementById('stage-progress');
  const stageBar = document.getElementById('stage-bar');
  const retry = document.getElementById('stage-retry');
  let currentLang = 'en';
  let lastCameraArgs = null;
  let lastRect = null;
  let reticleRegion = null;
  let reticleEnabled = false;

  /*
   * Do the presets and the scale bar still fit on one line? Asked of the
   * rectangle the reader can see, not the window: two 320px rails leave a
   * 1100px window a 460px stage, and the bar was painted over the presets
   * there. Natural content widths, so applying the answer cannot change it.
   */
  function fitChrome() {
    if (!lastRect?.width) return;
    const needed = views.scrollWidth + (bar.hidden ? 0 : bar.scrollWidth) + CHROME_GUTTERS_PX;
    host.dataset.chrome = needed > lastRect.width ? 'tight' : 'wide';
  }

  const onReadout = () => {
    if (reticleRegion) onReticleSelect?.(reticleRegion.id);
  };
  readout.addEventListener('click', onReadout);

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

    /**
     * Turn the crosshair on for touch. It replaces hover rather than adding a
     * second way to select: a finger has no hover, and a Destrieux sulcal
     * band is narrower than the finger that would have to land on it.
     */
    setReticle(enabled) {
      reticleEnabled = enabled;
      reticle.hidden = !enabled;
      readout.hidden = !enabled;
      if (!enabled) reticleRegion = null;
    },

    /** What the crosshair is over now. Called on every camera change. */
    showReticleRegion(region, label) {
      if (!reticleEnabled) return;
      reticleRegion = region;
      const copy = t(currentLang, 'viewport');
      readoutName.textContent = label ?? copy.reticleEmpty;
      readoutAction.textContent = region ? copy.reticleAction : '';
      readout.dataset.empty = String(!region);
      readout.disabled = !region;
      readout.setAttribute('aria-label',
        region ? `${copy.reticleAria}: ${label}` : copy.reticleEmpty);
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
      const ready = state.status === 'ready' || state.status === 'switching';
      orientation.hidden = !ready;
      if (!ready) bar.hidden = true;
      if (reticleEnabled) {
        reticle.hidden = !ready;
        readout.hidden = !ready;
      }

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
      readout.removeEventListener('click', onReadout);
      readout.replaceChildren();
      views.replaceChildren();
    },
  };
}
