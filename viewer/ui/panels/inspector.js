import { count, decimal, formatRas, percent, quantity } from '../format.js';
import { cabNpName, networkBasis, networkCss, networkName, networksOf } from '../../catalog/networks.js';
import { functionalName, functionalRegionOf } from '../../catalog/functional-regions.js';
import { domainName, domainsOf } from '../../catalog/neuropsych-domains.js';
import { atlasSwitchLabel, t } from '../../i18n/translations.js';

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

/**
 * The source label row: the source atlas, then its label ids in the code voice. Two ids
 * share the label's line; a longer list, or a reference with no id, takes the line under it.
 */
export function sourceLabel(region, lang) {
  const ids = region.source_label_ids;
  const sourceAtlas = atlasSwitchLabel(region.source_atlas ?? region.atlas, lang);
  if (!ids && region.source_label_id == null) {
    return { atlas: t(lang, 'atlases')[region.atlas] ?? sourceAtlas, ids: null, stacked: true };
  }
  if (!ids) return { atlas: sourceAtlas, ids: String(region.source_label_id), stacked: false };
  if (ids.length > MAX_LISTED_SOURCE_IDS) {
    return { atlas: `${sourceAtlas} · ${count(ids.length, 'label', lang)}`, ids: null, stacked: false, all: ids.join(', ') };
  }
  return { atlas: sourceAtlas, ids: ids.join(', '), stacked: ids.length > 2 };
}

/** The selected region: what it is, and what is measured about it. */
export function createInspector({
  catalog, networks, cabNp, functionalRegions, domains, onFocus, onIsolate, onHide, onClear, centroidOf,
}) {
  const inspectorPanel = document.getElementById('inspector');
  const title = document.getElementById('inspector-title');
  const empty = document.getElementById('selection-empty');
  const factHemiLabel = document.getElementById('fact-hemisphere-label');
  const factGroupLabel = document.getElementById('fact-group-label');
  const factCoordsLabel = document.getElementById('fact-coords-label');
  const factSourceLabel = document.getElementById('fact-source-label');
  const name = document.getElementById('selected-name');
  const context = document.getElementById('selected-context');
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
  const yeoLabel = document.getElementById('label-yeo');
  const networkList = document.getElementById('network-list');
  const networkNote = document.getElementById('network-note');
  const cabNpLabel = document.getElementById('label-cab-np');
  const cabNpList = document.getElementById('cab-np-list');
  const cabNpNote = document.getElementById('cab-np-note');
  const networkCaveat = document.getElementById('network-caveat');
  const functionalSection = document.getElementById('region-functional');
  const functionalHeading = document.getElementById('label-functional');
  const functionalList = document.getElementById('functional-list');
  const functionalNote = document.getElementById('functional-note');
  const domainsSection = document.getElementById('region-domains');
  const domainsHeading = document.getElementById('label-domains');
  const domainsList = document.getElementById('domains-list');
  const domainsNote = document.getElementById('domains-note');
  const explorerPanel = document.getElementById('navigator');
  let shownSourceRegion = null;
  let shownSourceLang = null;

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

  function networkRow(share, lang, { colors, name }) {
    const row = document.createElement('li');
    row.className = 'network-row';
    const swatch = document.createElement('span');
    swatch.className = 'network-swatch';
    const color = colors?.[share.network];
    if (color) swatch.style.background = networkCss(color);
    const label = document.createElement('span');
    label.className = 'network-row-name';
    label.textContent = name(share.network, lang);
    const bar = document.createElement('span');
    bar.className = 'network-bar';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.style.width = `${share.fraction * 100}%`;
    bar.append(fill);
    const value = document.createElement('span');
    value.className = 'network-share measure';
    value.textContent = percent(share.fraction, lang);
    row.append(swatch, label, bar, value);
    return row;
  }

  /**
   * Network shares counted from the region's assigned vertices or cortical voxels.
   * Nothing selected leaves the section hidden: the empty inspector is a
   * hint, and a chart of the whole cortex is not a selection.
   */
  function showNetworks(state) {
    if (!networkSection) return;
    const i18n = t(state.lang, 'networks');
    const region = state.selectedRegion;
    const shares = region ? networksOf(region) : [];
    // CAB-NP assigns a whole HCP-MMP area, so its one network is the area's entire share.
    const assigned = region ? cabNp?.regions[region.id] : null;
    networkSection.hidden = shares.length === 0 && !assigned;
    if (networkSection.hidden) return;
    networkHeading.textContent = i18n.heading;
    for (const node of [yeoLabel, networkList, networkNote]) node.hidden = !shares.length;
    yeoLabel.textContent = i18n.yeo;
    networkNote.textContent = shares.length ? i18n.notes[networkBasis(region)] : '';
    networkList.replaceChildren(...shares.map(share => networkRow(
      share, state.lang, { colors: networks?.colors, name: networkName })));
    for (const node of [cabNpLabel, cabNpList, cabNpNote]) node.hidden = !assigned;
    cabNpLabel.textContent = i18n.cabNp;
    cabNpNote.textContent = i18n.cabNpNote;
    cabNpList.replaceChildren(...(assigned ? [networkRow(
      { network: assigned, fraction: 1 }, state.lang, { colors: cabNp.colors, name: cabNpName })] : []));
    networkCaveat.textContent = i18n.caveat;
  }

  function divisionRow(record, level, lang, copy) {
    const row = document.createElement('li');
    row.className = 'network-row functional-row';
    const swatch = document.createElement('span');
    swatch.className = 'network-swatch';
    swatch.style.background = networkCss(record.color);
    const label = document.createElement('span');
    label.className = 'network-row-name';
    const divisionName = document.createElement('span');
    divisionName.textContent = functionalName(record, lang);
    const meta = document.createElement('span');
    meta.className = 'functional-row-meta';
    meta.textContent = [
      level === 'sections' ? copy.section(record.number) : copy.named,
      functionalRegions.sources[record.source].short,
      copy.areas(record.areas.join(' ')),
    ].join(' · ');
    label.append(divisionName, meta);
    row.append(swatch, label);
    return row;
  }

  /** The HCP-MMP area's section, and its named region where a source names one. */
  function showFunctional(state) {
    const region = state.selectedRegion;
    const section = region ? functionalRegionOf(functionalRegions, 'sections', region.id) : null;
    functionalSection.hidden = !section;
    if (!section) return;
    const copy = t(state.lang, 'functional');
    const named = functionalRegionOf(functionalRegions, 'named', region.id);
    functionalHeading.textContent = copy.heading;
    functionalList.replaceChildren(...[
      named && divisionRow(named, 'named', state.lang, copy),
      divisionRow(section, 'sections', state.lang, copy),
    ].filter(Boolean));
    // The build checked that every HCP-MMP name reads `L_<area>_ROI` or `R_<area>_ROI`.
    const contested = functionalRegions.contested[region.source_name.slice(2, -4)];
    functionalNote.textContent = [
      !named && copy.unnamed,
      contested && copy.contested(contested.section, contested.text_section),
      copy.note,
    ].filter(Boolean).join(' ');
  }

  /** The domains an HCP-MMP area reaches the threshold for, strongest first, each with its z. */
  function showDomains(state) {
    const region = state.selectedRegion;
    domainsSection.hidden = !domains || region?.atlas !== domains.atlas || region.kind !== 'cortex';
    if (domainsSection.hidden) return;
    const copy = t(state.lang, 'domains');
    const found = domainsOf(domains, region.id);
    domainsHeading.textContent = copy.heading;
    domainsList.replaceChildren(...found.map(record => {
      const row = document.createElement('li');
      row.className = 'network-row functional-row';
      const swatch = document.createElement('span');
      swatch.className = 'network-swatch';
      swatch.style.background = networkCss(record.color);
      const label = document.createElement('span');
      label.className = 'network-row-name';
      const recordName = document.createElement('span');
      recordName.textContent = domainName(record, state.lang);
      const meta = document.createElement('span');
      meta.className = 'functional-row-meta';
      meta.textContent = copy.score(record.term, decimal(record.z, 1, state.lang));
      label.append(recordName, meta);
      row.append(swatch, label);
      return row;
    }));
    domainsNote.textContent = [
      !found.length && copy.none(decimal(domains.threshold_z, 0, state.lang)),
      copy.note(domains.sources[domains.scores_source].short),
    ].filter(Boolean).join(' ');
  }

  function showSource(region, lang) {
    // Preserve an open disclosure while the camera, isolation or other view settings change.
    if (region === shownSourceRegion && lang === shownSourceLang) return;
    const label = sourceLabel(region, lang);
    if (label.all) {
      const disclosure = document.createElement('details');
      disclosure.className = 'inline-disclosure source-labels';
      const summary = document.createElement('summary');
      summary.textContent = label.atlas;
      const ids = document.createElement('p');
      ids.className = 'code';
      ids.textContent = label.all;
      disclosure.append(summary, ids);
      source.replaceChildren(disclosure);
    } else {
      const ids = label.ids && document.createElement('span');
      if (ids) {
        ids.className = 'code';
        ids.textContent = label.ids;
      }
      source.replaceChildren(...(ids ? [`${label.atlas} · `, ids] : [label.atlas]));
    }
    for (const node of [factSourceLabel, source]) node.classList.toggle('stacked', label.stacked || Boolean(label.all));
    shownSourceRegion = region;
    shownSourceLang = lang;
  }

  return {
    update(state) {
      const i18n = t(state.lang, 'inspector');
      const sideWords = t(state.lang, 'sides').capitalized;
      const chrome = inspectorEmptyChrome(state);
      title.textContent = i18n.title;
      empty.hidden = Boolean(state.selectedRegion) || chrome.hideHint;
      empty.textContent = i18n.noRegionSelected;

      inspectorPanel.setAttribute('aria-label', i18n.panelLabel);
      factHemiLabel.textContent = i18n.hemisphere;
      factGroupLabel.textContent = i18n.group;
      factCoordsLabel.textContent = i18n.centroid;
      factSourceLabel.textContent = i18n.sourceLabel;
      focus.textContent = i18n.focus;
      hideRegion.textContent = t(state.lang, 'dissection').hideSelected;
      // Latched isolation otherwise reads as a button that did nothing.
      isolate.textContent = state.isolatedRegion ? i18n.restore : i18n.isolate;

      const region = state.selectedRegion;
      name.hidden = chrome.hideTitle;
      clear.hidden = !region;
      clear.setAttribute('aria-label', i18n.clearSelection);
      clear.dataset.tooltip = i18n.clearSelection;
      actions.hidden = chrome.hideActions;
      regionMpr.hidden = chrome.hideActions;
      regionMpr.textContent = i18n.linkedMri;
      facts.hidden = chrome.hideFacts;
      context.hidden = !region;

      if (!region) {
        hint.hidden = chrome.hideHint;
        hint.textContent = state.cortexVisible ? i18n.hintCortex : i18n.hintStructures;
        showNetworks(state);
        showFunctional(state);
        showDomains(state);
        focus.disabled = true;
        isolate.disabled = true;
        hideRegion.disabled = true;
        isolate.dataset.active = 'false';
        return;
      }

      const label = catalog.label(region.id, state);
      name.textContent = label.name;
      hint.hidden = !region.notes;
      hint.textContent = region.notes?.[state.lang] ?? '';
      hemisphere.textContent = sideWords[region.hemisphere] ?? region.hemisphere;
      factGroup.textContent = label.group ?? '—';

      const measuredByVolume = region.kind === 'structure' || region.kind === 'tissue-region';
      metricLabel.textContent = measuredByVolume ? i18n.volume : i18n.surfaceArea;
      metric.textContent = measuredByVolume
        ? quantity(region.segmentation_volume_mm3, 'mm³', state.lang)
        : quantity(region.surface_area_mm2, 'mm²', state.lang);
      const coords = centroidOf?.(region.id);
      factCoords.textContent = coords ? formatRas([...coords], state.lang) : '—';
      // The masthead names the loaded atlas; the source keeps its own, which can
      // differ (a learning unit's constituents, a cut label, a structure's segmentation).
      showSource(region, state.lang);
      showNetworks(state);
      showFunctional(state);
      showDomains(state);

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
