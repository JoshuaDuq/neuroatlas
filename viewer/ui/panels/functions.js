import { t } from '../../i18n/translations.js';
import { CLINICAL_TEXT } from '../../clinical/translations.js';
import { networkCss } from '../../catalog/networks.js';
import {
  ALL_DOMAINS, domainAreas, domainName, domainRecord, groupedDomains, overviewDomains,
} from '../../catalog/neuropsych-domains.js';
import { decimal } from '../format.js';
import { createButtonLabel } from '../chrome/button-label.js';
import { drillChevron, element, scrollToTop, stageMessage } from './clinical.js';
import { checkedParcels } from './provenance.js';

/** Areas listed before the rest fold under a disclosure. */
const AREAS_SHOWN = 12;

/** A function's row: its colour on the brain, its name, a line under it, and the chevron that opens it. */
function functionButton(id, name, detail, color) {
  const button = element('button', null, 'clinical-deficit function-row');
  button.type = 'button';
  button.dataset.function = id;
  const swatch = element('span', null, 'network-swatch function-swatch');
  swatch.setAttribute('aria-hidden', 'true');
  if (color) swatch.style.background = networkCss(color);
  const text = element('span', null, 'clinical-deficit-text');
  text.append(element('span', name, 'clinical-deficit-name'), element('span', detail, 'clinical-deficit-domain'));
  button.append(swatch, text, drillChevron());
  return button;
}

/** The count of areas a domain reaches, said as the list and the overview say it. */
const areaCount = (partition, id, lang) => t(lang, 'functions')
  .areas(domainAreas(partition, id).length, decimal(partition.threshold_z, 0, lang));

/**
 * The Functions tab: Neurosynth domains under their groups, and a drill-in profile of one, or of
 * all at once. It shares the session render cycle as the Deficits tab does. `onFunction` draws the
 * choice on the brain and may download; `onRegion` and `onDeficit` open what the profile names.
 */
export function createFunctionExplorer({
  domains, anatomy, onQuery, onFunction, onRegion, onDeficit, onRestore, onFailure,
}) {
  const head = document.getElementById('function-search-head');
  const browser = document.getElementById('function-browser');
  const search = document.getElementById('function-search');
  const searchClear = document.getElementById('function-search-clear');
  const searchLabel = document.getElementById('function-search-label');
  const list = document.getElementById('function-list');
  const coverage = document.getElementById('function-coverage');
  const profile = document.getElementById('function-profile');
  const trailing = document.getElementById('detail-trailing');
  const restore = element('button', null, 'clinical-restore icon-button');
  restore.type = 'button';
  restore.id = 'function-restore';
  const restoreLabel = createButtonLabel(restore, 'restore');
  restoreLabel.classList.add('visually-hidden');
  trailing.append(restore);
  let listKey = null;
  let profileKey = null;
  let current = null;
  let opening = false;
  let latest = 0;
  let actionError = null;
  let failure = null;
  let busy = 'loading';
  let operation = 'colour';
  let restorable = false;
  let restored = false;

  // A later choice overtakes an earlier one's download; only the latest speaks.
  async function run(action, { busyText = 'loading', failureText = 'failed', failed = 'colour' } = {}) {
    const mine = ++latest;
    opening = true;
    busy = busyText;
    failure = failureText;
    operation = failed;
    actionError = null;
    restored = false;
    updateAction();
    try {
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

  /** The profile's name takes focus once it opens or its view is restored. */
  function focusTitle(options) {
    const title = document.getElementById('function-title');
    if (!title) return;
    title.tabIndex = -1;
    title.focus(options);
  }

  async function selectFunction(id) {
    const preparing = onFunction(id);
    scrollToTop(profile);
    focusTitle({ preventScroll: true });
    await run(() => preparing);
  }

  async function restorePrevious() {
    if (!(await run(onRestore, { busyText: 'restoring', failureText: 'restoreFailed' }))) return;
    restored = true;
    updateAction();
    focusTitle();
  }

  function areaButton({ region, z }, lang) {
    const entry = anatomy.get(region);
    const side = t(lang, 'sides').capitalized[entry.region.hemisphere];
    const button = element('button', null, 'function-area');
    button.type = 'button';
    button.dataset.functionRegion = region;
    button.setAttribute('aria-label', `${t(lang, 'functions').openArea}: ${entry.label.name} · ${side}, z ${decimal(z, 1, lang)}`);
    button.append(element('span', `${entry.label.name} · ${side}`, 'function-area-name'),
      element('span', `z ${decimal(z, 1, lang)}`, 'function-area-z'));
    const item = element('li');
    item.append(button);
    return item;
  }

  function areasSection(id, lang) {
    const copy = t(lang, 'functions');
    const areas = domainAreas(domains, id);
    const section = element('section', null, 'detail-section function-areas');
    const heading = element('h3', copy.areasHeading, 'detail-section-heading');
    heading.id = 'function-areas-heading';
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading);
    if (!areas.length) {
      section.append(element('p', copy.none(decimal(domains.threshold_z, 0, lang)), 'clinical-note'));
      return section;
    }
    const shown = element('ul', null, 'function-area-list');
    shown.append(...areas.slice(0, AREAS_SHOWN).map(area => areaButton(area, lang)));
    section.append(shown);
    if (areas.length > AREAS_SHOWN) {
      const more = element('details', null, 'inline-disclosure function-more');
      const rest = element('ul', null, 'function-area-list');
      rest.append(...areas.slice(AREAS_SHOWN).map(area => areaButton(area, lang)));
      more.append(element('summary', copy.more(areas.length - AREAS_SHOWN)), rest);
      section.append(more);
    }
    return section;
  }

  function lesionSection(id, lang) {
    const copy = t(lang, 'functions');
    const checks = domains.lesion_checks[id];
    const section = element('section', null, 'detail-section function-lesions');
    const heading = element('h3', copy.lesionHeading, 'detail-section-heading');
    heading.id = 'function-lesions-heading';
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading);
    if (!checks.length) {
      section.append(element('p', t(lang, 'domains').noLesionCheck, 'clinical-note'));
      return section;
    }
    const rows = element('ul', null, 'clinical-related');
    for (const check of checks) {
      const button = element('button', null, 'clinical-deficit');
      button.type = 'button';
      button.dataset.deficit = check.deficit;
      const text = element('span', null, 'clinical-deficit-text');
      text.append(element('span', check.deficit_name[lang], 'clinical-deficit-name'),
        element('span', `${check.references.join(', ')} · ${checkedParcels(check, lang)}`, 'clinical-deficit-domain'));
      button.append(text, drillChevron());
      const item = element('li');
      item.append(button);
      rows.append(item);
    }
    section.append(rows, element('p', copy.lesionNote, 'clinical-note function-lesion-note'));
    return section;
  }

  function overviewSection(lang) {
    const copy = t(lang, 'functions');
    const section = element('section', null, 'detail-section function-overview');
    const heading = element('h3', copy.overviewHeading, 'detail-section-heading');
    heading.id = 'function-overview-heading';
    section.setAttribute('aria-labelledby', heading.id);
    const rows = element('ul', null, 'clinical-related');
    for (const record of overviewDomains(domains)) {
      const item = element('li');
      item.append(functionButton(record.id, domainName(record, lang), areaCount(domains, record.id, lang), record.color));
      rows.append(item);
    }
    section.append(heading, rows);
    return section;
  }

  function renderProfile(state) {
    profile.replaceChildren();
    const id = state.selectedFunction;
    if (!id) return;
    const lang = state.lang;
    const copy = t(lang, 'functions');
    const domainCopy = t(lang, 'domains');
    const all = id === ALL_DOMAINS;
    const record = all ? null : domainRecord(domains, id);
    const name = element('h2', all ? copy.all : domainName(record, lang), 'clinical-profile-name');
    name.id = 'function-title';
    const meta = element('p', null, 'clinical-meta');
    meta.id = 'function-meta';
    meta.setAttribute('role', 'status');
    const body = element('div', null, 'panel-body clinical-content');
    body.append(name, meta,
      element('p', all ? domainCopy.keyAll : copy.term(record.term), 'clinical-summary'),
      element('p', domainCopy.note(domains.sources[domains.scores_source].short), 'clinical-note clinical-caveat'));
    if (all) body.append(overviewSection(lang));
    else body.append(areasSection(id, lang), lesionSection(id, lang));
    body.append(element('p', domains.sources[domains.scores_source].citation, 'clinical-note clinical-sources'));
    profile.append(body);
  }

  function updateAction() {
    for (const button of profile.querySelectorAll('[data-function-region]')) button.disabled = opening;
    const open = current?.explorer === 'functions' && Boolean(current.selectedFunction);
    restore.hidden = !open || opening || !restorable;
    trailing.hidden = [...trailing.children].every(child => child.hidden);
    const metaLine = document.getElementById('function-meta');
    if (!metaLine || !open) return;
    const copy = t(current.lang, 'functions');
    const text = { ...CLINICAL_TEXT[current.lang], loading: copy.loading, failed: copy.failed };
    const status = current.selectedFunction === ALL_DOMAINS ? copy.shown
      : areaCount(domains, current.selectedFunction, current.lang);
    const said = stageMessage(text, { opening, busy, error: actionError, failure, operation,
      lang: current.lang, restored, status });
    if (metaLine.textContent !== said) metaLine.textContent = said;
    metaLine.dataset.error = String(Boolean(actionError));
  }

  const onInput = event => onQuery(event.target.value);
  const onSearchKey = event => {
    if (event.key === 'Escape' && search.value) {
      event.preventDefault();
      search.value = '';
      onQuery('');
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      const first = list.querySelector('.function-row');
      if (first) { event.preventDefault(); first.focus(); }
    }
  };
  const onClear = () => {
    search.value = '';
    searchClear.hidden = true;
    onQuery('');
    search.focus();
  };
  const onListClick = event => {
    const button = event.target.closest('[data-function]');
    if (button) selectFunction(button.dataset.function);
  };
  const onListKey = event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [...list.querySelectorAll('.function-row')];
    const next = buttons[buttons.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1)];
    event.preventDefault();
    if (next) next.focus();
  };
  const onProfileClick = event => {
    const fn = event.target.closest('[data-function]');
    if (fn) return selectFunction(fn.dataset.function);
    const deficit = event.target.closest('[data-deficit]');
    if (deficit) return onDeficit(deficit.dataset.deficit);
    const area = event.target.closest('[data-function-region]');
    if (area && !opening) run(() => onRegion(area.dataset.functionRegion), { failureText: null, failed: 'region' });
  };
  const onRestoreClick = () => { if (!opening) restorePrevious(); };

  search.addEventListener('input', onInput);
  search.addEventListener('keydown', onSearchKey);
  searchClear.addEventListener('click', onClear);
  list.addEventListener('click', onListClick);
  list.addEventListener('keydown', onListKey);
  profile.addEventListener('click', onProfileClick);
  restore.addEventListener('click', onRestoreClick);

  return {
    /** `restorable`: whether the scene from before this excursion's first function or deficit can be put back. */
    update(state, { restorable: canRestore = false } = {}) {
      current = state;
      restorable = canRestore;
      const lang = state.lang;
      const copy = t(lang, 'functions');
      const exploring = state.explorer === 'functions';
      head.hidden = !exploring;
      browser.hidden = !exploring;
      profile.hidden = !exploring || !state.selectedFunction;
      search.placeholder = copy.search;
      searchLabel.textContent = copy.search;
      searchClear.hidden = !state.functionQuery.trim();
      searchClear.setAttribute('aria-label', t(lang, 'navigator').clearSearch);
      if (document.activeElement !== search) search.value = state.functionQuery;
      restoreLabel.textContent = CLINICAL_TEXT[lang].restore;
      restore.dataset.tooltip = CLINICAL_TEXT[lang].restore;
      coverage.textContent = copy.coverage(domains.domains.length);
      list.setAttribute('aria-label', copy.list);

      const nextListKey = `${lang}|${state.functionQuery}`;
      if (nextListKey !== listKey) {
        listKey = nextListKey;
        const groups = groupedDomains(domains, state.functionQuery, lang);
        const overview = element('div', null, 'deficit-group function-overview-row');
        overview.append(functionButton(ALL_DOMAINS, copy.all, copy.allDetail, null));
        list.replaceChildren(...(state.functionQuery.trim() ? [] : [overview]), ...groups.map(({ group, name, domains: members }) => {
          const section = element('div', null, 'deficit-group');
          const heading = element('h3', name, 'section-label deficit-group-heading');
          heading.id = `function-group-${group.id}`;
          section.setAttribute('role', 'group');
          section.setAttribute('aria-labelledby', heading.id);
          section.append(heading, ...members.map(record =>
            functionButton(record.id, domainName(record, lang), areaCount(domains, record.id, lang), record.color)));
          return section;
        }));
        coverage.hidden = !groups.length;
        if (!groups.length) {
          list.append(element('p', t(lang, 'navigator').noMatch(state.functionQuery.trim()), 'empty-title'),
            element('p', copy.noResults, 'empty'));
        }
      }
      for (const button of list.querySelectorAll('.function-row')) {
        button.setAttribute('aria-pressed', String(button.dataset.function === state.selectedFunction));
      }
      const nextProfileKey = `${lang}|${state.selectedFunction}`;
      if (nextProfileKey !== profileKey) {
        if (!profileKey?.endsWith(`|${state.selectedFunction}`)) restored = false;
        profileKey = nextProfileKey;
        actionError = null;
        renderProfile(state);
      }
      updateAction();
    },
    focusSearch() { search.focus(); search.select(); },
    openFunction: selectFunction,
    dispose() {
      search.removeEventListener('input', onInput);
      search.removeEventListener('keydown', onSearchKey);
      searchClear.removeEventListener('click', onClear);
      list.removeEventListener('click', onListClick);
      list.removeEventListener('keydown', onListKey);
      profile.removeEventListener('click', onProfileClick);
      restore.removeEventListener('click', onRestoreClick);
      restore.remove();
    },
  };
}
