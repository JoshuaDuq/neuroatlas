// Ported from viewer/state/theme.test.js (same cases, same assertions), plus the frame-race fix.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PREF_KEYS } from './prefs.ts';
import { blockedStorage, fakeStorage, fakeSystem, installFakeDocument } from './test-support.ts';
import { createTheme, resolveTheme } from './theme.svelte.ts';
import type { Theme } from '../types/index.ts';

let page: ReturnType<typeof installFakeDocument>;
beforeEach(() => {
  page = installFakeDocument();
});
afterEach(() => page.uninstall());

const options = (storage: unknown, system: unknown) =>
  ({ storage, system }) as Parameters<typeof createTheme>[1];

describe('createTheme', () => {
  test('with nothing stored the theme follows the system at load', () => {
    for (const dark of [false, true]) {
      const notified: Theme[] = [];
      const theme = createTheme((t) => notified.push(t), options(fakeStorage(), fakeSystem(dark)));
      const expected = dark ? 'dark' : 'light';
      expect(theme.choice).toBe('system');
      expect(theme.current).toBe(expected);
      expect(notified).toEqual([expected]);
      expect(page.root.dataset.theme).toBe(expected);
    }
  });

  test('the system choice follows a live OS switch through onChange', () => {
    const system = fakeSystem(false);
    const notified: Theme[] = [];
    const theme = createTheme((t) => notified.push(t), options(fakeStorage(), system));

    system.flip(true);
    expect(theme.current).toBe('dark');
    expect(page.root.dataset.theme).toBe('dark');
    system.flip(false);
    expect(theme.current).toBe('light');
    expect(notified).toEqual(['light', 'dark', 'light']);
  });

  test('choosing light or dark persists it and stops following the system', () => {
    const storage = fakeStorage();
    const system = fakeSystem(false);
    const notified: Theme[] = [];
    const theme = createTheme((t) => notified.push(t), options(storage, system));

    theme.choose('dark');
    expect(theme.choice).toBe('dark');
    expect(theme.current).toBe('dark');
    expect(storage.store[PREF_KEYS.theme]).toBe('dark');
    expect(system.listeners.size).toBe(0);

    system.flip(true);
    system.flip(false);
    expect(theme.current).toBe('dark');
    expect(notified).toEqual(['light', 'dark']);

    theme.choose('light');
    expect(storage.store['planum.theme']).toBe('light');
    expect(page.root.dataset.theme).toBe('light');
  });

  test('a stored choice wins over the system and attaches no listener', () => {
    const system = fakeSystem(false);
    const theme = createTheme(() => {}, options(fakeStorage({ 'planum.theme': 'dark' }), system));
    expect(theme.choice).toBe('dark');
    expect(theme.current).toBe('dark');
    expect(system.listeners.size).toBe(0);
  });

  test('choosing system again clears the stored value and resumes following', () => {
    const storage = fakeStorage({ 'planum.theme': 'light' });
    const system = fakeSystem(true);
    const notified: Theme[] = [];
    const theme = createTheme((t) => notified.push(t), options(storage, system));
    expect(theme.current).toBe('light');

    theme.choose('system');
    expect(theme.choice).toBe('system');
    expect(theme.current).toBe('dark');
    expect('planum.theme' in storage.store).toBe(false);
    expect(system.listeners.size).toBe(1);

    // Choosing it twice must not double the listener.
    theme.choose('system');
    expect(system.listeners.size).toBe(1);

    system.flip(false);
    expect(theme.current).toBe('light');
    expect(notified).toEqual(['light', 'dark', 'dark', 'light']);

    theme.dispose();
    expect(system.listeners.size).toBe(0);
  });

  test('a theme switch holds transitions off for two frames, so no colour fades between palettes', () => {
    const theme = createTheme(() => {}, options(fakeStorage(), fakeSystem(false)));
    page.nextFrame();
    page.nextFrame();
    expect('themeSwitching' in page.root.dataset).toBe(false);

    theme.choose('dark');
    expect(page.root.dataset.themeSwitching).toBe('');
    expect(page.root.dataset.theme).toBe('dark');
    page.nextFrame();
    expect(page.root.dataset.themeSwitching).toBe('');
    page.nextFrame();
    expect('themeSwitching' in page.root.dataset).toBe(false);
  });

  test('a second switch inside those frames holds transitions for its own two frames', () => {
    const theme = createTheme(() => {}, options(fakeStorage(), fakeSystem(false)));
    page.nextFrame();
    page.nextFrame();
    theme.choose('dark');
    page.nextFrame();
    theme.choose('light');
    // The first switch's second frame would have released the hold here.
    page.nextFrame();
    expect(page.root.dataset.themeSwitching).toBe('');
    page.nextFrame();
    expect('themeSwitching' in page.root.dataset).toBe(false);
  });

  test('dispose inside the two frames releases the transition hold for good', () => {
    const theme = createTheme(() => {}, options(fakeStorage(), fakeSystem(false)));
    theme.choose('dark');
    expect(page.root.dataset.themeSwitching).toBe('');
    theme.dispose();
    expect('themeSwitching' in page.root.dataset).toBe(false);
    page.nextFrame();
    page.nextFrame();
    expect('themeSwitching' in page.root.dataset).toBe(false);
  });

  test('an unknown choice is an error, not a silent fallback', () => {
    const theme = createTheme(() => {}, options(fakeStorage(), fakeSystem(false)));
    expect(() => theme.choose('sepia' as never)).toThrow(RangeError);
    expect(theme.choice).toBe('system');
  });

  test('blocked site data still themes, just without memory', () => {
    const theme = createTheme(() => {}, options(blockedStorage, fakeSystem(true)));
    expect(theme.current).toBe('dark');
    theme.choose('light');
    expect(theme.current).toBe('light');
    theme.choose('system');
    expect(theme.current).toBe('dark');
  });

  test('without options it reads the page localStorage and matchMedia', () => {
    const system = fakeSystem(true);
    const queries: string[] = [];
    const globals = globalThis as Record<string, unknown>;
    const storage = fakeStorage();
    globals.matchMedia = (query: string) => {
      queries.push(query);
      return system;
    };
    globals.localStorage = storage;
    try {
      const theme = createTheme(() => {});
      expect(queries).toEqual(['(prefers-color-scheme: dark)']);
      expect(theme.current).toBe('dark');
      theme.choose('light');
      expect(storage.store['planum.theme']).toBe('light');
    } finally {
      delete globals.matchMedia;
      delete globals.localStorage;
    }
  });

  test('the masthead surface is carried into the browser theme colour, also on an OS switch', () => {
    page.uninstall();
    page = installFakeDocument({ light: '#ffffff', dark: '#1d1d1f' });
    const system = fakeSystem(false);
    const theme = createTheme(() => {}, options(fakeStorage(), system));
    expect(page.meta.content).toBe('#ffffff');
    system.flip(true);
    expect(page.meta.content).toBe('#1d1d1f');
    theme.choose('light');
    expect(page.meta.content).toBe('#ffffff');
  });
});

describe('resolveTheme', () => {
  test('a stored light or dark wins; anything else follows the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    for (const stored of [null, 'system', 'sepia', '']) {
      expect(resolveTheme(stored, true)).toBe('dark');
      expect(resolveTheme(stored, false)).toBe('light');
    }
  });
});
