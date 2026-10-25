import type { Theme } from '../types/index.ts';
import { PREF_KEYS, defaultStorage, readPref, writePref } from './prefs.ts';

export type ThemeChoice = 'system' | Theme;

const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/**
 * The theme in effect for a stored value and the system's setting. The pre-paint script in
 * `index.html` (decision 2 on #4) applies the same rule before the app loads: a stored
 * 'light' or 'dark' wins, anything else follows the system.
 */
export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemDark ? 'dark' : 'light';
}

/**
 * System, light or dark. System stores nothing and follows the OS live;
 * light and dark are remembered per reader.
 *
 * The attribute drives the CSS token layer; `onChange` then has the renderer
 * read its colours back out of that layer (`engine.applyTheme`), so neither
 * palette is duplicated in JS.
 */
export function createTheme(
  onChange: (theme: Theme) => void,
  {
    storage = defaultStorage(),
    system = matchMedia(DARK_QUERY),
  }: { storage?: Storage | null; system?: MediaQueryList } = {},
) {
  const stored = readPref(PREF_KEYS.theme, storage);
  const initial: ThemeChoice = stored === 'light' || stored === 'dark' ? stored : 'system';
  let choice = $state<ThemeChoice>(initial);
  let theme = $state<Theme>(resolveTheme(stored, system.matches));
  let frame = 0;

  function apply() {
    const root = document.documentElement;
    // Both palettes swap in one frame: transitions are held off until the new colours have painted.
    root.dataset.themeSwitching = '';
    root.dataset.theme = theme;
    // A second switch inside those frames holds the transitions for its own two frames.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
      });
    });
    // The browser's own chrome continues the masthead.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const surface = getComputedStyle(root).getPropertyValue('--surface-base').trim();
      meta.setAttribute('content', surface || meta.getAttribute('content') || '');
    }
    onChange(theme);
  }

  const onSystemChange = () => {
    theme = resolveTheme(null, system.matches);
    apply();
  };
  const follow = (on: boolean) =>
    on
      ? system.addEventListener('change', onSystemChange)
      : system.removeEventListener('change', onSystemChange);

  follow(initial === 'system');
  apply();

  return {
    /** The theme in effect: 'light' or 'dark'. */
    get current() {
      return theme;
    },
    /** What the reader chose: 'system', 'light' or 'dark'. */
    get choice() {
      return choice;
    },
    choose(next: ThemeChoice) {
      if (!THEME_CHOICES.includes(next)) throw new RangeError(`Unknown theme choice: ${next}`);
      choice = next;
      writePref(PREF_KEYS.theme, next === 'system' ? null : next, storage);
      follow(next === 'system');
      theme = resolveTheme(next, system.matches);
      apply();
    },
    dispose() {
      follow(false);
      // A switch still inside its two frames would otherwise hold transitions off for good.
      cancelAnimationFrame(frame);
      delete document.documentElement.dataset.themeSwitching;
    },
  };
}

export type ThemeStore = ReturnType<typeof createTheme>;
