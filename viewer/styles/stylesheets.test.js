import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const directory = new URL('./', import.meta.url);
const names = (await readdir(directory)).filter(name => name.endsWith('.css'));
const sheets = Object.fromEntries(await Promise.all(names.map(async name => [name, await readFile(new URL(name, directory), 'utf8')])));
const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');

test('every stylesheet is imported, and the accessibility layer comes last', () => {
  const imported = [...main.matchAll(/import '\.\/styles\/([\w-]+\.css)';/g)].map(([, name]) => name);
  assert.deepEqual([...imported].sort(), [...names].sort());
  assert.equal(imported.at(-1), 'a11y.css');
});

test('forced-colour and increased-contrast rules live only in the last layer, where no component rule can undo them', () => {
  for (const [name, css] of Object.entries(sheets)) {
    if (name === 'a11y.css') continue;
    assert.doesNotMatch(css, /forced-colors|prefers-contrast/, name);
  }
});

test('hover styles answer one query: a pointer that hovers and is fine', () => {
  for (const [name, css] of Object.entries(sheets)) {
    for (const [query] of css.matchAll(/@media[^{]*\bhover\b[^{]*/g)) {
      assert.match(query.trim(), /^@media (not )?\(?\(hover: hover\) and \(pointer: fine\)\)?$/, `${name}: ${query}`);
    }
  }
});

test('type sizes and line heights come from the scale', () => {
  for (const [name, css] of Object.entries(sheets)) {
    assert.doesNotMatch(css, /--text-(small|micro|body)\b/, name);
    for (const [, value] of css.matchAll(/line-height:\s*([^;}]+)/g)) {
      assert.match(value.trim(), /^(var\(--lh-(caption|ui|prose|title)\)|inherit|\d+px)$/, `${name}: line-height ${value}`);
    }
  }
});

test('every token a stylesheet reads without a fallback is declared somewhere', () => {
  const declared = new Set(Object.values(sheets).flatMap(css => [...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, token]) => token)));
  for (const [name, css] of Object.entries(sheets)) {
    for (const [, token] of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(declared.has(token), `${name}: ${token}`);
  }
});
