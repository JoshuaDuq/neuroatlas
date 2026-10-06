const STORAGE_KEY = 'neuroatlas.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
export const THEME_CHOICES = ['system', 'light', 'dark'];

/** A CSS custom property's current value; the token layer owns both palettes. */
export const token = name => (typeof document === 'undefined' ? ''
  : getComputedStyle(document.documentElement).getPropertyValue(name).trim());

// Reading localStorage itself throws where site data is blocked.
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * System, light or dark. System stores nothing and follows the OS live;
 * light and dark are remembered per reader.
 *
 * The attribute drives the CSS token layer; `onChange` then has the renderer
 * read its colours back out of that layer, so neither palette is duplicated in JS.
 */
export function createTheme(onChange, {
  storage = defaultStorage(),
  system = typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null,
} = {}) {
  let stored = null;
  try {
    stored = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    stored = null;
  }
  let choice = stored === 'light' || stored === 'dark' ? stored : 'system';
  const resolve = () => (choice === 'system' ? (system?.matches ? 'dark' : 'light') : choice);
  let theme = resolve();

  function apply() {
    document.documentElement.dataset.theme = theme;
    // The browser's own chrome continues the masthead.
    const meta = document.querySelector?.('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', token('--surface-base') || meta.getAttribute('content'));
    onChange(theme);
  }

  const onSystemChange = () => {
    theme = resolve();
    apply();
  };
  const follow = on => (on
    ? system?.addEventListener('change', onSystemChange)
    : system?.removeEventListener('change', onSystemChange));

  follow(choice === 'system');
  apply();

  return {
    /** The theme in effect: 'light' or 'dark'. */
    get current() { return theme; },
    /** What the reader chose: 'system', 'light' or 'dark'. */
    get choice() { return choice; },
    choose(next) {
      if (!THEME_CHOICES.includes(next)) throw new RangeError(`Unknown theme choice: ${next}`);
      choice = next;
      try {
        if (next === 'system') storage?.removeItem(STORAGE_KEY);
        else storage?.setItem(STORAGE_KEY, next);
      } catch {
        // A reader with site data disabled still gets the theme, just not the memory of it.
      }
      follow(next === 'system');
      theme = resolve();
      apply();
    },
    dispose() {
      follow(false);
    },
  };
}
