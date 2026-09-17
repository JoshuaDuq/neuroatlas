import { quantity } from './format.js';
import { networkCss, networkName, networksOf } from '../catalog/networks.js';
import { atlasSwitchLabel, t } from '../i18n/translations.js';

/** The selected region: what it is, and what is measured about it. */
export function createInspector({ catalog, networks, onFocus, onIsolate, onSliceTo, centroidOf }) {
  const inspectorPanel = document.getElementById('inspector');
  const labelSelected = document.getElementById('label-selected');
  const factHemiLabel = document.getElementById('fact-hemisphere-label');
  const factAtlasLabel = document.getElementById('fact-atlas-label');
  const factGroupLabel = document.getElementById('fact-group-label');
  const factCoordsLabel = document.getElementById('fact-coords-label');
  const factSourceLabel = document.getElementById('fact-source-label');
  const name = document.getElementById('selected-name');
  const hint = document.getElementById('selected-hint');
  const facts = document.getElementById('selected-facts');
  const hemisphere = document.getElementById('fact-hemisphere');
  const atlasName = document.getElementById('fact-atlas');
  const factGroup = document.getElementById('fact-group');
  const metricLabel = document.getElementById('fact-metric-label');
  const metric = document.getElementById('fact-metric');
  const factCoords = document.getElementById('fact-coords');
  const source = document.getElementById('fact-source');
  const focus = document.getElementById('focus');
  const isolate = document.getElementById('isolate');
  const sliceTo = document.getElementById('slice-to');
  const actions = focus.closest('.actions');
  const regionMpr = document.getElementById('region-mpr');
  const viewStatus = document.getElementById('view-status');
  const viewAtlas = document.getElementById('view-atlas');
  const viewSurface = document.getElementById('view-surface');
  const viewHemi = document.getElementById('view-hemi');
  const viewCut = document.getElementById('view-cut');
  const viewAtlasLabel = document.getElementById('view-atlas-label');
  const viewSurfaceLabel = document.getElementById('view-surface-label');
  const viewHemiLabel = document.getElementById('view-hemi-label');
  const viewCutLabel = document.getElementById('view-cut-label');
  const networkSection = document.getElementById('region-networks');
  const networkHeading = document.getElementById('label-networks');
  const networkList = document.getElementById('network-list');
  const networkNote = document.getElementById('network-note');

  focus.addEventListener('click', onFocus);
  isolate.addEventListener('click', onIsolate);
  const onSliceToClick = () => onSliceTo?.();
  sliceTo?.addEventListener('click', onSliceToClick);

  function networkRow(share, lang, i18n) {
    const row = document.createElement('li');
    row.className = 'network-row';
    const swatch = document.createElement('span');
    swatch.className = 'network-swatch';
    const color = networks?.colors?.[share.network];
    if (color) swatch.style.background = networkCss(color);
    const label = document.createElement('span');
    label.className = 'network-row-name';
    label.textContent = networkName(share.network, lang);
    const bar = document.createElement('span');
    bar.className = 'network-bar';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.style.width = `${share.fraction * 100}%`;
    bar.append(fill);
    const value = document.createElement('span');
    value.className = 'network-share measure';
    value.textContent = i18n.share(share.fraction);
    row.append(swatch, label, bar, value);
    return row;
  }

  /**
   * What share of this region’s surface each network holds.
   *
   * A region the build carried no network field for — every subcortical
   * structure, and everything if the layer was not built — leaves the section
   * hidden rather than shown empty.
   */
  function showNetworks(region, state) {
    if (!networkSection) return;
    const i18n = t(state.lang, 'networks');
    const shares = networksOf(region);
    networkSection.hidden = shares.length === 0;
    if (!shares.length) return;
    networkHeading.textContent = i18n.heading;
    networkNote.textContent = i18n.note;
    networkList.replaceChildren(...shares.map(share => networkRow(share, state.lang, i18n)));
  }

  return {
    update(state, { cutMode } = {}) {
      const i18n = t(state.lang, 'inspector');
      const atlasDict = t(state.lang, 'atlases');
      const displayI18n = t(state.lang, 'display');
      const cutsI18n = t(state.lang, 'cuts');
      const sideWords = t(state.lang, 'sides').capitalized;

      if (inspectorPanel) inspectorPanel.setAttribute('aria-label', i18n.panelLabel);
      if (labelSelected) labelSelected.textContent = i18n.selectedHeading;
      if (factHemiLabel) factHemiLabel.textContent = i18n.hemisphere;
      if (factAtlasLabel) factAtlasLabel.textContent = i18n.atlas;
      if (factGroupLabel) factGroupLabel.textContent = i18n.group;
      if (factCoordsLabel) factCoordsLabel.textContent = i18n.centroid;
      if (factSourceLabel) factSourceLabel.textContent = i18n.sourceLabel;
      focus.textContent = i18n.focus;
      isolate.textContent = i18n.isolate;
      if (sliceTo) sliceTo.textContent = i18n.sliceTo;

      const region = state.selectedRegion;
      // While a deficit is being explored the panel already leads with it, so
      // an empty selection block above that answers a question nobody asked.
      const quiet = !region && state.explorer === 'deficits';
      // An empty instrument does not title its emptiness. The hint is the
      // instruction; the 17px name is reserved for a region.
      name.hidden = quiet || !region;
      // Focus and Isolate act on a selection; greyed out with none they are
      // the dead weight at the top of an otherwise empty rail.
      if (actions) actions.hidden = quiet || !region;
      if (regionMpr) regionMpr.hidden = quiet || !region;
      if (labelSelected) labelSelected.hidden = quiet;
      if (viewStatus) viewStatus.hidden = quiet || !!region;

      if (!region) {
        name.textContent = i18n.noRegionSelected;
        hint.hidden = quiet;
        hint.textContent = state.cortexVisible ? i18n.hintCortex : i18n.hintStructures;
        facts.hidden = true;
        if (viewStatus && !viewStatus.hidden) {
          if (viewAtlasLabel) viewAtlasLabel.textContent = i18n.atlas;
          if (viewSurfaceLabel) viewSurfaceLabel.textContent = i18n.viewSurface;
          if (viewHemiLabel) viewHemiLabel.textContent = i18n.hemisphere;
          if (viewCutLabel) viewCutLabel.textContent = i18n.viewCut;
          if (viewAtlas) viewAtlas.textContent = atlasSwitchLabel(state.atlas, state.lang);
          if (viewSurface) {
            viewSurface.textContent = displayI18n.surfaceColors[state.surfaceColor]
              ?? state.surfaceColor;
          }
          if (viewHemi) viewHemi.textContent = displayI18n[state.hemisphere] ?? state.hemisphere;
          if (viewCut) {
            const plane = cutMode ?? 'off';
            viewCut.textContent = cutsI18n.modes[plane] ?? plane;
          }
        }
        if (factGroup) factGroup.textContent = '';
        if (factCoords) factCoords.textContent = '';
        if (networkSection) networkSection.hidden = true;
        focus.disabled = true;
        isolate.disabled = true;
        if (sliceTo) sliceTo.disabled = true;
        isolate.setAttribute('aria-pressed', 'false');
        return;
      }

      const label = catalog.get(region.id).label;
      name.hidden = false;
      name.textContent = label.name;
      hint.hidden = !region.notes;
      hint.textContent = region.notes?.[state.lang] ?? '';
      facts.hidden = false;
      hemisphere.textContent = sideWords[region.hemisphere] ?? region.hemisphere;
      const sourceName = atlasSwitchLabel(region.atlas, state.lang)
        || atlasDict[region.atlas]
        || atlasDict.aseg;
      atlasName.textContent = label.code
        ? `${sourceName} · ${label.code}`
        : sourceName;
      if (factGroup) factGroup.textContent = label.group ?? '—';

      const measuredByVolume = region.kind === 'structure' || region.kind === 'tissue-region';
      metricLabel.textContent = measuredByVolume ? i18n.volume : i18n.surfaceArea;
      metric.textContent = measuredByVolume
        ? quantity(region.segmentation_volume_mm3, 'mm³')
        : quantity(region.surface_area_mm2, 'mm²');

      if (factCoords) {
        const coords = centroidOf?.(region.id);
        if (coords) {
          const [r, a, s] = coords;
          const formatRas = n => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
          factCoords.replaceChildren();
          for (const [axis, value] of [['R', r], ['A', a], ['S', s]]) {
            const token = document.createElement('span');
            token.className = 'ras-token';
            token.textContent = axis === 'S'
              ? `${axis} ${formatRas(value)} mm`
              : `${axis} ${formatRas(value)}`;
            factCoords.append(token);
          }
        } else {
          factCoords.textContent = '—';
        }
      }

      source.textContent = region.source_label_ids
        ? `${region.source_atlas}: ${region.source_label_ids.join(', ')}`
        : String(region.source_label_id ?? '—');
      showNetworks(region, state);

      focus.disabled = false;
      isolate.disabled = false;
      isolate.setAttribute('aria-pressed', String(Boolean(state.isolatedRegion)));
      if (sliceTo) sliceTo.disabled = !centroidOf?.(region.id);
    },
    dispose() {
      focus.removeEventListener('click', onFocus);
      isolate.removeEventListener('click', onIsolate);
      sliceTo?.removeEventListener('click', onSliceToClick);
    },
  };
}
