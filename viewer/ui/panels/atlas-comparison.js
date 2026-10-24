import { readComparison } from '../../comparison/assets.js';
import { createComparisonCatalog } from '../../comparison/catalog.js';
import { labelOf } from '../../catalog/labels.js';
import { atlasSwitchLabel, t } from '../../i18n/translations.js';
import { failureNotice } from '../../i18n/errors.js';
import { withUnit } from '../format.js';
import { overlapArea, overlapShare } from './comparison-format.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** A table figure; the column head carries its unit, which is spoken where no label replaces the cell. */
function cell(value, unit) {
  const node = element('span', value, 'measure');
  node.append(element('span', ` ${unit}`, 'visually-hidden'));
  return node;
}

function downloadCsv(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A selected region's full-area correspondence; detail stays in disclosures. */
export function createAtlasComparison({ manifest, manifestUrl, highlight, clearHighlight }) {
  const panel = document.getElementById('region-comparison');
  const heading = document.getElementById('comparison-heading');
  const status = document.getElementById('comparison-status');
  const retry = document.getElementById('comparison-retry');
  const content = document.getElementById('comparison-content');
  const denominator = document.getElementById('comparison-denominator');
  const columns = document.getElementById('comparison-columns');
  const list = document.getElementById('comparison-list');
  const more = document.getElementById('comparison-more');
  const moreHeading = document.getElementById('comparison-more-heading');
  const moreList = document.getElementById('comparison-more-list');
  const unassigned = document.getElementById('comparison-unassigned');
  const viewNote = document.getElementById('comparison-view-note');
  const exportButton = document.getElementById('comparison-export');
  const methodHeading = document.getElementById('comparison-method-heading');
  const method = document.getElementById('comparison-method');
  const sources = document.getElementById('comparison-sources');
  let state = null;
  let sourceId = null;
  let catalog = null;
  let comparisonData = null;
  let loading = null;
  let phase = 'idle';
  // What failed, worded at paint time so a language change rewords it.
  let failed = null;
  let active = null;
  let busy = null;
  let request = 0;
  let painted = null;
  let disposed = false;

  function clear() {
    request++;
    active = null;
    busy = null;
    clearHighlight();
  }

  async function activate(row) {
    if (active === row.meshId) { clear(); paint(); return; }
    clear();
    const current = request;
    busy = row.meshId;
    failed = null;
    paint();
    try {
      const applied = await highlight(row.meshId);
      if (!disposed && current === request && applied) active = row.meshId;
    } catch (error) {
      console.error(error);
      if (!disposed && current === request) failed = { error, operation: 'overlap' };
    } finally {
      if (!disposed && current === request) { busy = null; paint(); }
    }
  }

  function rowNode(row, copy) {
    const name = labelOf(manifest.regions.find(region => region.id === row.regionId), state.lang).name;
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'comparison-row';
    button.dataset.overlap = row.meshId;
    button.setAttribute('aria-pressed', String(active === row.meshId));
    button.setAttribute('aria-label',
      copy.highlight(name, withUnit(overlapArea(row.areaMm2, state.lang), 'mm²', state.lang),
        withUnit(overlapShare(row.fraction, state.lang), '%', state.lang)));
    button.disabled = !state.outlineAvailable;
    button.append(element('span', name, 'comparison-name'),
      element('span', overlapArea(row.areaMm2, state.lang), 'measure'),
      element('span', overlapShare(row.fraction, state.lang), 'measure'));
    button.addEventListener('click', () => activate(row));
    item.append(button);
    return item;
  }

  function paint() {
    if (disposed || panel.hidden) return;
    const copy = t(state.lang, 'comparison');
    const key = [sourceId, state.lang, phase, failed?.operation, active, busy, state.outlineAvailable].join('|');
    if (key === painted) return;
    painted = key;
    const focused = panel.contains(document.activeElement) ? document.activeElement.dataset.overlap : null;
    const expanded = more.open;
    // The comparison pairs the two cortical atlases, so the other one is the loaded manifest's other atlas.
    const target = manifest.atlases.find(atlas => atlas.id !== state.selectedRegion.atlas).id;
    heading.textContent = copy.heading(atlasSwitchLabel(target, state.lang));
    const said = failed ? failureNotice(failed.error, state.lang, failed.operation).text : '';
    status.textContent = said || (phase === 'loading' ? copy.loading : busy ? copy.highlightLoading : '');
    status.hidden = !status.textContent;
    panel.setAttribute('aria-busy', String(phase === 'loading' || Boolean(busy)));
    retry.hidden = phase !== 'error';
    retry.textContent = copy.retry;
    content.hidden = phase !== 'ready';
    if (phase !== 'ready') return;
    const comparison = catalog.comparisonFor(sourceId);
    // The datasheet above states the region's area; the note says what the shares divide.
    denominator.textContent = copy.denominator;
    copy.columns.forEach((label, index) => { columns.children[index].textContent = label; });
    list.replaceChildren(...comparison.rows.slice(0, 4).map(row => rowNode(row, copy)));
    more.hidden = comparison.rows.length <= 4;
    moreHeading.textContent = copy.more(comparison.rows.length - 4);
    moreList.replaceChildren(...comparison.rows.slice(4).map(row => rowNode(row, copy)));
    more.open = expanded;
    unassigned.replaceChildren(element('span', copy.unassigned),
      cell(overlapArea(comparison.unassignedAreaMm2, state.lang), 'mm²'),
      cell(overlapShare(comparison.unassignedFraction, state.lang), '%'));
    viewNote.hidden = state.outlineAvailable;
    viewNote.textContent = copy.viewNote;
    exportButton.textContent = copy.export;
    methodHeading.textContent = copy.methodHeading;
    method.textContent = copy.method;
    sources.replaceChildren(...manifest.atlases.filter(atlas => comparisonData.atlases.includes(atlas.id))
      .map(atlas => {
        const link = element('a', atlasSwitchLabel(atlas.id, state.lang));
        link.href = atlas.citation;
        link.target = '_blank';
        link.rel = 'noopener';
        return link;
      }));
    if (focused) {
      const replacement = [...panel.querySelectorAll('[data-overlap]')]
        .find(button => button.dataset.overlap === focused);
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    }
  }

  function load() {
    phase = 'loading';
    failed = null;
    paint();
    loading = readComparison(new URL(manifest.atlas_comparison.file, manifestUrl),
      manifest.atlas_comparison.sha256)
      .then(data => {
        if (disposed) return;
        catalog = createComparisonCatalog(data, manifest);
        comparisonData = data;
        phase = 'ready';
      }).catch(error => {
        console.error(error);
        if (disposed) return;
        phase = 'error';
        failed = { error, operation: 'comparison' };
      }).finally(() => { if (!disposed) paint(); });
  }

  const onRetry = () => load();
  const onExport = () => downloadCsv(catalog.exportCsv(sourceId, state.lang),
    `${manifest.anatomy.id}-${sourceId.replaceAll(':', '-')}-atlas-comparison.csv`);
  const onToggle = () => {
    if (!panel.open) { clear(); paint(); }
  };
  retry.addEventListener('click', onRetry);
  exportButton.addEventListener('click', onExport);
  panel.addEventListener('toggle', onToggle);

  return {
    get data() { return comparisonData; },
    update(next) {
      state = next;
      const region = state.selectedRegion;
      panel.hidden = !manifest.atlas_comparison || region?.kind !== 'cortex';
      const nextId = panel.hidden ? null : region.id;
      if (sourceId !== nextId) {
        sourceId = nextId;
        painted = null;
        if (phase !== 'error') failed = null;
        clear();
      }
      if (!state.outlineAvailable && (active || busy)) clear();
      if (panel.hidden) return;
      if (!loading) load();
      paint();
    },
    dispose() {
      disposed = true;
      clear();
      retry.removeEventListener('click', onRetry);
      exportButton.removeEventListener('click', onExport);
      panel.removeEventListener('toggle', onToggle);
      list.replaceChildren();
      moreList.replaceChildren();
    },
  };
}
