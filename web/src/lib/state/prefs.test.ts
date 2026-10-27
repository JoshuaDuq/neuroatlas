import { afterEach, describe, expect, test } from 'vitest';
import { PREF_KEYS, createKeyPreference, defaultStorage, readPref, writePref } from './prefs.ts';
import { blockedStorage, fakeStorage } from './test-support.ts';

const asStorage = (fake: unknown) => fake as Storage;

describe('prefs', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  test('the keys are the ones the legacy viewer wrote', () => {
    expect(PREF_KEYS).toEqual({
      theme: 'planum.theme',
      language: 'planum-lang',
      singleKeyShortcuts: 'planum.single-key-shortcuts',
      stageHint: 'planum.stage-hint',
    });
  });

  test('a value round-trips and null forgets it', () => {
    const storage = fakeStorage();
    expect(readPref(PREF_KEYS.stageHint, asStorage(storage))).toBeNull();
    writePref(PREF_KEYS.stageHint, 'retired', asStorage(storage));
    expect(storage.store).toEqual({ 'planum.stage-hint': 'retired' });
    expect(readPref(PREF_KEYS.stageHint, asStorage(storage))).toBe('retired');
    writePref(PREF_KEYS.stageHint, null, asStorage(storage));
    expect(storage.store).toEqual({});
  });

  test('blocked site data reads as nothing stored and writes nothing', () => {
    expect(readPref(PREF_KEYS.theme, asStorage(blockedStorage))).toBeNull();
    expect(() => writePref(PREF_KEYS.theme, 'dark', asStorage(blockedStorage))).not.toThrow();
    expect(() => writePref(PREF_KEYS.theme, null, asStorage(blockedStorage))).not.toThrow();
  });

  test('no storage at all is tolerated', () => {
    expect(readPref(PREF_KEYS.theme, null)).toBeNull();
    expect(() => writePref(PREF_KEYS.theme, 'dark', null)).not.toThrow();
  });

  test('the default storage is localStorage, or null where reading it throws', () => {
    const globals = globalThis as Record<string, unknown>;
    expect(defaultStorage()).toBeNull();
    const storage = fakeStorage();
    globals.localStorage = storage;
    expect(defaultStorage()).toBe(storage);
    Object.defineProperty(globals, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(defaultStorage()).toBeNull();
  });

  // Ported from viewer/ui/chrome/shortcuts.test.js:34-52.
  test('the key preference defaults on and survives a reload', () => {
    const storage = asStorage(fakeStorage());
    const first = createKeyPreference(storage);
    expect(first.enabled).toBe(true);
    first.set(false);
    expect(first.enabled).toBe(false);
    expect(createKeyPreference(storage).enabled).toBe(false);
    createKeyPreference(storage).set(true);
    expect(createKeyPreference(storage).enabled).toBe(true);
  });

  test('blocked storage still gives a working key preference', () => {
    const preference = createKeyPreference(asStorage(blockedStorage));
    expect(preference.enabled).toBe(true);
    preference.set(false);
    expect(preference.enabled).toBe(false);
  });
});
