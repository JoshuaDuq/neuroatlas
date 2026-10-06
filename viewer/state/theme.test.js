import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { createTheme } from './theme.js';

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    getItem: key => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
  };
}

// A MediaQueryList for (prefers-color-scheme: dark) whose answer the test flips.
function fakeSystem(dark) {
  const listeners = new Set();
  return {
    matches: dark,
    listeners,
    addEventListener(type, listener) { if (type === 'change') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'change') listeners.delete(listener); },
    flip(next) {
      this.matches = next;
      for (const listener of [...listeners]) listener({ matches: next });
    },
  };
}

beforeEach(() => {
  globalThis.document = { documentElement: { dataset: {} } };
});

test('with nothing stored the theme follows the system at load', () => {
  for (const dark of [false, true]) {
    const notified = [];
    const theme = createTheme(t => notified.push(t), { storage: fakeStorage(), system: fakeSystem(dark) });
    const expected = dark ? 'dark' : 'light';
    assert.equal(theme.choice, 'system');
    assert.equal(theme.current, expected);
    assert.deepEqual(notified, [expected]);
    assert.equal(document.documentElement.dataset.theme, expected);
  }
});

test('the system choice follows a live OS switch through onChange', () => {
  const system = fakeSystem(false);
  const notified = [];
  const theme = createTheme(t => notified.push(t), { storage: fakeStorage(), system });

  system.flip(true);
  assert.equal(theme.current, 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  system.flip(false);
  assert.equal(theme.current, 'light');
  assert.deepEqual(notified, ['light', 'dark', 'light']);
});

test('choosing light or dark persists it and stops following the system', () => {
  const storage = fakeStorage();
  const system = fakeSystem(false);
  const notified = [];
  const theme = createTheme(t => notified.push(t), { storage, system });

  theme.choose('dark');
  assert.equal(theme.choice, 'dark');
  assert.equal(theme.current, 'dark');
  assert.equal(storage.store['neuroatlas.theme'], 'dark');
  assert.equal(system.listeners.size, 0);

  system.flip(true);
  system.flip(false);
  assert.equal(theme.current, 'dark');
  assert.deepEqual(notified, ['light', 'dark']);

  theme.choose('light');
  assert.equal(storage.store['neuroatlas.theme'], 'light');
  assert.equal(document.documentElement.dataset.theme, 'light');
});

test('a stored choice wins over the system and attaches no listener', () => {
  const system = fakeSystem(false);
  const theme = createTheme(() => {}, { storage: fakeStorage({ 'neuroatlas.theme': 'dark' }), system });
  assert.equal(theme.choice, 'dark');
  assert.equal(theme.current, 'dark');
  assert.equal(system.listeners.size, 0);
});

test('choosing system again clears the stored value and resumes following', () => {
  const storage = fakeStorage({ 'neuroatlas.theme': 'light' });
  const system = fakeSystem(true);
  const notified = [];
  const theme = createTheme(t => notified.push(t), { storage, system });
  assert.equal(theme.current, 'light');

  theme.choose('system');
  assert.equal(theme.choice, 'system');
  assert.equal(theme.current, 'dark');
  assert.equal('neuroatlas.theme' in storage.store, false);
  assert.equal(system.listeners.size, 1);

  // Choosing it twice must not double the listener.
  theme.choose('system');
  assert.equal(system.listeners.size, 1);

  system.flip(false);
  assert.equal(theme.current, 'light');
  assert.deepEqual(notified, ['light', 'dark', 'dark', 'light']);

  theme.dispose();
  assert.equal(system.listeners.size, 0);
});

test('an unknown choice is an error, not a silent fallback', () => {
  const theme = createTheme(() => {}, { storage: fakeStorage(), system: fakeSystem(false) });
  assert.throws(() => theme.choose('sepia'), RangeError);
  assert.equal(theme.choice, 'system');
});

test('blocked site data still themes, just without memory', () => {
  const blocked = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  const theme = createTheme(() => {}, { storage: blocked, system: fakeSystem(true) });
  assert.equal(theme.current, 'dark');
  theme.choose('light');
  assert.equal(theme.current, 'light');
  theme.choose('system');
  assert.equal(theme.current, 'dark');
});

test('without options it reads the page localStorage and matchMedia', () => {
  const system = fakeSystem(true);
  const queries = [];
  globalThis.matchMedia = query => { queries.push(query); return system; };
  globalThis.localStorage = fakeStorage();
  try {
    const theme = createTheme(() => {});
    assert.deepEqual(queries, ['(prefers-color-scheme: dark)']);
    assert.equal(theme.current, 'dark');
    theme.choose('light');
    assert.equal(globalThis.localStorage.store['neuroatlas.theme'], 'light');
  } finally {
    delete globalThis.matchMedia;
    delete globalThis.localStorage;
  }
});

test('the masthead surface is carried into the browser theme colour, also on an OS switch', () => {
  const meta = { content: '#000000', setAttribute(name, value) { this[name] = value; }, getAttribute(name) { return this[name]; } };
  const surfaces = { light: '#ffffff', dark: '#1d1d1f' };
  globalThis.document = {
    documentElement: { dataset: {} },
    querySelector: selector => (selector === 'meta[name="theme-color"]' ? meta : null),
  };
  globalThis.getComputedStyle = () => ({
    getPropertyValue: name => (name === '--surface-base' ? surfaces[document.documentElement.dataset.theme] : ''),
  });
  try {
    const system = fakeSystem(false);
    const theme = createTheme(() => {}, { storage: fakeStorage(), system });
    assert.equal(meta.content, '#ffffff');
    system.flip(true);
    assert.equal(meta.content, '#1d1d1f');
    theme.choose('light');
    assert.equal(meta.content, '#ffffff');
  } finally {
    delete globalThis.getComputedStyle;
  }
});
