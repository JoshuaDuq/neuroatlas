import { quantity } from './format.js';

const HEMISPHERE_WORDS = { left: 'Left', right: 'Right', midline: 'Midline' };

/** The selected region: what it is, and what is measured about it. */
export function createInspector({ catalog, onFocus, onIsolate }) {
  const name = document.getElementById('selected-name');
  const hint = document.getElementById('selected-hint');
  const facts = document.getElementById('selected-facts');
  const hemisphere = document.getElementById('fact-hemisphere');
  const atlasName = document.getElementById('fact-atlas');
  const metricLabel = document.getElementById('fact-metric-label');
  const metric = document.getElementById('fact-metric');
  const source = document.getElementById('fact-source');
  const focus = document.getElementById('focus');
  const isolate = document.getElementById('isolate');

  focus.addEventListener('click', onFocus);
  isolate.addEventListener('click', onIsolate);

  return {
    update(state) {
      const region = state.selectedRegion;
      if (!region) {
        name.textContent = 'No region selected';
        hint.hidden = false;
        hint.textContent = state.cortexVisible
          ? 'Click the model, or search on the left.'
          : 'Cortex is hidden — internal structures are selectable.';
        facts.hidden = true;
        focus.disabled = true;
        isolate.disabled = true;
        isolate.setAttribute('aria-pressed', 'false');
        return;
      }

      const label = catalog.get(region.id).label;
      name.textContent = label.name;
      hint.hidden = true;
      facts.hidden = false;
      hemisphere.textContent = HEMISPHERE_WORDS[region.hemisphere] ?? region.hemisphere;
      atlasName.textContent = label.code ? `${region.atlas} · ${label.code}` : region.atlas;

      const isStructure = region.kind === 'structure';
      metricLabel.textContent = isStructure ? 'Volume' : 'Surface area';
      metric.textContent = isStructure
        ? quantity(region.segmentation_volume_mm3, 'mm³')
        : quantity(region.surface_area_mm2, 'mm²');
      source.textContent = String(region.source_label_id ?? '—');

      focus.disabled = false;
      isolate.disabled = false;
      isolate.setAttribute('aria-pressed', String(Boolean(state.isolatedRegion)));
    },
    dispose() {
      focus.removeEventListener('click', onFocus);
      isolate.removeEventListener('click', onIsolate);
    },
  };
}
