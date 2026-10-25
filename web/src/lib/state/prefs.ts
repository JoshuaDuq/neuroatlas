/** The reader's remembered choices, under the keys the legacy viewer already wrote. */
export const PREF_KEYS = {
  theme: 'planum.theme',
  language: 'planum-lang',
  singleKeyShortcuts: 'planum.single-key-shortcuts',
  stageHint: 'planum.stage-hint',
} as const;

export type PrefKey = (typeof PREF_KEYS)[keyof typeof PREF_KEYS];

// Reading `localStorage` itself throws where site data is blocked.
export function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The stored value, or null when there is none or site data is blocked. */
export function readPref(key: PrefKey, storage: Storage | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** The reader's choice about single-key shortcuts: on unless they said otherwise (shortcuts.js:29). */
export function createKeyPreference(storage: Storage | null = defaultStorage()) {
  let enabled = readPref(PREF_KEYS.singleKeyShortcuts, storage) !== 'off';
  return {
    get enabled() {
      return enabled;
    },
    set(next: boolean) {
      enabled = next;
      writePref(PREF_KEYS.singleKeyShortcuts, enabled ? 'on' : 'off', storage);
    },
  };
}

/** Remembers a value, or forgets the key for null. */
export function writePref(
  key: PrefKey,
  value: string | null,
  storage: Storage | null = defaultStorage(),
): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Site data disabled: the choice holds for this visit only.
  }
}
