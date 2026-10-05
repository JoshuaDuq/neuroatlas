import { PHONE_QUERY } from '../render/device.js';
import { t } from '../i18n/translations.js';
import { createButtonLabel } from './button-label.js';

const PANELS = ['find', 'region', 'cuts', 'display'];

export function panelAfterSelection({ active, previousSelection, selection, hasContext }) {
  if (active === 'region' && !hasContext) return 'find';
  if (active === 'find' && selection && selection !== previousSelection) return 'region';
  return active;
}

/** One task panel; the phone sheet takes over its visibility below 640px. */
export function createWorkspace(onPanelChange) {
  const bar = document.getElementById('workspace-tabs');
  const strip = document.getElementById('workspace-selection');
  const stripName = document.getElementById('workspace-selection-name');
  const stripSide = document.getElementById('workspace-selection-side');
  const navigator = document.getElementById('navigator');
  const inspector = document.getElementById('inspector');
  const groups = [...inspector.querySelectorAll('.tab-group')];
  const panels = [navigator, ...groups];
  const query = globalThis.matchMedia(PHONE_QUERY);
  let active = 'find';
  let owned = false;
  let hasContext = false;
  let previousSelection = null;
  let selection = {};

  const labels = new Map();
  const buttons = PANELS.map(name => {
    const panel = panels.find(panel => panel.dataset.tab === name);
    panel.id ||= `workspace-panel-${name}`;
    panel.role = 'tabpanel';
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.id = `workspace-tab-${name}`;
    button.dataset.tab = name;
    labels.set(button, createButtonLabel(button, name));
    button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => show(name));
    bar.append(button);
    return button;
  });

  function apply() {
    for (const button of buttons) {
      const selected = button.dataset.tab === active;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.disabled = button.dataset.tab === 'region' && !hasContext;
    }
    stripName.textContent = selection.label ?? '';
    stripSide.textContent = selection.side ?? '';
    if (!owned) return;
    strip.hidden = active === 'region' || !selection.label;
    navigator.hidden = active !== 'find';
    inspector.hidden = active === 'find';
    for (const group of groups) group.hidden = group.dataset.tab !== active;
  }

  function show(name) {
    if (!PANELS.includes(name)) throw new RangeError(`Unknown workspace panel: ${name}`);
    if (name === 'region' && !hasContext) return;
    const fromSelection = document.activeElement === strip;
    active = name;
    apply();
    if (owned && fromSelection) focusPanel();
    if (owned) onPanelChange();
  }

  function focusPanel() {
    const panel = panels.find(panel => panel.dataset.tab === active);
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
  }

  const onSelection = () => show('region');
  const onKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const available = buttons.filter(button => !button.disabled);
    const current = available.findIndex(button => button.dataset.tab === active);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
    show(available[index].dataset.tab);
    available[index].focus();
  };
  bar.addEventListener('keydown', onKeyDown);
  strip.addEventListener('click', onSelection);

  return {
    show,
    activate() {
      if (query.matches) return;
      owned = true;
      bar.hidden = false;
      for (const panel of panels) panel.setAttribute('aria-labelledby', `workspace-tab-${panel.dataset.tab}`);
      apply();
    },
    deactivate() {
      owned = false;
      bar.hidden = true;
      strip.hidden = true;
    },
    update(state, nextSelection) {
      const copy = t(state.lang, 'workspace');
      const selectedId = state.selectedRegion?.id ?? null;
      hasContext = Boolean(selectedId || state.selectedDeficit || state.explorer === 'circuits');
      const previousPanel = active;
      const containsFocus = panels.find(panel => panel.dataset.tab === active).contains(document.activeElement);
      active = panelAfterSelection({ active, previousSelection, selection: selectedId, hasContext });
      previousSelection = selectedId;
      selection = nextSelection;
      for (const button of buttons) labels.get(button).textContent = copy.tabs[button.dataset.tab];
      bar.setAttribute('aria-label', copy.tabsAria);
      strip.setAttribute('aria-label', copy.inspect(selection.label ?? ''));
      apply();
      if (owned && containsFocus && active !== previousPanel) focusPanel();
    },
    dispose() {
      bar.removeEventListener('keydown', onKeyDown);
      strip.removeEventListener('click', onSelection);
      bar.replaceChildren();
    },
  };
}
