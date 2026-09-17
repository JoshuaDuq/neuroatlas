import { PHONE_QUERY } from '../render/device.js';
import { t } from '../i18n/translations.js';

const TABS = ['region', 'cuts', 'display'];

/**
 * The inspector's panel switch, plus the selection readout above it.
 *
 * The readout is what makes tabbing safe: clicking the model while the cuts
 * panel is open confirms what was hit without leaving the task. Its height is
 * reserved either way, so a selection never shifts the control under the
 * cursor. Below the phone breakpoint the sheet owns the panels and this
 * stands down — hence the `owned` guard on every write.
 */
export function createInspectorTabs() {
  const bar = document.getElementById('inspector-tabs');
  const strip = document.getElementById('inspector-selection');
  const stripName = document.getElementById('inspector-selection-name');
  const stripSide = document.getElementById('inspector-selection-side');
  const body = document.querySelector('#inspector > .rail-body');
  const groups = [...document.querySelectorAll('#inspector .tab-group')];

  const query = globalThis.matchMedia?.(PHONE_QUERY)
    ?? { matches: false, addEventListener() {}, removeEventListener() {} };

  let active = 'region';
  let owned = false;
  let selection = {};

  for (const group of groups) {
    group.id ||= `inspector-panel-${group.dataset.tab}`;
    group.role = 'tabpanel';
  }

  const buttons = TABS.map(name => {
    const button = document.createElement('button');
    const panel = groups.find(group => group.dataset.tab === name);
    button.type = 'button';
    button.role = 'tab';
    button.id = `inspector-tab-${name}`;
    button.dataset.tab = name;
    button.setAttribute('aria-selected', String(name === active));
    if (panel) {
      button.setAttribute('aria-controls', panel.id);
      panel.setAttribute('aria-labelledby', button.id);
    }
    button.addEventListener('click', () => show(name));
    bar.append(button);
    return button;
  });

  /*
   * Silent on the Region panel, which carries the name itself; the line keeps
   * its height either way, so nothing moves when it starts or stops speaking.
   */
  function paintStrip() {
    const show = active !== 'region' ? selection.label : null;
    stripName.textContent = show ?? '';
    stripSide.textContent = show ? selection.side ?? '' : '';
  }

  function apply() {
    paintStrip();
    for (const button of buttons) {
      const selected = button.dataset.tab === active;
      button.setAttribute('aria-selected', String(selected));
      // Roving tabindex: the bar is one stop, the arrows move within it.
      button.tabIndex = selected ? 0 : -1;
    }
    if (!owned) return;
    // The name lives in the Region panel itself. On Cuts and Display the
    // strip confirms what is selected without moving the controls: its
    // height stays reserved there, and only there.
    strip.hidden = active === 'region';
    for (const group of groups) group.hidden = group.dataset.tab !== active;
  }

  function show(name) {
    if (!TABS.includes(name) || name === active) return;
    active = name;
    apply();
    if (owned && body) body.scrollTop = 0;
  }

  const onKeyDown = event => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -TABS.length, End: TABS.length }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = Math.min(TABS.length - 1, Math.max(0, TABS.indexOf(active) + step));
    show(TABS[next]);
    buttons[next].focus();
  };
  bar.addEventListener('keydown', onKeyDown);

  return {
    get active() { return active; },
    get owned() { return owned; },
    show,

    activate() {
      if (query.matches) return;
      owned = true;
      bar.hidden = false;
      apply();
    },

    deactivate() {
      owned = false;
      bar.hidden = true;
      strip.hidden = true;
    },

    update(state, { label, side } = {}) {
      const copy = t(state.lang, 'sheet');
      for (const button of buttons) button.textContent = copy.tabs[button.dataset.tab];
      bar.setAttribute('aria-label', copy.tabsAria);
      selection = { label, side };
      paintStrip();
    },

    dispose() {
      owned = false;
      bar.hidden = true;
      strip.hidden = true;
      bar.removeEventListener('keydown', onKeyDown);
      bar.replaceChildren();
      for (const group of groups) group.hidden = false;
    },
  };
}
