import { quantity } from './format.js';
import { networkCss, networkName, networksOf } from '../catalog/networks.js';
import { t } from '../i18n/translations.js';

/** The selected region: what it is, and what is measured about it. */
export function createInspector({ catalog, atlases, networks, onFocus, onIsolate }) {
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
  const actions = focus.closest('.actions');
  const networkSection = document.getElementById('region-networks');
  const networkHeading = document.getElementById('label-networks');
  const networkList = document.getElementById('network-list');
  const networkNote = document.getElementById('network-note');

  focus.addEventListener('click', onFocus);
  isolate.addEventListener('click', onIsolate);

  /**
   * What share of this region's surface each network holds.
   *
   * Absent for a region the build carried no network field for — subcortical
   * structures, and every region if the layer was not built — and the section
   * is then not shown at all rather than shown empty.
   */
  function showNetworks(region, lang) {
    if (!networkSection) return;
    const i18n = t(lang, 'networks');
    const shares = networksOf(region);
    networkSection.hidden = shares.length === 0;
    if (!shares.length) return;
    networkHeading.textContent = i18n.heading;
    networkNote.textContent = i18n.note;
    networkList.replaceChildren(...shares.map(share => {
      const row = document.createElement('li');
      row.className = 'network-row';
      const label = document.createElement('span');
      label.className = 'network-row-name';
      label.textContent = networkName(share.network, lang);
      const swatch = networks?.colors?.[share.network];
      if (swatch) {
        row.dataset.colored = 'true';
        row.style.setProperty('--network-color', networkCss(swatch));
      }
      const bar = document.createElement('span');
      bar.className = 'network-bar';
      bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span');
      fill.style.width = `${share.fraction * 100}%`;
      bar.append(fill);
      const value = document.createElement('span');
      value.className = 'network-share measure';
      value.textContent = i18n.share(share.fraction);
      row.append(label, bar, value);
      return row;
    }));
  }

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
      // While a deficit is being explored the panel already leads with it, so
      // an empty selection block above that answers a question nobody asked.
      const quiet = !region && state.explorer === 'deficits';
      name.hidden = quiet;
      if (actions) actions.hidden = quiet;
      if (labelSelected) labelSelected.hidden = quiet;

      if (!region) {
        name.textContent = i18n.noRegionSelected;
        hint.hidden = quiet;
        hint.textContent = state.cortexVisible ? i18n.hintCortex : i18n.hintStructures;
        facts.hidden = true;
        showNetworks(null, state.lang);
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
      showNetworks(region, state.lang);

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
