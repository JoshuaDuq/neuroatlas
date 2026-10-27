// Fakes for the node unit and parity tests: storage, the OS colour scheme, animation frames and the document.
// Legacy and new modules read the same globals, so one set of fakes drives both.

export function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
}

export const blockedStorage = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('SecurityError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

/** A MediaQueryList for (prefers-color-scheme: dark) whose answer the test flips. */
export function fakeSystem(dark: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  return {
    matches: dark,
    listeners,
    addEventListener(type: string, listener: (event: { matches: boolean }) => void) {
      if (type === 'change') listeners.add(listener);
    },
    removeEventListener(type: string, listener: (event: { matches: boolean }) => void) {
      if (type === 'change') listeners.delete(listener);
    },
    flip(next: boolean) {
      this.matches = next;
      for (const listener of listeners) listener({ matches: next });
    },
  };
}

export interface FakeMeta {
  content: string;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

/** Installs a document with `<html>` and a theme-colour meta, and animation frames that run when the test says so. */
export function installFakeDocument(surfaces: Record<string, string> = { light: '', dark: '' }) {
  const meta: FakeMeta = {
    content: '#000000',
    setAttribute(name, value) {
      if (name === 'content') this.content = value;
    },
    getAttribute: (name) => (name === 'content' ? meta.content : null),
  };
  const documentElement = { dataset: {} as Record<string, string | undefined> };
  let frames = new Map<number, () => void>();
  let nextId = 1;
  const globals = globalThis as Record<string, unknown>;
  globals.document = {
    documentElement,
    querySelector: (selector: string) => (selector === 'meta[name="theme-color"]' ? meta : null),
  };
  globals.getComputedStyle = () => ({
    getPropertyValue: (name: string) =>
      name === '--surface-base' ? (surfaces[documentElement.dataset.theme ?? ''] ?? '') : '',
  });
  globals.requestAnimationFrame = (callback: () => void) => {
    frames.set(nextId, callback);
    return nextId++;
  };
  globals.cancelAnimationFrame = (id: number) => {
    frames.delete(id);
  };
  return {
    root: documentElement,
    meta,
    nextFrame() {
      const due = frames;
      frames = new Map();
      for (const callback of due.values()) callback();
    },
    uninstall() {
      for (const name of [
        'document',
        'getComputedStyle',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ]) {
        delete globals[name];
      }
    },
  };
}
