import { t, atlasSwitchLabel } from '../../i18n/translations.js';
import { CLINICAL_TEXT } from '../../clinical/translations.js';
import { visibilityOf } from '../../catalog/visibility.js';
import { failureNotice } from '../../i18n/errors.js';
import { createButtonLabel } from '../chrome/button-label.js';
import { networkCss } from '../../catalog/networks.js';
import { createAnnouncer } from '../announce.js';

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** The one chevron, trailing a row that opens a detail. */
export function drillChevron() {
  const chevron = element('span', null, 'chevron drill-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  return chevron;
}

/** A region opened from a profile is detailed below the profile: brought into view, its name takes focus. */
export function showOpenedRegion() {
  const regionName = document.getElementById('selected-name');
  if (!regionName || regionName.hidden) return;
  regionName.tabIndex = -1;
  regionName.scrollIntoView({ block: 'start' });
  regionName.focus({ preventScroll: true });
}

/** A quiet link to the other evidence tab's matches for the same words. */
export function bridgeButton(text, dataset) {
  const button = element('button', null, 'search-bridge');
  button.type = 'button';
  Object.assign(button.dataset, dataset);
  button.append(element('span', text), drillChevron());
  return button;
}

function deficitButton(deficit, lang) {
  const button = element('button', null, 'clinical-deficit');
  button.type = 'button';
  button.dataset.deficit = deficit.id;
  const text = element('span', null, 'clinical-deficit-text');
  text.append(element('span', deficit.name[lang], 'clinical-deficit-name'),
    element('span', deficit.domain[lang], 'clinical-deficit-domain'));
  button.append(text, drillChevron());
  return button;
}

function deficitGroup({ group, deficits }, lang) {
  const section = element('div', null, 'deficit-group');
  const heading = element('h3', group.name[lang], 'section-label deficit-group-heading');
  heading.id = `deficit-group-${group.id}`;
  section.setAttribute('role', 'group');
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading, ...deficits.map(deficit => deficitButton(deficit, lang)));
  return section;
}

/** An opened profile starts at its top, not wherever the list or the last profile was scrolled. */
export function scrollToTop(node) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent.scrollTop = 0;
  }
}

function publication(reference, role, lang) {
  const text = CLINICAL_TEXT[lang];
  const article = element('article', null, 'clinical-publication');
  article.append(element('p', `${text[role]} · ${text.methods[reference.method]}`, 'clinical-note'));
  const link = element('a', reference.title);
  link.href = `https://doi.org/${reference.doi}`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  const pubmed = element('a', `PubMed · ${reference.pmid}`);
  pubmed.href = `https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`;
  pubmed.target = '_blank';
  pubmed.rel = 'noreferrer';
  article.append(link,
    element('p', `${reference.authors} (${reference.year}). ${reference.journal}.`, 'clinical-note'),
    element('p', `${text.population}: ${reference.population[lang]}`),
    element('p', text[reference.scope], 'clinical-note'), pubmed);
  for (const correction of publishedCorrections(reference, lang)) {
    const doi = element('a', correction.doi);
    doi.href = correction.href;
    doi.target = '_blank';
    doi.rel = 'noreferrer';
    article.append(element('p', text.correction, 'clinical-note clinical-correction'),
      element('p', correction.summary), doi);
  }
  return article;
}

/** A reference's published corrections, in the reader's language, each with its DOI link. */
export function publishedCorrections(reference, lang) {
  return (reference.corrections ?? []).map(({ doi, summary }) => ({
    doi: `doi:${doi}`, href: `https://doi.org/${doi}`, summary: summary[lang],
  }));
}

/**
 * One association: its title, its mapped regions always in reach, and its evidence behind a disclosure.
 * `sideOnRow` is false when the profile states the one side all its associations share.
 */
function associationSection(association, clinical, anatomy, lang, { open, sideOnRow, color }) {
  const text = CLINICAL_TEXT[lang];
  const sides = t(lang, 'sides').capitalized;
  const section = element('article', null, 'clinical-association');
  section.dataset.association = association.id;
  const title = element('h4', null, 'clinical-association-title');
  // The colour this finding's regions take on the brain, as the stage key shows it.
  const swatch = element('span', null, 'network-swatch clinical-finding-swatch');
  swatch.setAttribute('aria-hidden', 'true');
  swatch.style.background = networkCss(color);
  title.append(swatch, element('span', association.title[lang]));
  // The short side reads on screen; a screen reader hears the full one even when the profile states it.
  if (sideOnRow) {
    const shown = element('span', text.lateralityShort[association.laterality], 'clinical-association-side');
    shown.setAttribute('aria-hidden', 'true');
    title.append(shown);
  }
  title.append(element('span', ` · ${text.laterality[association.laterality]}`, 'visually-hidden'));

  const regions = element('div', null, 'clinical-association-regions');
  const entries = association.mappings.map(mapping => ({ id: mapping.region, entry: anatomy.get(mapping.region) }));
  const stated = sideStated(association.laterality, entries.map(({ entry }) => entry.region.hemisphere));
  for (const { id, entry } of entries) {
    const full = `${entry.label.name} · ${sides[entry.region.hemisphere]}`;
    const button = element('button', stated ? entry.label.name : full, 'clinical-association-region');
    button.type = 'button';
    button.dataset.clinicalRegion = id;
    button.setAttribute('aria-label', `${text.openRegion}: ${full}`);
    regions.append(button);
  }
  if (!association.mappings.length) regions.append(element('p', text.mappingEmpty, 'clinical-note'));

  const evidence = element('details', null, 'inline-disclosure clinical-evidence');
  evidence.open = open;
  const body = element('div', null, 'clinical-evidence-body');
  body.append(element('p', association.network[lang], 'clinical-note'),
    element('h5', text.studyFinding), element('p', association.finding[lang]),
    element('h5', text.limits), element('p', association.limitation[lang]),
    element('h5', text.mapping), element('p', association.mapping_note[lang], 'clinical-note'),
    element('h5', `${text.evidence} · ${association.evidence.length}`));
  for (const item of association.evidence) {
    body.append(publication(clinical.reference(item.reference), item.role, lang));
  }
  evidence.append(element('summary', text.findings), body);
  section.append(title, regions, evidence);
  return section;
}

/** The one side every association in a profile shares, said once under its title; null when they differ. */
export function sharedSide(lateralities) {
  return lateralities.length > 0 && lateralities.every(side => side === lateralities[0]) ? lateralities[0] : null;
}

/** Links under an association name their side only when the association's own side does not already. */
export function sideStated(laterality, hemispheres) {
  return hemispheres.length > 0 && hemispheres.every(hemisphere => hemisphere === laterality);
}

/**
 * What revealing a deficit's regions changed in the reader's own settings, as one sentence for the
 * notice; null when nothing changed, so nothing is claimed that did not happen.
 */
export function revealNotice(lang, before, after) {
  const said = CLINICAL_TEXT[lang].changed;
  const clauses = [];
  if (before.cut && !after.cut) clauses.push(said.cut);
  if (before.isolated && !after.isolated) clauses.push(said.isolation);
  if (before.atlas !== after.atlas) clauses.push(said.atlas(atlasSwitchLabel(after.atlas, lang)));
  if (before.cutAtlas !== after.cutAtlas) clauses.push(said.cutAtlas(atlasSwitchLabel(after.cutAtlas, lang)));
  if (before.colour !== after.colour) clauses.push(said.colour(t(lang, 'display').surfaceColors[after.colour]));
  if (before.detail !== after.detail) clauses.push(said.detail(atlasSwitchLabel(after.detail, lang)));
  if (before.hemisphere !== after.hemisphere) clauses.push(said.hemisphere);
  if (before.cortex !== after.cortex) clauses.push(after.cortex ? said.cortexShown : said.cortexHidden);
  if (!clauses.length) return null;
  const sentence = new Intl.ListFormat(lang, { type: 'conjunction' }).format(clauses);
  return `${sentence.charAt(0).toLocaleUpperCase(lang)}${sentence.slice(1)}.`;
}

/**
 * The profile's meta line: work in progress, a failure, or what the stage shows.
 * A failure is worded for the reader: its own `failure` text, else what `operation` could not do.
 */
export function stageMessage(text, { opening, busy, error, failure, operation, lang, status }) {
  if (opening) return text[busy];
  if (error) return failure ? text[failure] : failureNotice(error, lang, operation).text;
  return status;
}

/** A region inspector does not title a Neuropsychology section that has nothing to report. */
export function relatedRegionVisible(selectedRegion, deficitCount) {
  return Boolean(selectedRegion) && deficitCount > 0;
}

/** An activation map a deficit's lesion evidence checks: its colour on the brain, its name, and the way to it. */
function checkedMapButton({ id, name, color }) {
  const button = element('button', null, 'clinical-deficit function-row');
  button.type = 'button';
  button.dataset.checkedFunction = id;
  const swatch = element('span', null, 'network-swatch function-swatch');
  swatch.setAttribute('aria-hidden', 'true');
  swatch.style.background = networkCss(color);
  const text = element('span', null, 'clinical-deficit-text');
  text.append(element('span', name, 'clinical-deficit-name'));
  button.append(swatch, text, drillChevron());
  const item = element('li');
  item.append(button);
  return item;
}

/**
 * Deficit navigation and evidence share the existing session render cycle.
 * `involved` gives the regions a selection shares anatomy with (related.js), so
 * the region inspector lists the deficits mapped on any of them. `onFailure`
 * hears each failure the meta line reports. `checkedMaps` names the Functions tab's
 * maps a deficit's associations check, which `onFunction` opens; `functionsMatching`
 * counts that tab's matches for the same words, and `onSearchFunctions` carries the query there.
 */
export function createClinicalExplorer({
  clinical, anatomy, involved, checkedMaps, functionsMatching, onQuery, onDeficit, onRegion, onFunction,
  onSearchFunctions, onRestore, onFailure,
}) {
  const announce = createAnnouncer();
  const anatomySearch = document.getElementById('anatomy-search');
  const deficitSearchHead = document.getElementById('deficit-search-head');
  const anatomyBrowser = document.getElementById('anatomy-browser');
  const deficitBrowser = document.getElementById('deficit-browser');
  const search = document.getElementById('deficit-search');
  const deficitSearchClear = document.getElementById('deficit-search-clear');
  const searchLabel = document.getElementById('deficit-search-label');
  const coverage = document.getElementById('clinical-coverage');
  const list = document.getElementById('deficit-list');
  const profile = document.getElementById('clinical-profile');
  const related = document.getElementById('clinical-region');
  // The way back is the location bar's one trailing action.
  const trailing = document.getElementById('detail-trailing');
  const restore = element('button', null, 'clinical-restore icon-button');
  restore.type = 'button';
  restore.id = 'clinical-restore';
  const restoreLabel = createButtonLabel(restore, 'restore');
  restoreLabel.classList.add('visually-hidden');
  trailing.append(restore);
  let listKey = null;
  let profileKey = null;
  let relatedKey = null;
  let opening = false;
  let latest = 0;
  let language = 'en';
  let actionError = null;
  let busy = 'loading';
  let failure = null;
  let operation = 'deficit';
  // Whether the scene from before the first deficit is held, and whether it was just put back.
  let restorable = false;
  let current = null;
  // The side all the profile's findings share, said first on its meta line.
  let profileSide = null;
  // Open evidence survives a language change, not a change of deficit.
  let expanded = new Set();

  /** The profile renders at once; the brain is prepared and framed behind it. */
  async function selectDeficit(id) {
    const preparing = onDeficit(id);
    const name = profile.querySelector('.clinical-profile-name');
    scrollToTop(profile);
    if (name) {
      name.tabIndex = -1;
      name.focus({ preventScroll: true });
    }
    await run(() => preparing);
  }

  // Opening another deficit overtakes the last one's preparation, whose download may land later; only the latest speaks.
  async function run(action, { busyText = 'loading', failureText = null, failed = 'deficit' } = {}) {
    const mine = ++latest;
    opening = true;
    busy = busyText;
    failure = failureText;
    operation = failed;
    actionError = null;
    updateAction();
    try {
      // An action that reports false was overtaken: it did not do what it says.
      return (await action()) !== false;
    } catch (error) {
      console.error(error);
      if (mine === latest) {
        actionError = error;
        onFailure(error);
      }
      return false;
    } finally {
      if (mine === latest) {
        opening = false;
        updateAction();
      }
    }
  }

  /** The profile closes with the excursion it opened, so focus returns to its row in the list. */
  async function restorePrevious() {
    const id = current.selectedDeficit;
    if (!(await run(onRestore, { busyText: 'restoring', failureText: 'restoreFailed' }))) return;
    (list.querySelector(`[data-deficit="${CSS.escape(id)}"]`) ?? search).focus();
  }

  function renderProfile(state) {
    profile.replaceChildren();
    profileSide = null;
    if (!state.selectedDeficit) return;
    const text = CLINICAL_TEXT[state.lang];
    const deficit = clinical.get(state.selectedDeficit);
    const found = clinical.forDeficit(deficit.id);
    const colors = new Map(clinical.paint(deficit.id).findings.map(({ association, color }) => [association.id, color]));
    profileSide = sharedSide(found.map(association => association.laterality));
    const name = element('h2', deficit.name[state.lang], 'clinical-profile-name');
    name.id = 'clinical-title';
    const meta = element('p', null, 'clinical-meta');
    meta.id = 'clinical-meta';
    meta.setAttribute('role', 'status');
    const associations = element('section', null, 'detail-section clinical-associations');
    const heading = element('h3', text.associations, 'detail-section-heading');
    heading.id = 'clinical-associations-heading';
    associations.setAttribute('aria-labelledby', heading.id);
    associations.append(heading, ...found.map(association => associationSection(association, clinical, anatomy,
      state.lang, { open: expanded.has(association.id), sideOnRow: !profileSide, color: colors.get(association.id) })));
    const maps = checkedMaps(deficit.id, state.lang);
    const checked = element('section', null, 'detail-section clinical-checked-maps');
    if (maps.length) {
      const mapsHeading = element('h3', text.checkedMaps, 'detail-section-heading');
      mapsHeading.id = 'clinical-checked-heading';
      checked.setAttribute('aria-labelledby', mapsHeading.id);
      const rows = element('ul', null, 'clinical-related');
      rows.append(...maps.map(checkedMapButton));
      checked.append(mapsHeading, rows);
    }
    const body = element('div', null, 'panel-body clinical-content');
    body.append(name, meta, element('p', text.evidenceKind(found.length), 'clinical-kind'),
      element('p', deficit.summary[state.lang], 'clinical-summary'),
      element('p', text.referenceOnly, 'clinical-note clinical-caveat'), associations,
      ...(maps.length ? [checked] : []),
      element('p', `${text.sources} · ${text.revised}: ${clinical.revised}`, 'clinical-note clinical-sources'));
    profile.append(body);
    updateAction();
  }

  /** Counted from what is drawn now, so the meta line stays true as the reader hides, cuts or isolates. */
  function stageView(state) {
    // The regions painted: every mapped one, or one finding's alone. A masthead colour chosen over
    // the paint leaves them drawn but not coloured.
    const ids = state.paint ? [...state.paint.colors.keys()] : clinical.mappedRegions(state.selectedDeficit);
    const shown = ids.filter(id => visibilityOf(anatomy.get(id).region, state).visible).length;
    return { shown, total: ids.length, coloured: Boolean(state.paint) };
  }

  function renderRelated(state) {
    related.replaceChildren();
    const regions = state.selectedRegion ? involved(state.selectedRegion.id) : new Set();
    const deficits = new Set([...regions].flatMap(id => clinical.forRegion(id).map(a => a.deficit)));
    related.hidden = !relatedRegionVisible(state.selectedRegion, deficits.size);
    if (related.hidden) return;
    const heading = element('h3', CLINICAL_TEXT[state.lang].related, 'detail-section-heading');
    heading.id = 'clinical-region-heading';
    related.setAttribute('aria-labelledby', heading.id);
    const rows = element('ul', null, 'clinical-related');
    for (const id of deficits) {
      const item = element('li');
      item.append(deficitButton(clinical.get(id), state.lang));
      rows.append(item);
    }
    related.append(heading, rows);
  }

  function updateAction() {
    for (const button of profile.querySelectorAll('[data-clinical-region]')) button.disabled = opening;
    const open = current?.explorer === 'deficits' && Boolean(current.selectedDeficit);
    restore.hidden = !open || opening || !restorable;
    trailing.hidden = [...trailing.children].every(child => child.hidden);
    const metaLine = document.getElementById('clinical-meta');
    if (!metaLine || !open) return;
    const text = CLINICAL_TEXT[language];
    const view = stageView(current);
    const shown = text.regionsMarked(view.shown, view.total, view.coloured);
    const said = stageMessage(text, { opening, busy, error: actionError, failure, operation, lang: language,
      status: profileSide ? `${text.laterality[profileSide]} · ${shown}` : shown });
    // Rewriting the same words would have the live region say them again on every render.
    if (metaLine.textContent !== said) metaLine.textContent = said;
    metaLine.dataset.error = String(Boolean(actionError));
  }

  const onInput = event => onQuery(event.target.value);
  const onSearchKey = event => {
    if (event.isComposing) return;
    if (event.key === 'Escape' && search.value) {
      event.preventDefault();
      // The field keeps focus, so the render that follows leaves its text alone.
      search.value = '';
      onQuery('');
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      const first = list.querySelector('.clinical-deficit, .search-bridge');
      if (first) { event.preventDefault(); first.focus(); }
    }
  };
  const onDeficitClick = event => {
    const suggestion = event.target.closest('[data-suggest]');
    if (suggestion) {
      search.value = suggestion.dataset.suggest;
      onQuery(suggestion.dataset.suggest);
      search.focus();
      return;
    }
    const bridge = event.target.closest('[data-search-functions]');
    if (bridge) return onSearchFunctions(bridge.dataset.searchFunctions);
    const button = event.target.closest('[data-deficit]');
    if (button) selectDeficit(button.dataset.deficit);
  };
  // Every row a search shows, suggestions and links to the other tab included; up from the first is the field.
  const onListKey = event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [...list.querySelectorAll('.clinical-deficit, .search-bridge')];
    const index = buttons.indexOf(document.activeElement);
    event.preventDefault();
    if (event.key === 'ArrowUp' && index === 0) search.focus();
    else buttons[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  };
  const onProfileClick = event => {
    const map = event.target.closest('[data-checked-function]');
    if (map) return onFunction(map.dataset.checkedFunction);
    const button = event.target.closest('[data-clinical-region]');
    if (button && !opening) {
      run(() => onRegion(button.dataset.clinicalRegion), { failed: 'region' }).then(done => done && showOpenedRegion());
    }
  };
  // `toggle` does not bubble, so the profile hears its disclosures while capturing.
  const onEvidenceToggle = event => {
    const id = event.target.closest?.('[data-association]')?.dataset.association;
    if (!id) return;
    if (event.target.open) expanded.add(id); else expanded.delete(id);
  };
  const onRestoreClick = () => { if (!opening) restorePrevious(); };

  search.addEventListener('input', onInput);
  search.addEventListener('keydown', onSearchKey);
  const onClearDeficitSearch = () => {
    search.value = '';
    if (deficitSearchClear) deficitSearchClear.hidden = true;
    onQuery('');
    search.focus();
  };
  deficitSearchClear?.addEventListener('click', onClearDeficitSearch);
  list.addEventListener('click', onDeficitClick);
  list.addEventListener('keydown', onListKey);
  related.addEventListener('click', onDeficitClick);
  profile.addEventListener('click', onProfileClick);
  profile.addEventListener('toggle', onEvidenceToggle, true);
  restore.addEventListener('click', onRestoreClick);

  return {
    /** `restorable`: whether the scene from before this excursion's first deficit can be put back. */
    update(state, { restorable: canRestore = false } = {}) {
      current = state;
      language = state.lang;
      restorable = canRestore;
      const text = CLINICAL_TEXT[language];
      const exploring = state.explorer === 'deficits';
      anatomySearch.hidden = state.explorer !== 'anatomy';
      if (deficitSearchHead) deficitSearchHead.hidden = !exploring;
      anatomyBrowser.hidden = state.explorer !== 'anatomy';
      deficitBrowser.hidden = !exploring;
      profile.hidden = !exploring || !state.selectedDeficit;
      search.placeholder = text.search;
      searchLabel.textContent = text.searchLabel ?? text.search;
      if (deficitSearchClear) {
        deficitSearchClear.hidden = !state.clinicalQuery?.trim();
        deficitSearchClear.setAttribute('aria-label', t(language, 'navigator').clearSearch);
      }
      if (document.activeElement !== search) search.value = state.clinicalQuery;
      restoreLabel.textContent = text.restore;
      restore.dataset.tooltip = text.restore;
      coverage.textContent = text.coverage.replace('{count}', String(clinical.search('', language).length));
      list.setAttribute('aria-label', text.deficits);

      const nextListKey = `${language}|${state.clinicalQuery}`;
      if (nextListKey !== listKey) {
        listKey = nextListKey;
        const query = state.clinicalQuery.trim();
        const groups = clinical.grouped(query, language);
        list.replaceChildren(...groups.map(entry => deficitGroup(entry, language)));
        // No match reads as the Anatomy search does; the collection's scope stands under the whole list.
        coverage.hidden = Boolean(query);
        if (!groups.length) {
          list.append(element('p', t(language, 'navigator').noMatch(query), 'empty-title'),
            element('p', text.noResults, 'empty'));
          const near = clinical.nearest(query, language);
          if (near) list.append(bridgeButton(t(language, 'functions').suggest(near), { suggest: near }));
        }
        const functions = query ? functionsMatching(query, language) : 0;
        if (functions) list.append(bridgeButton(text.functionBridge(functions, query), { searchFunctions: query }));
        if (query) announce(text.results(groups.reduce((sum, entry) => sum + entry.deficits.length, 0)));
      }
      for (const button of list.querySelectorAll('.clinical-deficit')) {
        if (button.dataset.deficit === state.selectedDeficit) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
      const nextProfileKey = `${language}|${state.selectedDeficit}`;
      if (nextProfileKey !== profileKey) {
        if (!profileKey?.endsWith(`|${state.selectedDeficit}`)) expanded = new Set();
        profileKey = nextProfileKey;
        actionError = null;
        renderProfile(state);
      }
      updateAction();
      const nextRelatedKey = `${language}|${state.selectedRegion?.id}`;
      if (nextRelatedKey !== relatedKey) {
        relatedKey = nextRelatedKey;
        renderRelated(state);
      }
    },
    focusSearch() { search.focus(); search.select(); },
    openDeficit: selectDeficit,
    dispose() {
      search.removeEventListener('input', onInput);
      search.removeEventListener('keydown', onSearchKey);
      deficitSearchClear?.removeEventListener('click', onClearDeficitSearch);
      list.removeEventListener('click', onDeficitClick);
      list.removeEventListener('keydown', onListKey);
      related.removeEventListener('click', onDeficitClick);
      profile.removeEventListener('click', onProfileClick);
      profile.removeEventListener('toggle', onEvidenceToggle, true);
      restore.removeEventListener('click', onRestoreClick);
      restore.remove();
    },
  };
}
