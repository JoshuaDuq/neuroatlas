import { networkCss, networkName } from '../catalog/networks.js';
import { t } from '../i18n/translations.js';

/** How the model is drawn: detail level, hemisphere, cortex, opacity, colours. */
export function createDisplay({ detailLevels, networks, ...handlers }) {
  const detail = document.getElementById('detail');
  const detailLabel = document.getElementById('detail-label');
  const hemisphere = document.getElementById('hemisphere');
  const cortex = document.getElementById('cortex');
  const opacity = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacity-value');
  const surfaceColor = document.getElementById('surface-color');
  const reset = document.getElementById('reset');
  const labelDisplay = document.getElementById('label-display');
  const hemiLabel = document.getElementById('display-hemisphere-label');
  const cortexText = document.getElementById('cortex-text');
  const opacityText = document.getElementById('opacity-text');
  const surfaceColorLabel = document.getElementById('surface-color-label');
  const legend = document.getElementById('network-legend');

  // A build without the network layer must not offer to colour by it. Removed
  // rather than disabled: an option that can never be chosen is not a choice.
  if (!networks) surfaceColor.querySelector('option[value="network"]')?.remove();

  /** The key to the colours on the model, shown only while they are on it. */
  function showLegend(state) {
    if (!legend) return;
    legend.hidden = !networks || state.surfaceColor !== 'network';
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

  // Populated from the manifest: a build without the optional fine level offers
  // one choice, and the control simply has nothing to switch between.
  for (const level of detailLevels) {
    const option = document.createElement('option');
    option.value = level.id;
    option.textContent = level.label;
    detail.append(option);
  }

  const listeners = [
    [detail, 'change', event => handlers.onDetail(event.target.value)],
    [hemisphere, 'change', event => handlers.onHemisphere(event.target.value)],
    [cortex, 'change', event => handlers.onCortexVisible(event.target.checked)],
    [opacity, 'input', event => handlers.onCortexOpacity(Number(event.target.value))],
    [surfaceColor, 'change', event => handlers.onSurfaceColor(event.target.value)],
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
        option.textContent = atlasDict[option.value] ?? option.textContent;
      }
      if (state.detail) detail.value = state.detail;
      detail.hidden = detailLevels.length < 2;
      if (detailLabel) detailLabel.hidden = detailLevels.length < 2;
      const optBoth = hemisphere.querySelector('option[value="both"]');
      const optLeft = hemisphere.querySelector('option[value="left"]');
      const optRight = hemisphere.querySelector('option[value="right"]');
      if (optBoth) optBoth.textContent = i18n.both;
      if (optLeft) optLeft.textContent = i18n.left;
      if (optRight) optRight.textContent = i18n.right;

      if (cortexText) cortexText.textContent = i18n.showCortex;
      if (opacityText) opacityText.textContent = i18n.cortexOpacity;
      if (surfaceColorLabel) surfaceColorLabel.textContent = i18n.surfaceColor;
      for (const option of surfaceColor.options) {
        option.textContent = i18n.surfaceColors[option.value] ?? option.value;
      }
      reset.textContent = i18n.resetView;

      hemisphere.value = state.hemisphere;
      cortex.checked = state.cortexVisible;
      surfaceColor.value = state.surfaceColor;
      showLegend(state);
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
