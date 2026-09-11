import { quantity } from './format.js';
import { t } from '../i18n/translations.js';

/** The selected region: what it is, and what is measured about it. */
export function createInspector({ catalog, atlases, onFocus, onIsolate }) {
  const inspectorPanel = document.getElementById('inspector');
  const labelSelected = document.getElementById('label-selected');
  const factHemiLabel = document.getElementById('fact-hemisphere-label');
  const factAtlasLabel = document.getElementById('fact-atlas-label');
  const factSourceLabel = document.getElementById('fact-source-label');
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
      const i18n = t(state.lang, 'inspector');
      const atlasDict = t(state.lang, 'atlases');
      const sideWords = t(state.lang, 'sides').capitalized;

      if (inspectorPanel) inspectorPanel.setAttribute('aria-label', i18n.panelLabel);
      if (labelSelected) labelSelected.textContent = i18n.selectedHeading;
      if (factHemiLabel) factHemiLabel.textContent = i18n.hemisphere;
      if (factAtlasLabel) factAtlasLabel.textContent = i18n.atlas;
      if (factSourceLabel) factSourceLabel.textContent = i18n.sourceLabel;
      focus.textContent = i18n.focus;
      isolate.textContent = i18n.isolate;

      const region = state.selectedRegion;
      if (!region) {
        name.textContent = i18n.noRegionSelected;
        hint.hidden = false;
        hint.textContent = state.cortexVisible ? i18n.hintCortex : i18n.hintStructures;
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
      hemisphere.textContent = sideWords[region.hemisphere] ?? region.hemisphere;
      const sourceName = atlasDict[region.atlas] ?? atlasDict.aseg;
      atlasName.textContent = label.code
        ? `${sourceName} · ${label.code}`
        : sourceName;

      const isStructure = region.kind === 'structure';
      metricLabel.textContent = isStructure ? i18n.volume : i18n.surfaceArea;
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
