import { afterEach, describe, expect, test } from 'vitest';
import { PREF_KEYS, defaultStorage, readPref, writePref } from './prefs.ts';
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
});
