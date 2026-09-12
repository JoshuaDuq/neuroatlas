import { t } from '../i18n/translations.js';

/** A dash between two keys is a range, not a key to press. */
const isRange = token => /^[\u2013\u2014-]$/.test(token);

/** `1 – 6` is three tokens: two keys and the range between them. */
function keyCaps(keys) {
  return keys.split(' ').filter(Boolean).map(token => {
    const node = document.createElement(isRange(token) ? 'span' : 'kbd');
    if (isRange(token)) node.className = 'key-range';
    node.textContent = token;
    return node;
  });
}

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
      dt.replaceChildren(...keyCaps(keys));
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
