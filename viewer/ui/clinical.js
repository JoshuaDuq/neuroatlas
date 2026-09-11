import { CLINICAL_TEXT } from '../clinical/translations.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function deficitButton(deficit, lang) {
  const button = element('button', null, 'clinical-deficit');
  button.type = 'button';
  button.dataset.deficit = deficit.id;
  button.append(element('span', deficit.name[lang]),
    element('span', deficit.domain[lang], 'clinical-note'));
  return button;
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

function associationSection(association, clinical, anatomy, lang) {
  const text = CLINICAL_TEXT[lang];
  const section = element('article', null, 'clinical-association');
  section.append(element('h3', association.title[lang]),
    element('p', `${association.network[lang]} · ${text.laterality[association.laterality]}`, 'clinical-note'),
    element('p', association.finding[lang]),
    element('h4', text.limits), element('p', association.limitation[lang]),
    element('h4', text.mapping), element('p', association.mapping_note[lang], 'clinical-note'));
  const regions = element('div', null, 'clinical-regions');
  for (const mapping of association.mappings) {
    const entry = anatomy.get(mapping.region);
    const label = `${entry.label.name} · ${text.sides[entry.region.hemisphere]}`;
    const button = element('button', null, 'clinical-region-link');
    button.type = 'button';
    button.dataset.clinicalRegion = mapping.region;
    button.setAttribute('aria-label', `${text.openRegion}: ${label}`);
    button.append(element('span', label), element('span', '↗', 'clinical-arrow'));
    regions.append(button);
  }
  if (!association.mappings.length) regions.append(element('p', text.mappingEmpty, 'clinical-note'));
  const details = element('details', null, 'clinical-evidence');
  details.append(element('summary', `${text.evidence} · ${association.evidence.length}`));
  for (const item of association.evidence) {
    details.append(publication(clinical.reference(item.reference), item.role, lang));
  }
  section.append(regions, details);
  return section;
}

/** Deficit navigation and evidence share the existing session render cycle. */
export function createClinicalExplorer({ clinical, anatomy, onExplorer, onQuery, onDeficit, onRegion }) {
  const switcher = document.getElementById('explorer-switch');
  const anatomySearch = document.getElementById('anatomy-search');
  const anatomyBrowser = document.getElementById('anatomy-browser');
  const deficitBrowser = document.getElementById('deficit-browser');
  const search = document.getElementById('deficit-search');
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
  let language = 'en';
  let actionError = null;

  function selectDeficit(id) {
    onDeficit(id);
    document.getElementById('clinical-title').focus();
  }

  function renderProfile(state) {
    const text = CLINICAL_TEXT[state.lang];
    profile.replaceChildren();
    const title = element('h2', text.profile, 'section-label');
    title.id = 'clinical-title';
    title.tabIndex = -1;
    profile.append(title);
    const body = element('div', null, 'panel-body clinical-content');
    if (!state.selectedDeficit) {
      body.append(element('p', text.choose));
    } else {
      const deficit = clinical.get(state.selectedDeficit);
      body.append(element('h3', deficit.name[state.lang], 'clinical-profile-name'),
        element('p', deficit.summary[state.lang]),
        element('p', text.referenceOnly, 'clinical-note'));
      for (const association of clinical.forDeficit(deficit.id)) {
        body.append(associationSection(association, clinical, anatomy, state.lang));
      }
      body.append(element('p', text.openNote, 'clinical-note'),
        element('p', `${text.sources} · ${text.revised}: ${clinical.revised}`, 'clinical-note'));
    }
    const actionStatus = element('p', null, 'clinical-action-status');
    actionStatus.id = 'clinical-action-status';
    actionStatus.setAttribute('role', 'status');
    body.append(actionStatus);
    profile.append(body);
    updateAction();
  }

  function renderRelated(state) {
    related.replaceChildren();
    related.hidden = !state.selectedRegion;
    if (!state.selectedRegion) return;
    const text = CLINICAL_TEXT[state.lang];
    related.append(element('h2', text.related, 'section-label'));
    const body = element('div', null, 'panel-body clinical-content');
    const deficits = new Set(clinical.forRegion(state.selectedRegion.id).map(a => a.deficit));
    for (const id of deficits) body.append(deficitButton(clinical.get(id), state.lang));
    if (!deficits.size) {
      const fineAtlas = ['hcp-mmp', 'nextbrain'].includes(state.selectedRegion.atlas);
      body.append(element('p', fineAtlas ? text.noAtlasCoverage : text.noCoverage, 'clinical-note'));
    }
    related.append(body);
  }

  function updateAction() {
    for (const button of profile.querySelectorAll('[data-clinical-region]')) button.disabled = opening;
    const status = document.getElementById('clinical-action-status');
    if (!status) return;
    status.textContent = opening ? CLINICAL_TEXT[language].loading : actionError?.message ?? '';
    status.hidden = !opening && !actionError;
    status.dataset.error = String(Boolean(actionError));
  }

  const onSwitch = event => {
    const button = event.target.closest('[data-explorer]');
    if (button) onExplorer(button.dataset.explorer);
  };
  const onInput = event => onQuery(event.target.value);
  const onSearchKey = event => {
    if (event.key === 'Escape') {
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
  const onRegionClick = async event => {
    const button = event.target.closest('[data-clinical-region]');
    if (!button || opening) return;
    opening = true;
    actionError = null;
    updateAction();
    try {
      await onRegion(button.dataset.clinicalRegion);
    } catch (error) {
      actionError = error;
      console.error(error);
    } finally {
      opening = false;
      updateAction();
    }
  };

  switcher.addEventListener('click', onSwitch);
  search.addEventListener('input', onInput);
  search.addEventListener('keydown', onSearchKey);
  list.addEventListener('click', onDeficitClick);
  list.addEventListener('keydown', onListKey);
  related.addEventListener('click', onDeficitClick);
  profile.addEventListener('click', onRegionClick);

  return {
    update(state) {
      language = state.lang;
      const text = CLINICAL_TEXT[language];
      const exploring = state.explorer === 'deficits';
      anatomySearch.hidden = exploring;
      anatomyBrowser.hidden = exploring;
      deficitBrowser.hidden = !exploring;
      profile.hidden = !exploring;
      switcher.setAttribute('aria-label', text.explore);
      for (const button of switcher.querySelectorAll('button')) {
        button.textContent = text[button.dataset.explorer];
        button.setAttribute('aria-pressed', String(button.dataset.explorer === state.explorer));
      }
      search.placeholder = text.search;
      searchLabel.textContent = text.search;
      if (document.activeElement !== search) search.value = state.clinicalQuery;
      introduction.textContent = text.introduction;
      coverage.textContent = text.coverage;
      list.setAttribute('aria-label', text.deficits);

      const nextListKey = `${language}|${state.clinicalQuery}`;
      if (nextListKey !== listKey) {
        listKey = nextListKey;
        const matches = clinical.search(state.clinicalQuery, language);
        list.replaceChildren(...matches.map(deficit => deficitButton(deficit, language)));
        if (!matches.length) list.append(element('p', text.noResults, 'empty'));
      }
      for (const button of list.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.deficit === state.selectedDeficit));
      }
      const nextProfileKey = `${language}|${state.selectedDeficit}`;
      if (nextProfileKey !== profileKey) {
        profileKey = nextProfileKey;
        actionError = null;
        renderProfile(state);
      }
      const nextRelatedKey = `${language}|${state.selectedRegion?.id}`;
      if (nextRelatedKey !== relatedKey) {
        relatedKey = nextRelatedKey;
        renderRelated(state);
      }
    },
    focusSearch() { search.focus(); search.select(); },
    dispose() {
      switcher.removeEventListener('click', onSwitch);
      search.removeEventListener('input', onInput);
      search.removeEventListener('keydown', onSearchKey);
      list.removeEventListener('click', onDeficitClick);
      list.removeEventListener('keydown', onListKey);
      related.removeEventListener('click', onDeficitClick);
      profile.removeEventListener('click', onRegionClick);
    },
  };
}
