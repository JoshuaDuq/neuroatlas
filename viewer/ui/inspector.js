import { count, formatRas, quantity } from './format.js';
import { networkCss, networkName, networksOf } from '../catalog/networks.js';
import { atlasSwitchLabel, t } from '../i18n/translations.js';

/**
 * What the inspector shows when a region is or is not selected.
 *
 * The empty anatomy panel is a hint. It does not repeat atlas, surface,
 * hemisphere or cut — those belong to the View and Sections tasks.
 */
export function inspectorEmptyChrome({ selectedRegion, explorer }) {
  const hasRegion = Boolean(selectedRegion);
  const quiet = !hasRegion && explorer !== 'anatomy';
  return {
    hideTitle: !hasRegion,
    hideHint: quiet,
    hideFacts: !hasRegion,
    hideActions: !hasRegion,
  };
}

/** A learning-atlas union can carry fifty source ids; past this many they are counted. */
const MAX_LISTED_SOURCE_IDS = 8;

/** The selected region: what it is, and what is measured about it. */
export function createInspector({ catalog, networks, onFocus, onIsolate, onHide, onClear, centroidOf }) {
  const inspectorPanel = document.getElementById('inspector');
  const title = document.getElementById('inspector-title');
  const empty = document.getElementById('selection-empty');
  const emptyTitle = document.getElementById('selection-empty-title');
  const metadata = document.getElementById('region-source');
  const metadataTitle = document.getElementById('region-source-title');
  const labelSelected = document.getElementById('label-selected');
  const factHemiLabel = document.getElementById('fact-hemisphere-label');
  const factGroupLabel = document.getElementById('fact-group-label');
  const factCoordsLabel = document.getElementById('fact-coords-label');
  const factSourceLabel = document.getElementById('fact-source-label');
  const name = document.getElementById('selected-name');
  const hint = document.getElementById('selected-hint');
  const facts = document.getElementById('selected-facts');
  const hemisphere = document.getElementById('fact-hemisphere');
  const factGroup = document.getElementById('fact-group');
  const metricLabel = document.getElementById('fact-metric-label');
  const metric = document.getElementById('fact-metric');
  const factCoords = document.getElementById('fact-coords');
  const source = document.getElementById('fact-source');
  const focus = document.getElementById('focus');
  const isolate = document.getElementById('isolate');
  const hideRegion = document.getElementById('hide-region');
  const clear = document.getElementById('selection-clear');
  const actions = focus.closest('.actions');
  const regionMpr = document.getElementById('region-mpr');
  const networkSection = document.getElementById('region-networks');
  const networkHeading = document.getElementById('label-networks');
  const networkList = document.getElementById('network-list');
  const networkNote = document.getElementById('network-note');
  const explorerPanel = document.getElementById('navigator');

  // The × leaves with the selection, so focus goes to whichever panel is now in front.
  const onClearClick = () => {
    onClear();
    const active = document.activeElement;
    if (active && active !== document.body && active.checkVisibility?.() !== false) return;
    const panel = [explorerPanel, ...inspectorPanel.querySelectorAll('.tab-group')]
      .find(node => node?.checkVisibility?.());
    if (!panel) return;
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
  };

  // The label says Isolate or Restore; a pressed state as well would contradict it.
  isolate.removeAttribute('aria-pressed');
  focus.addEventListener('click', onFocus);
  isolate.addEventListener('click', onIsolate);
  hideRegion.addEventListener('click', onHide);
  clear.addEventListener('click', onClearClick);

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
   * What share of the selected region's surface each network holds.
   * Nothing selected leaves the section hidden: the empty inspector is a
   * hint, and a chart of the whole cortex is not a selection.
   */
  function showNetworks(state) {
    if (!networkSection) return;
    const i18n = t(state.lang, 'networks');
    const region = state.selectedRegion;
    const shares = region ? networksOf(region) : [];
    networkSection.hidden = shares.length === 0;
    if (!shares.length) return;
    networkHeading.textContent = i18n.heading;
    networkNote.textContent = i18n.note;
    networkList.replaceChildren(...shares.map(share => networkRow(share, state.lang, i18n)));
  }

  return {
    update(state) {
      const i18n = t(state.lang, 'inspector');
      const atlasDict = t(state.lang, 'atlases');
      const sideWords = t(state.lang, 'sides').capitalized;
      const chrome = inspectorEmptyChrome(state);
      title.textContent = i18n.title;
      empty.hidden = Boolean(state.selectedRegion) || chrome.hideHint;
      emptyTitle.textContent = i18n.emptyTitle;
      metadata.hidden = chrome.hideFacts;
      metadataTitle.textContent = i18n.sourceHeading;

      if (inspectorPanel) inspectorPanel.setAttribute('aria-label', i18n.panelLabel);
      if (labelSelected) labelSelected.textContent = i18n.selectedHeading;
      if (factHemiLabel) factHemiLabel.textContent = i18n.hemisphere;
      if (factGroupLabel) factGroupLabel.textContent = i18n.group;
      if (factCoordsLabel) factCoordsLabel.textContent = i18n.centroid;
      if (factSourceLabel) factSourceLabel.textContent = i18n.sourceLabel;
      focus.textContent = i18n.focus;
      hideRegion.textContent = t(state.lang, 'dissection').hideSelected;
      // Latched isolation otherwise reads as a button that did nothing.
      isolate.textContent = state.isolatedRegion ? i18n.restore : i18n.isolate;

      const region = state.selectedRegion;
      name.hidden = chrome.hideTitle;
      clear.hidden = !region;
      clear.setAttribute('aria-label', i18n.clearSelection);
      clear.title = i18n.clearSelection;
      if (actions) actions.hidden = chrome.hideActions;
      if (regionMpr) {
        regionMpr.hidden = chrome.hideActions;
        regionMpr.textContent = i18n.linkedMri;
      }
      if (labelSelected) labelSelected.hidden = chrome.hideHint;

      if (!region) {
        name.textContent = i18n.noRegionSelected;
        hint.hidden = chrome.hideHint;
        hint.textContent = state.cortexVisible ? i18n.hintCortex : i18n.hintStructures;
        facts.hidden = chrome.hideFacts;
        if (factGroup) factGroup.textContent = '';
        if (factCoords) factCoords.textContent = '';
        showNetworks(state);
        focus.disabled = true;
        isolate.disabled = true;
        hideRegion.disabled = true;
        isolate.dataset.active = 'false';
        return;
      }

      const label = catalog.get(region.id).label;
      name.hidden = false;
      name.textContent = label.name;
      hint.hidden = !region.notes;
      hint.textContent = region.notes?.[state.lang] ?? '';
      facts.hidden = false;
      hemisphere.textContent = sideWords[region.hemisphere] ?? region.hemisphere;
      if (factGroup) factGroup.textContent = label.group ?? '—';

      const measuredByVolume = region.kind === 'structure' || region.kind === 'tissue-region';
      metricLabel.textContent = measuredByVolume ? i18n.volume : i18n.surfaceArea;
      metric.textContent = measuredByVolume
        ? quantity(region.segmentation_volume_mm3, 'mm³', state.lang)
        : quantity(region.surface_area_mm2, 'mm²', state.lang);

      if (factCoords) {
        const coords = centroidOf?.(region.id);
        factCoords.textContent = coords ? formatRas([...coords], state.lang) : '—';
      }

      // The masthead names the loaded atlas; the source keeps its own, which can
      // differ (a learning unit's constituents, a cut label, a structure's segmentation).
      const ids = region.source_label_ids;
      const counted = ids && ids.length > MAX_LISTED_SOURCE_IDS;
      const sourceAtlas = atlasSwitchLabel(region.source_atlas ?? region.atlas, state.lang)
        || atlasDict[region.atlas];
      source.textContent = !ids && region.source_label_id == null ? atlasDict[region.atlas] ?? sourceAtlas
        : !ids ? `${sourceAtlas} · ${region.source_label_id}`
        : counted ? `${sourceAtlas} · ${count(ids.length, 'label', state.lang)}`
        : `${sourceAtlas} · ${ids.join(', ')}`;
      source.title = counted ? ids.join(', ') : '';
      showNetworks(state);

      focus.disabled = false;
      isolate.disabled = false;
      hideRegion.disabled = false;
      isolate.dataset.active = String(Boolean(state.isolatedRegion));
    },
    dispose() {
      focus.removeEventListener('click', onFocus);
      isolate.removeEventListener('click', onIsolate);
      hideRegion.removeEventListener('click', onHide);
      clear.removeEventListener('click', onClearClick);
    },
  };
}
