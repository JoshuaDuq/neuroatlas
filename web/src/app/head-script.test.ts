// The inline script of index.html runs before the app, so they restates rules the app owns.
// These tests hold each restatement equal to its source.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';
import { decodeState } from '../lib/core/state/url-state.ts';
import { startLanguage } from '../lib/state/language.svelte.ts';
import { PREF_KEYS } from '../lib/state/prefs.ts';
import { resolveTheme } from '../lib/state/theme.svelte.ts';

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const scripts = [...index.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([, source]) => source!);
const [paint] = scripts;
const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

interface Page {
  theme?: string;
  lang: string;
  themeColor?: string;
}

/** Runs a head script against a page with the given storage, system theme and link. */
function run(
  source: string,
  {
    stored = {},
    systemDark = false,
    hash = '',
    blocked = false,
  }: {
    stored?: Record<string, string>;
    systemDark?: boolean;
    hash?: string;
    blocked?: boolean;
  } = {},
): Page {
  const page: Page = { lang: 'en', theme: undefined };
  const root = {
    dataset: {
      set theme(value: string) {
        page.theme = value;
      },
    },
    set lang(value: string) {
      page.lang = value;
    },
  };
  const meta = { setAttribute: (_name: string, value: string) => (page.themeColor = value) };
  runInNewContext(source, {
    document: {
      documentElement: root,
      querySelector: (selector: string) => {
        expect(selector).toBe('meta[name="theme-color"]');
        return meta;
      },
    },
    get localStorage() {
      if (blocked) throw new DOMException('blocked', 'SecurityError');
      return { getItem: (key: string) => stored[key] ?? null };
    },
    matchMedia: (query: string) => {
      expect(query).toBe('(prefers-color-scheme: dark)');
      return { matches: systemDark };
    },
    location: { hash },
    URLSearchParams,
  });
  return page;
}

describe('the pre-paint script', () => {
  test('applies the theme resolveTheme resolves', () => {
    for (const stored of [null, 'light', 'dark', 'system', '', 'Dark']) {
      for (const systemDark of [false, true]) {
        const page = run(paint!, {
          stored: stored === null ? {} : { [PREF_KEYS.theme]: stored },
          systemDark,
        });
        expect(page.theme, `${stored} ${systemDark}`).toBe(resolveTheme(stored, systemDark));
      }
    }
  });

  test('sets <html lang> as startLanguage does, from the link then the saved choice', () => {
    const hashes = [
      '',
      '#lang=fr',
      '#lang=en',
      '#lang=de',
      '#lang=',
      '#tab=functions&lang=fr',
      'lang=fr',
    ];
    for (const hash of hashes) {
      for (const saved of [null, 'fr', 'en', 'de']) {
        const page = run(paint!, {
          hash,
          stored: saved === null ? {} : { [PREF_KEYS.language]: saved },
        });
        expect(page.lang, `${hash} ${saved}`).toBe(
          startLanguage(decodeState(hash).state.lang, saved),
        );
      }
    }
  });

  test('colours the browser chrome with each theme’s --surface-base', () => {
    const surface = (selector: string) =>
      new RegExp(`${selector}\\s*\\{[^}]*--surface-base:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens)![1];
    expect(run(paint!, { systemDark: false }).themeColor).toBe(surface(':root'));
    expect(run(paint!, { systemDark: true }).themeColor).toBe(
      surface(":root\\[data-theme='dark'\\]"),
    );
    expect(index).toContain(`<meta name="theme-color" content="${surface(':root')}" />`);
  });

  test('still paints when site data is blocked', () => {
    const page = run(paint!, { blocked: true, systemDark: true, hash: '#lang=fr' });
    expect(page).toMatchObject({ theme: 'dark', lang: 'fr' });
  });
});
