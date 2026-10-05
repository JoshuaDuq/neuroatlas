import { t } from '../i18n/translations.js';

const SINGLE_KEYS_STORAGE = 'neuroatlas.single-key-shortcuts';

/**
 * Pressable controls in the panels and the masthead. Form fields are
 * judged by `shortcutsAllowed`, which knows which keys each one uses.
 */
const OWN_KEYS = 'button, summary, [role="tab"]';
const PANELS = '#sheet, #masthead, #stage-dock';

/** A dash between two keys is a range, not a key to press. */
const isRange = token => /^[–—-]$/.test(token);

/** Letters, digits and symbols: the keys WCAG 2.1.4 lets a reader turn off. */
export const isCharacterKey = key => typeof key === 'string' && [...key].length === 1;

/**
 * Whether a one-character shortcut may act. Off entirely if the reader turned
 * them off, and never from a panel control: an `h` pressed on a hemisphere
 * button would otherwise change the hemisphere.
 */
export function characterShortcutAllowed(target, enabled) {
  if (!enabled) return false;
  return !(target?.matches?.(OWN_KEYS) && target.closest?.(PANELS));
}

/** The reader's choice about single-key shortcuts, on unless they said otherwise. */
export function createKeyPreference(storage) {
  const store = () => storage ?? globalThis.localStorage;
  let enabled = true;
  try {
    enabled = store()?.getItem(SINGLE_KEYS_STORAGE) !== 'off';
  } catch {
    enabled = true;
  }
  return {
    get enabled() { return enabled; },
    set(next) {
      enabled = Boolean(next);
      try {
        store()?.setItem(SINGLE_KEYS_STORAGE, enabled ? 'on' : 'off');
      } catch {
        // Site data disabled: the choice holds for this visit only.
      }
    },
  };
}

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
  const moreButton = document.getElementById('masthead-more');
  const note = document.createElement('p');
  note.id = 'shortcuts-note';
  note.className = 'shortcuts-note';
  list.after(note);
  let lang = initialLang;
  let singleKeys = true;
  let opener = null;

  function renderList() {
    const i18n = t(lang, 'shortcuts');
    if (shortcutsTitle) shortcutsTitle.textContent = i18n.title;
    if (close) close.textContent = i18n.close;
    list.replaceChildren(...i18n.groups.map(([title, items]) => {
      const heading = document.createElement('h3');
      heading.className = 'shortcuts-group';
      heading.textContent = title;
      const keys = document.createElement('dl');
      for (const [caps, description] of items) {
        const dt = document.createElement('dt');
        dt.replaceChildren(...keyCaps(caps));
        const dd = document.createElement('dd');
        dd.textContent = description;
        keys.append(dt, dd);
      }
      const section = document.createElement('section');
      section.append(heading, keys);
      return section;
    }));
    note.textContent = i18n.singleKeysNote(singleKeys);
  }

  renderList();

  const show = () => {
    if (dialog.open) return;
    opener = document.activeElement;
    dialog.showModal();
  };
  const hide = () => dialog.close();
  // The platform returns focus to the opener, but the settings menu closes
  // behind the dialog and takes its button with it.
  const onClose = () => {
    const returned = opener?.isConnected && opener.checkVisibility?.() !== false;
    opener = null;
    if (!returned) moreButton?.focus();
  };
  open.addEventListener('click', show);
  close.addEventListener('click', hide);
  dialog.addEventListener('close', onClose);

  return {
    toggle() { dialog.open ? hide() : show(); },
    get isOpen() { return dialog.open; },
    setLanguage(next) {
      lang = next;
      renderList();
    },
    setSingleKeys(enabled) {
      singleKeys = enabled;
      note.textContent = t(lang, 'shortcuts').singleKeysNote(singleKeys);
    },
    dispose() {
      open.removeEventListener('click', show);
      close.removeEventListener('click', hide);
      dialog.removeEventListener('close', onClose);
      list.replaceChildren();
      note.remove();
    },
  };
}
