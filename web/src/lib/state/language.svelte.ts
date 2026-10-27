import type { Language } from '../types/index.ts';
import { PREF_KEYS, defaultStorage, readPref, writePref } from './prefs.ts';

const LANGUAGES: readonly Language[] = ['en', 'fr'];

/**
 * The language to start in: the link's, else the reader's saved choice, else English
 * (state/boot.js:4). `linkLanguage` is what `decodeState` found in the link; a `lang` the
 * link gets wrong is absent there and reported elsewhere, so it does not decide this.
 */
export function startLanguage(linkLanguage: Language | undefined, saved: string | null): Language {
  return linkLanguage ?? (saved === 'fr' ? 'fr' : 'en');
}

/** The reader's language. `<html lang>` follows it, and a choice is remembered. */
export function createLanguage(
  linkLanguage: Language | undefined,
  { storage = defaultStorage() }: { storage?: Storage | null } = {},
) {
  const initial = startLanguage(linkLanguage, readPref(PREF_KEYS.language, storage));
  let language = $state<Language>(initial);
  document.documentElement.lang = initial;
  return {
    get current() {
      return language;
    },
    set(next: Language) {
      if (!LANGUAGES.includes(next)) throw new RangeError(`Unknown language: ${next}`);
      language = next;
      document.documentElement.lang = next;
      writePref(PREF_KEYS.language, next, storage);
    },
    /** The language a link carries: shown and announced, never remembered (app.js:612). */
    follow(next: Language) {
      if (!LANGUAGES.includes(next)) throw new RangeError(`Unknown language: ${next}`);
      language = next;
      document.documentElement.lang = next;
    },
  };
}

export type LanguageStore = ReturnType<typeof createLanguage>;
