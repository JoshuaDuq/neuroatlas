const SHORTCUTS = [
  ['/', 'Focus the search field'],
  ['Esc', 'Clear the search, or the selection'],
  ['↑ ↓', 'Move through results or the tree'],
  ['Enter', 'Select the focused region'],
  ['1 – 6', 'Left, right, front, back, top, bottom view'],
  ['0', 'Return to the default oblique view'],
  ['C', 'Show or hide the cortex'],
  ['H', 'Cycle hemisphere: both, left, right'],
  ['?', 'Open this list'],
];

import { t } from '../i18n/translations.js';

/**
 * The shortcut sheet.
 *
 * A native dialog, so focus trapping, Escape and the backdrop come from the
 * platform rather than from code that has to be kept correct by hand.
 */
export function createShortcuts(initialLang = 'en') {
  const dialog = document.getElementById('shortcuts');
  const list = document.getElementById('shortcuts-list');
  const open = document.getElementById('shortcuts-open');
  const close = document.getElementById('shortcuts-close');
  const shortcutsTitle = document.getElementById('shortcuts-title');

  function renderList(lang) {
    const i18n = t(lang, 'shortcuts');
    if (shortcutsTitle) shortcutsTitle.textContent = i18n.title;
    if (close) close.textContent = i18n.close;
    list.replaceChildren();
    for (const [keys, description] of i18n.items) {
      const dt = document.createElement('dt');
      dt.className = 'measure';
      dt.textContent = keys;
      const dd = document.createElement('dd');
      dd.textContent = description;
      list.append(dt, dd);
    }
  }

  renderList(initialLang);

  const show = () => { if (!dialog.open) dialog.showModal(); };
  const hide = () => dialog.close();
  open.addEventListener('click', show);
  close.addEventListener('click', hide);

  return {
    toggle() { dialog.open ? hide() : show(); },
    get isOpen() { return dialog.open; },
    setLanguage(lang) { renderList(lang); },
    dispose() {
      open.removeEventListener('click', show);
      close.removeEventListener('click', hide);
      list.replaceChildren();
    },
  };
}
