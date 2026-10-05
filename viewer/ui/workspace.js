import { PHONE_QUERY } from '../render/device.js';
import { t } from '../i18n/translations.js';
import { isIndependentTractReference } from '../diffusion/presentation.js';

export const MODES = ['anatomy', 'deficits', 'circuits', 'diffusion'];

/** A list's current item, which a list that comes back into view shows. */
const CURRENT_ITEM = '#tree [aria-current="true"], #deficit-list [aria-pressed="true"], '
  + '#circuit-landmarks [aria-current="step"]';

/** Whether the current mode has anything for the detail view to show. */
export function detailAvailable(state) {
  if (isIndependentTractReference(state)) return false;
  if (state.selectedRegion) return true;
  if (state.explorer === 'deficits') return Boolean(state.selectedDeficit);
  if (state.explorer === 'circuits') return Boolean(state.lesson?.circuit);
  return false;
}

/**
 * The panel view after a render. A new region selection drills in from any
 * mode; losing the last context returns to the list; tract reference data
 * has no detail view at all.
 */
export function viewAfterUpdate({ view, reference, wasAvailable, available, previousSelection, selection }) {
  if (reference) return 'list';
  if (selection && selection !== previousSelection) return 'detail';
  if (wasAvailable && !available) return 'list';
  return view;
}

/** The modes whose list already shows a selection of each kind. */
const LISTED_IN = {
  region: ['anatomy'],
  landmark: ['anatomy', 'circuits'],
  deficit: ['deficits'],
  lesson: ['circuits'],
};

/** The selection strip leads to a selection only where the panel in front is not already showing it. */
export function stripVisible({ view, mode, selection }) {
  if (view !== 'list' || !selection.label) return false;
  const listed = LISTED_IN[selection.kind];
  if (!listed) throw new Error(`Unknown selection kind: ${selection.kind}`);
  return !listed.includes(mode);
}

/**
 * One row of mode tabs. Arrows, Home and End move focus; Enter, Space or a
 * click chooses, because choosing Tracts can swap the whole scene.
 */
function createModeTabs(bar, prefix, onChoose) {
  const buttons = MODES.map(mode => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.id = `${prefix}-${mode}`;
    button.dataset.mode = mode;
    button.addEventListener('click', () => onChoose(mode));
    bar.append(button);
    return button;
  });
  const onKeyDown = event => {
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    const last = buttons.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons[next].focus();
  };
  bar.addEventListener('keydown', onKeyDown);
  return {
    render(mode, labels, ariaLabel, controls) {
      bar.setAttribute('aria-label', ariaLabel);
      for (const button of buttons) {
        const selected = button.dataset.mode === mode;
        button.textContent = labels[button.dataset.mode];
        button.dataset.label = labels[button.dataset.mode];
        button.setAttribute('aria-selected', String(selected));
        button.setAttribute('aria-controls', controls);
        button.tabIndex = selected ? 0 : -1;
      }
    },
    selected: () => buttons.find(button => button.getAttribute('aria-selected') === 'true'),
    dispose() {
      bar.removeEventListener('keydown', onKeyDown);
      bar.replaceChildren();
    },
  };
}

/**
 * The task panel: four content modes over a list, and a drill-in detail view.
 * It owns the mode tabs, the detail's location bar and the list/detail switch
 * in both shells; the phone sheet only decides how much of the panel is on screen.
 * `onReturn` reports the reader stepping back to a list, as opposed to a list
 * shown because the context went away.
 */
export function createWorkspace({ onMode, onClear, onViewChange, onReturn } = {}) {
  const panel = document.getElementById('workspace-panel');
  const sheet = document.getElementById('sheet');
  const strip = document.getElementById('workspace-selection');
  const stripName = document.getElementById('workspace-selection-name');
  const stripSide = document.getElementById('workspace-selection-side');
  const stripClear = document.getElementById('workspace-selection-clear');
  const navigator = document.getElementById('navigator');
  const inspector = document.getElementById('inspector');
  const back = document.getElementById('detail-back');
  const backLabel = document.getElementById('detail-back-label');
  const query = globalThis.matchMedia(PHONE_QUERY);
  const desktopTabs = createModeTabs(document.getElementById('workspace-tabs'), 'workspace-tab', choose);
  const sheetTabs = createModeTabs(document.getElementById('sheet-tabs'), 'sheet-tab', choose);
  const bar = document.getElementById('workspace-tabs');
  let owned = false;
  let view = 'list';
  let mode = 'anatomy';
  let reference = false;
  let available = false;
  let previousSelection = null;
  let selection = {};
  let place = null;
  let lang = 'en';
  let opener = null;

  navigator.role = 'tabpanel';
  inspector.role = 'tabpanel';

  function apply() {
    const copy = t(lang, 'workspace');
    const shown = view === 'detail' ? inspector : navigator;
    navigator.hidden = view === 'detail';
    inspector.hidden = view !== 'detail';
    for (const node of [navigator, inspector]) {
      node.setAttribute('aria-labelledby', `${owned ? 'workspace-tab' : 'sheet-tab'}-${mode}`);
    }
    panel.dataset.view = view;
    sheet.dataset.view = view;
    desktopTabs.render(mode, copy.modes, copy.tabsAria, shown.id);
    sheetTabs.render(mode, copy.modes, copy.tabsAria, shown.id);
    const where = place ?? copy.modes[mode];
    backLabel.textContent = where;
    back.setAttribute('aria-label', copy.back(where));
    if (place) back.title = place;
    else back.removeAttribute('title');
    stripName.textContent = selection.label ?? '';
    stripSide.textContent = selection.side ?? '';
    strip.setAttribute('aria-label', copy.inspect(selection.label ?? ''));
    strip.hidden = !owned || !stripVisible({ view, mode, selection });
    stripClear.hidden = strip.hidden || !selection.clearable;
  }

  const visible = node => node?.isConnected && node.checkVisibility?.() !== false;

  /** Back in the list: the control that opened the detail, or the tab in front. */
  function restoreFocus() {
    const target = visible(opener) ? opener
      : opener?.id && navigator.querySelector(`#${CSS.escape(opener.id)}`);
    opener = null;
    if (visible(target)) target.focus({ preventScroll: true });
    else (owned ? desktopTabs : sheetTabs).selected()?.focus();
  }

  function setView(next) {
    if (next === view) return;
    const active = document.activeElement;
    const fromList = navigator.contains(active) || (owned && active === strip);
    const fromDetail = inspector.contains(active);
    view = next;
    apply();
    if (view === 'detail') {
      opener = fromList ? active : null;
      if (fromList) back.focus({ preventScroll: true });
    } else {
      // A detail hid the list while its selection changed, so the current item may be out of view.
      [...navigator.querySelectorAll(CURRENT_ITEM)].find(visible)?.scrollIntoView({ block: 'nearest' });
      if (fromDetail) restoreFocus();
      else opener = null;
    }
    onViewChange?.();
  }

  function returnToList() {
    if (view !== 'detail') return;
    setView('list');
    onReturn?.();
  }

  // Choosing the mode already in front steps back to its list, like Back.
  function choose(next) {
    if (next === mode) {
      returnToList();
      return;
    }
    opener = null;
    setView('list');
    onMode?.(next);
  }

  const onBack = returnToList;
  const onStrip = () => { if (available) setView('detail'); };
  // The strip and its clear vanish with the context, so focus goes to the tab in front.
  const onClearClick = () => {
    onClear?.();
    if (!visible(document.activeElement)) desktopTabs.selected()?.focus();
  };
  back.addEventListener('click', onBack);
  strip.addEventListener('click', onStrip);
  stripClear.addEventListener('click', onClearClick);

  return {
    get view() { return view; },
    /** Whether focus is inside the detail view, where Escape means Back. */
    get focusInDetail() { return view === 'detail' && inspector.contains(document.activeElement); },
    showList() { setView('list'); },
    showDetail() { if (!reference) setView('detail'); },
    back: returnToList,
    activate() {
      if (query.matches) return;
      owned = true;
      bar.hidden = false;
      apply();
    },
    deactivate() {
      owned = false;
      bar.hidden = true;
      apply();
    },
    /** `nextPlace` names where the detail sits when that is more than its mode, such as a circuit. */
    update(state, nextSelection = {}, nextPlace = null) {
      const selectedId = state.selectedRegion?.id ?? null;
      lang = state.lang;
      mode = state.explorer;
      reference = isIndependentTractReference(state);
      const wasAvailable = available;
      available = detailAvailable(state);
      selection = nextSelection;
      place = nextPlace;
      const next = viewAfterUpdate({
        view, reference, wasAvailable, available, previousSelection, selection: selectedId,
      });
      previousSelection = selectedId;
      stripClear.setAttribute('aria-label', t(state.lang, 'inspector').clearSelection);
      stripClear.title = t(state.lang, 'inspector').clearSelection;
      if (next !== view) setView(next);
      else apply();
    },
    dispose() {
      back.removeEventListener('click', onBack);
      strip.removeEventListener('click', onStrip);
      stripClear.removeEventListener('click', onClearClick);
      desktopTabs.dispose();
      sheetTabs.dispose();
    },
  };
}
