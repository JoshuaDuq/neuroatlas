import { t } from '../i18n/translations.js';

/** How the model is drawn: hemisphere, cortex, opacity, atlas colours. */
export function createDisplay(handlers) {
  const hemisphere = document.getElementById('hemisphere');
  const cortex = document.getElementById('cortex');
  const opacity = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacity-value');
  const atlasColors = document.getElementById('atlas-colors');
  const reset = document.getElementById('reset');
  const labelDisplay = document.getElementById('label-display');
  const hemiLabel = document.getElementById('display-hemisphere-label');
  const cortexText = document.getElementById('cortex-text');
  const opacityText = document.getElementById('opacity-text');
  const atlasColorsText = document.getElementById('atlas-colors-text');

  const listeners = [
    [hemisphere, 'change', event => handlers.onHemisphere(event.target.value)],
    [cortex, 'change', event => handlers.onCortexVisible(event.target.checked)],
    [opacity, 'input', event => handlers.onCortexOpacity(Number(event.target.value))],
    [atlasColors, 'change', event => handlers.onAtlasColors(event.target.checked)],
    [reset, 'click', handlers.onReset],
  ];
  for (const [element, type, listener] of listeners) {
    element.addEventListener(type, listener);
  }

  return {
    update(state) {
      const i18n = t(state.lang, 'display');
      if (labelDisplay) labelDisplay.textContent = i18n.sectionHeading;
      if (hemiLabel) hemiLabel.textContent = i18n.hemisphere;
      const optBoth = hemisphere.querySelector('option[value="both"]');
      const optLeft = hemisphere.querySelector('option[value="left"]');
      const optRight = hemisphere.querySelector('option[value="right"]');
      if (optBoth) optBoth.textContent = i18n.both;
      if (optLeft) optLeft.textContent = i18n.left;
      if (optRight) optRight.textContent = i18n.right;

      if (cortexText) cortexText.textContent = i18n.showCortex;
      if (opacityText) opacityText.textContent = i18n.cortexOpacity;
      if (atlasColorsText) atlasColorsText.textContent = i18n.atlasColors;
      reset.textContent = i18n.resetView;

      hemisphere.value = state.hemisphere;
      cortex.checked = state.cortexVisible;
      atlasColors.checked = state.atlasColors;
      // Do not fight the reader's thumb while they are dragging the slider.
      if (document.activeElement !== opacity) opacity.value = String(state.cortexOpacity);
      opacityValue.value = `${Math.round(state.cortexOpacity * 100)}%`;
      opacity.disabled = !state.cortexVisible;
    },
    dispose() {
      for (const [element, type, listener] of listeners) {
        element.removeEventListener(type, listener);
      }
    },
  };
}
