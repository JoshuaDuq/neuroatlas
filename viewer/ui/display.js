/** How the model is drawn: hemisphere, cortex, opacity, atlas colours. */
export function createDisplay(handlers) {
  const hemisphere = document.getElementById('hemisphere');
  const cortex = document.getElementById('cortex');
  const opacity = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacity-value');
  const atlasColors = document.getElementById('atlas-colors');
  const reset = document.getElementById('reset');

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
