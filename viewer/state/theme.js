const STORAGE_KEY = 'neuroatlas.theme';

/** A CSS custom property's current value; the token layer owns both palettes. */
export const token = name => (typeof document === 'undefined' ? ''
  : getComputedStyle(document.documentElement).getPropertyValue(name).trim());


/**
 * Light or dark, stored per reader.
 *
 * The attribute drives the CSS token layer; the renderer then reads its
 * colours back out of that layer, so neither palette is duplicated in JS.
 */
export function createTheme(onChange) {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  let theme = stored === 'dark' || stored === 'light'
    ? stored
    : 'dark';

  function apply() {
    document.documentElement.dataset.theme = theme;
    onChange(theme);
  }

  apply();

  return {
    get current() { return theme; },
    toggle() {
      theme = theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // A reader with site data disabled still gets the theme, just not the memory of it.
      }
      apply();
      return theme;
    },
  };
}
