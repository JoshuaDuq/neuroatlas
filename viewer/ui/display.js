import { atlasSwitchLabel, t } from '../i18n/translations.js';

/**
 * How much of the model is drawn: detail level, hemisphere, cortex, opacity.
 *
 * What the surface is coloured by is a masthead control, not one of these:
 * it says what the picture means rather than how much of it is showing.
 */
export function createDisplay({ detailLevels, hasSpinalCord = true, ...handlers }) {
  const detail = document.getElementById('detail');
  const detailLabel = document.getElementById('detail-label');
  const hemisphere = document.getElementById('hemisphere');
  const cortex = document.getElementById('cortex');
  const opacity = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacity-value');
  const spinalCord = document.getElementById('spinal-cord');
  const spinalCordText = document.getElementById('spinal-cord-text');
  const spinalCordLabel = document.getElementById('spinal-cord-label');
  const reset = document.getElementById('reset');
  const labelDisplay = document.getElementById('label-display');
  const hemiLabel = document.getElementById('display-hemisphere-label');
  const cortexText = document.getElementById('cortex-text');
  const opacityText = document.getElementById('opacity-text');

  // Populated from the manifest: a build without the optional fine level offers
  // one choice, and the control simply has nothing to switch between.
  for (const level of detailLevels) {
    const option = document.createElement('option');
    option.value = level.id;
    option.textContent = level.label;
    detail.append(option);
  }

  const onHemisphereClick = event => {
    const button = event.target.closest('[data-hemisphere]');
    if (button) handlers.onHemisphere(button.dataset.hemisphere);
  };

  const listeners = [
    [detail, 'change', event => handlers.onDetail(event.target.value)],
    [hemisphere, 'click', onHemisphereClick],
    [cortex, 'change', event => handlers.onCortexVisible(event.target.checked)],
    [opacity, 'input', event => handlers.onCortexOpacity(Number(event.target.value))],
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
      const i18n = t(state.lang, 'display');
      if (labelDisplay) labelDisplay.textContent = i18n.sectionHeading;
      if (hemiLabel) hemiLabel.textContent = i18n.hemisphere;
      if (detailLabel) detailLabel.textContent = i18n.internalAnatomy;
      const atlasDict = t(state.lang, 'atlases');
      for (const option of detail.options) {
        option.textContent = atlasSwitchLabel(option.value, state.lang);
        option.title = atlasDict[option.value] ?? option.textContent;
      }
      if (state.detail) detail.value = state.detail;
      detail.hidden = detailLevels.length < 2;
      if (detailLabel) detailLabel.hidden = detailLevels.length < 2;
      if (hemiLabel) hemisphere.setAttribute('aria-labelledby', hemiLabel.id);
      for (const button of hemisphere.querySelectorAll('[data-hemisphere]')) {
        const key = button.dataset.hemisphere;
        button.textContent = i18n[key] ?? key;
        button.setAttribute('aria-pressed', String(key === state.hemisphere));
      }

      if (cortexText) cortexText.textContent = i18n.showCortex;
      if (opacityText) opacityText.textContent = i18n.cortexOpacity;
      if (spinalCordText) spinalCordText.textContent = i18n.showSpinalCord;
      if (spinalCordLabel) spinalCordLabel.hidden = !hasSpinalCord;
      reset.textContent = i18n.resetView;
      cortex.checked = state.cortexVisible;
      if (spinalCord) spinalCord.checked = state.spinalCordVisible === true;
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
