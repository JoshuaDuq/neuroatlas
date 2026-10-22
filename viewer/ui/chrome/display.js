import { t } from '../../i18n/translations.js';
import { isIndependentTractReference } from '../../diffusion/presentation.js';
import { percent } from '../format.js';

/**
 * How much of the model is drawn: the stage's Display popover (hemisphere,
 * cortex, opacity, internal anatomy, spinal cord), and Reset view, which sits
 * with the camera at the foot of the View popover.
 */
export function createDisplay({ hasSpinalCord = true, ...handlers }) {
  const hemisphere = document.getElementById('hemisphere');
  const cortex = document.getElementById('cortex');
  const opacity = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacity-value');
  const internal = document.getElementById('internal-visible');
  const internalText = document.getElementById('internal-visible-text');
  const spinalCord = document.getElementById('spinal-cord');
  const spinalCordLabel = document.getElementById('spinal-cord-label');
  const spinalCordText = document.getElementById('spinal-cord-text');
  const reset = document.getElementById('reset');
  const resetText = document.getElementById('reset-text');
  const hemiLabel = document.getElementById('display-hemisphere-label');
  const cortexText = document.getElementById('cortex-text');
  const opacityText = document.getElementById('opacity-text');
  const opacityRow = document.getElementById('display-opacity');

  const onHemisphereClick = event => {
    const button = event.target.closest('[data-hemisphere]');
    // The active side is already showing. A second click must not refit the
    // camera and throw away the orbit the reader just made.
    if (!button || button.getAttribute('aria-pressed') === 'true') return;
    handlers.onHemisphere(button.dataset.hemisphere);
  };

  const listeners = [
    [hemisphere, 'click', onHemisphereClick],
    [cortex, 'change', event => handlers.onCortexVisible(event.target.checked)],
    [opacity, 'input', event => handlers.onCortexOpacity(Number(event.target.value))],
    ...(internal && handlers.onInternalVisible ? [
      [internal, 'change', event => handlers.onInternalVisible(event.target.checked)],
    ] : []),
    ...(spinalCord && handlers.onSpinalCordVisible ? [
      [spinalCord, 'change', event => handlers.onSpinalCordVisible(event.target.checked)],
    ] : []),
    [reset, 'click', handlers.onReset],
  ];
  for (const [element, type, listener] of listeners) {
    element.addEventListener(type, listener);
  }

  return {
    update(state) {
      for (const node of document.querySelectorAll('[data-anatomy-display]')) {
        node.hidden = isIndependentTractReference(state);
      }
      const i18n = t(state.lang, 'display');
      if (hemiLabel) hemiLabel.textContent = i18n.hemisphere;
      if (hemiLabel) hemisphere.setAttribute('aria-labelledby', hemiLabel.id);
      for (const button of hemisphere.querySelectorAll('[data-hemisphere]')) {
        const key = button.dataset.hemisphere;
        button.textContent = i18n[key] ?? key;
        button.setAttribute('aria-pressed', String(key === state.hemisphere));
      }

      if (cortexText) cortexText.textContent = i18n.showCortex;
      if (opacityText) opacityText.textContent = i18n.cortexOpacity;
      if (internalText) internalText.textContent = i18n.showInternal;
      if (spinalCordText) spinalCordText.textContent = i18n.showSpinalCord;
      // Absent rather than disabled, as in the masthead: a choice that can never be made is not one.
      // The S key still says why there is nothing to show.
      spinalCordLabel.hidden = !hasSpinalCord;
      resetText.textContent = i18n.resetView;
      cortex.checked = state.cortexVisible;
      if (internal) internal.checked = state.internalVisible !== false;
      if (spinalCord) spinalCord.checked = state.spinalCordVisible === true;
      // Do not fight the reader's thumb while they are dragging the slider.
      if (document.activeElement !== opacity) opacity.value = String(state.cortexOpacity);
      opacityValue.value = percent(state.cortexOpacity, state.lang);
      opacity.setAttribute('aria-valuetext', percent(Number(opacity.value), state.lang));
      // A hidden cortex has no opacity to set, so the slider goes rather than greys.
      opacityRow.hidden = !state.cortexVisible;
    },
    dispose() {
      for (const [element, type, listener] of listeners) {
        element.removeEventListener(type, listener);
      }
    },
  };
}
