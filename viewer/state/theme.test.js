import assert from 'node:assert/strict';
import test from 'node:test';
import { createTheme } from './theme.js';

test('createTheme defaults to dark layout when no preference is stored', () => {
  globalThis.document = {
    documentElement: {
      dataset: {},
    },
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
  };

  let notified = null;
  const theme = createTheme(t => { notified = t; });

  assert.equal(theme.current, 'dark');
  assert.equal(notified, 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark');
});

test('createTheme toggles between dark and light', () => {
  const store = {};
  globalThis.document = {
    documentElement: {
      dataset: {},
    },
  };
  globalThis.localStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
  };

  let notified = null;
  const theme = createTheme(t => { notified = t; });
  assert.equal(theme.current, 'dark');

  theme.toggle();
  assert.equal(theme.current, 'light');
  assert.equal(notified, 'light');
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(store['neuroatlas.theme'], 'light');

  theme.toggle();
  assert.equal(theme.current, 'dark');
  assert.equal(notified, 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(store['neuroatlas.theme'], 'dark');
});

test('createTheme honors explicitly stored light preference', () => {
  globalThis.document = {
    documentElement: {
      dataset: {},
    },
  };
  globalThis.localStorage = {
    getItem: () => 'light',
    setItem: () => {},
  };

  let notified = null;
  const theme = createTheme(t => { notified = t; });
  assert.equal(theme.current, 'light');
  assert.equal(notified, 'light');
  assert.equal(document.documentElement.dataset.theme, 'light');
});
