import { t, atlasSwitchLabel } from '../i18n/translations.js';
import { CLINICAL_TEXT } from '../clinical/translations.js';
import { visibilityOf } from '../catalog/visibility.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';

/** The tree's own stroked chevron, trailing a row that opens a detail. */
export function drillChevron() {
  const icon = document.createElementNS(SVG, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.classList.add('drill-chevron');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'm9 6 6 6-6 6');
  icon.append(path);
  return icon;
}

function deficitButton(deficit, lang) {
  const button = element('button', null, 'clinical-deficit');
  button.type = 'button';
  button.dataset.deficit = deficit.id;
  const text = element('span', null, 'clinical-deficit-text');
  text.append(element('span', deficit.name[lang]),
    element('span', deficit.domain[lang], 'clinical-note'));
  button.append(text, drillChevron());
  return button;
}

function deficitGroup({ group, deficits }, lang) {
  const section = element('div', null, 'deficit-group');
  const heading = element('h3', group.name[lang], 'deficit-group-heading');
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
  return article;
}

/**
 * One association: a heading that opens its evidence, and its mapped regions always in reach.
 * `sideOnRow` is false when the profile states the one side all its associations share.
 */
function associationSection(association, clinical, anatomy, lang, { open, sideOnRow }) {
  const text = CLINICAL_TEXT[lang];
  const sides = t(lang, 'sides').capitalized;
  const section = element('article', null, 'clinical-association');
  section.dataset.association = association.id;
  const bodyId = `clinical-association-${association.id}`;
  const toggle = element('button', null, 'clinical-association-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-controls', bodyId);
  // The short side reads on screen; a screen reader hears the full one even when the profile states it.
  const spoken = element('span', ` · ${text.laterality[association.laterality]}`, 'visually-hidden');
  let side = spoken;
  if (sideOnRow) {
    const shown = element('span', text.lateralityShort[association.laterality]);
    shown.setAttribute('aria-hidden', 'true');
    side = element('span', null, 'clinical-association-side');
    side.append(shown, spoken);
  }
  toggle.append(element('span', association.title[lang], 'clinical-association-title'), side);
  const heading = element('h3', null, 'clinical-association-head');
  heading.append(toggle);

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

  const body = element('div', null, 'clinical-association-body');
  body.id = bodyId;
  body.hidden = !open;
  body.append(element('p', association.network[lang], 'clinical-note'),
    element('h4', text.studyFinding), element('p', association.finding[lang]),
    element('h4', text.limits), element('p', association.limitation[lang]),
    element('h4', text.mapping), element('p', association.mapping_note[lang], 'clinical-note'),
    element('h4', `${text.evidence} · ${association.evidence.length}`));
  for (const item of association.evidence) {
    body.append(publication(clinical.reference(item.reference), item.role, lang));
  }
  section.append(heading, regions, body);
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
 * What the stage shows for an open deficit: its outlined regions and their atlases, then what opening reset
 * on a line of its own. Clauses hold together and a wrap carries the separator down with the next one.
 */
export function stageStatus(text, { shown, total, atlases, outlined, cleared, lang }) {
  const clauses = [text.regionsMarked(shown, total, outlined)];
  if (atlases.length) clauses.push(new Intl.ListFormat(lang, { type: 'conjunction' }).format(atlases));
  const lines = [clauses.map(clause => clause.replaceAll(' ', '\u00a0')).join(' ·\u00a0')];
  if (cleared) lines.push(text.cleared);
  return lines.join('\n');
}

/** The profile's status line: work in progress, a failure, a restored view, or what the stage shows. */
export function stageMessage(text, { opening, busy, error, failure, restored, status }) {
  if (opening) return text[busy];
  if (error) return failure ? text[failure] : error.message;
  return restored ? text.stageRestored : status;
}

/** A region inspector does not title a Neuropsychology section that has nothing to report. */
export function relatedRegionVisible(selectedRegion, deficitCount) {
  return Boolean(selectedRegion) && deficitCount > 0;
}

/** Deficit navigation and evidence share the existing session render cycle. */
export function createClinicalExplorer({ clinical, anatomy, onQuery, onDeficit, onRegion, onRestore }) {
  const anatomySearch = document.getElementById('anatomy-search');
  const deficitSearchHead = document.getElementById('deficit-search-head');
  const anatomyBrowser = document.getElementById('anatomy-browser');
  const deficitBrowser = document.getElementById('deficit-browser');
  const search = document.getElementById('deficit-search');
  const deficitSearchClear = document.getElementById('deficit-search-clear');
  const searchLabel = document.getElementById('deficit-search-label');
  const introduction = document.getElementById('clinical-introduction');
  const coverage = document.getElementById('clinical-coverage');
  const list = document.getElementById('deficit-list');
  const profile = document.getElementById('clinical-profile');
  const related = document.getElementById('clinical-region');
  let listKey = null;
  let profileKey = null;
  let relatedKey = null;
  let opening = false;
  let pending = 0;
  let language = 'en';
  let actionError = null;
  let busy = 'loading';
  let failure = null;
  // Whether the scene from before the first deficit is held, and whether it was just put back.
  let restorable = false;
  let restored = false;
  let current = null;
  // Open associations survive a language change, not a change of deficit.
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

  // Opening another deficit can overlap the last one's preparation, so this counts rather than refuses.
  async function run(action, { busyText = 'loading', failureText = null } = {}) {
    pending += 1;
    opening = true;
    busy = busyText;
    failure = failureText;
    actionError = null;
    restored = false;
    updateAction();
    try {
      await action();
      return true;
    } catch (error) {
      actionError = error;
      console.error(error);
      return false;
    } finally {
      pending -= 1;
      opening = pending > 0;
      updateAction();
    }
  }

  /** The button leaves with the snapshot, so focus moves to the profile's title just below it. */
  async function restorePrevious() {
    if (!(await run(onRestore, { busyText: 'restoring', failureText: 'restoreFailed' }))) return;
    restored = true;
    updateAction();
    const title = document.getElementById('clinical-title');
    title.tabIndex = -1;
    title.focus();
  }

  function renderProfile(state) {
    profile.replaceChildren();
    if (!state.selectedDeficit) return;
    const text = CLINICAL_TEXT[state.lang];
    const deficit = clinical.get(state.selectedDeficit);
    // What the stage shows, said before the evidence rather than after it.
    const stage = element('div', null, 'clinical-stage');
    const actionStatus = element('p', null, 'clinical-action-status');
    actionStatus.id = 'clinical-action-status';
    actionStatus.setAttribute('role', 'status');
    const drawn = element('p', text.drawnHint, 'clinical-drawn');
    drawn.id = 'clinical-drawn';
    const restore = element('button', text.restore, 'button-quiet clinical-restore');
    restore.type = 'button';
    restore.id = 'clinical-restore';
    stage.append(actionStatus, drawn, restore);
    const name = element('h2', deficit.name[state.lang], 'clinical-profile-name');
    name.id = 'clinical-title';
    const body = element('div', null, 'panel-body clinical-content');
    const found = clinical.forDeficit(deficit.id);
    const side = sharedSide(found.map(association => association.laterality));
    body.append(name);
    if (side) body.append(element('p', text.laterality[side], 'clinical-note clinical-profile-side'));
    body.append(element('p', deficit.summary[state.lang]),
      element('p', text.referenceOnly, 'clinical-note clinical-caveat'));
    const associations = element('div', null, 'clinical-associations');
    for (const association of found) {
      associations.append(associationSection(association, clinical, anatomy, state.lang,
        { open: expanded.has(association.id), sideOnRow: !side }));
    }
    body.append(associations, element('p', text.openNote, 'clinical-note'),
      element('p', `${text.sources} · ${text.revised}: ${clinical.revised}`, 'clinical-note'));
    profile.append(stage, body);
    updateAction();
  }

  /** Counted from what is drawn now, so the strip stays true as the reader hides, cuts or isolates. */
  function stageView(state) {
    const ids = clinical.mappedRegions(state.selectedDeficit);
    const shown = ids.map(id => anatomy.get(id).region).filter(region => visibilityOf(region, state).visible);
    return {
      shown: shown.length,
      total: ids.length,
      atlases: [...new Set(shown.map(region => region.atlas))].map(atlas => atlasSwitchLabel(atlas, state.lang)),
      // A cut turns the stage's outlines off.
      outlined: !state.cutActive,
      cleared: !state.cutActive && !state.isolatedRegion,
      lang: state.lang,
    };
  }

  function renderRelated(state) {
    related.replaceChildren();
    const deficits = state.selectedRegion
      ? new Set(clinical.forRegion(state.selectedRegion.id).map(a => a.deficit))
      : new Set();
    related.hidden = !relatedRegionVisible(state.selectedRegion, deficits.size);
    if (related.hidden) return;
    const text = CLINICAL_TEXT[state.lang];
    related.append(element('h2', text.related, 'section-label'));
    const body = element('div', null, 'panel-body');
    const rows = element('ul', null, 'clinical-related');
    for (const id of deficits) {
      const item = element('li');
      item.append(deficitButton(clinical.get(id), state.lang));
      rows.append(item);
    }
    body.append(rows);
    related.append(body);
  }

  function updateAction() {
    for (const button of profile.querySelectorAll('[data-clinical-region]')) button.disabled = opening;
    const status = document.getElementById('clinical-action-status');
    if (!status || !current?.selectedDeficit) return;
    const view = stageView(current);
    const text = CLINICAL_TEXT[language];
    document.getElementById('clinical-drawn').hidden = opening || restored || view.shown === view.total;
    const said = stageMessage(text, { opening, busy, error: actionError, failure, restored,
      status: stageStatus(text, view) });
    // Rewriting the same words would have the live region say them again on every render.
    if (status.textContent !== said) status.textContent = said;
    status.dataset.error = String(Boolean(actionError));
    document.getElementById('clinical-restore').hidden = opening || !restorable;
  }

  const onInput = event => onQuery(event.target.value);
  const onSearchKey = event => {
    if (event.key === 'Escape' && search.value) {
      event.preventDefault();
      onQuery('');
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      const first = list.querySelector('button');
      if (first) { event.preventDefault(); first.focus(); }
    }
  };
  const onDeficitClick = event => {
    const button = event.target.closest('[data-deficit]');
    if (button) selectDeficit(button.dataset.deficit);
  };
  const onListKey = event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [...list.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    const next = buttons[index + (event.key === 'ArrowDown' ? 1 : -1)];
    event.preventDefault();
    if (next) next.focus();
  };
  const onProfileClick = event => {
    const toggle = event.target.closest('.clinical-association-toggle');
    if (toggle) {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      const id = toggle.closest('[data-association]').dataset.association;
      toggle.setAttribute('aria-expanded', String(open));
      document.getElementById(toggle.getAttribute('aria-controls')).hidden = !open;
      if (open) expanded.add(id); else expanded.delete(id);
      return;
    }
    if (event.target.closest('#clinical-restore')) {
      if (!opening) restorePrevious();
      return;
    }
    const button = event.target.closest('[data-clinical-region]');
    if (button && !opening) run(() => onRegion(button.dataset.clinicalRegion));
  };

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
      introduction.textContent = text.introduction;
      coverage.textContent = text.coverage.replace('{count}', String(clinical.search('', language).length));
      list.setAttribute('aria-label', text.deficits);

      const nextListKey = `${language}|${state.clinicalQuery}`;
      if (nextListKey !== listKey) {
        listKey = nextListKey;
        const groups = clinical.grouped(state.clinicalQuery, language);
        list.replaceChildren(...groups.map(entry => deficitGroup(entry, language)));
        if (!groups.length) list.append(element('p', text.noResults, 'empty'));
      }
      for (const button of list.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.deficit === state.selectedDeficit));
      }
      const nextProfileKey = `${language}|${state.selectedDeficit}`;
      if (nextProfileKey !== profileKey) {
        if (!profileKey?.endsWith(`|${state.selectedDeficit}`)) {
          expanded = new Set();
          restored = false;
        }
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
    },
  };
}
