import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * UI modules cache their elements in factory scope and mutate them inside
 * update(). A local declared with the same name shadows the element, and the
 * next property write lands on the local instead — silently, and only at
 * runtime.
 *
 * This has happened twice: `count` in the header and navigator, and `source`
 * in the inspector, where the throw left the region name updated but Focus
 * and Isolate still disabled. There are no DOM tests to catch it, so the
 * source is checked directly.
 */
test('no local shadows an element binding in any UI module', async () => {
  const directory = new URL('./', import.meta.url);
  const files = (await readdir(directory)).filter(
    file => file.endsWith('.js') && !file.endsWith('.test.js'));

  const offences = [];
  for (const file of files) {
    const source = await readFile(new URL(file, directory), 'utf8');
    const bound = [...source.matchAll(/\bconst\s+(\w+)\s*=\s*document\.(?:getElementById|querySelector)\b/g)]
      .map(match => match[1]);

    for (const name of bound) {
      const declarations = [...source.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g'))];
      if (declarations.length > 1) {
        offences.push(`${file}: "${name}" is an element binding and is re-declared `
          + `${declarations.length - 1} more time(s)`);
      }
    }
  }
  assert.deepEqual(offences, []);
});

test('any UI module using t() imports t from translations', async () => {
  const directory = new URL('./', import.meta.url);
  const files = (await readdir(directory)).filter(
    file => file.endsWith('.js') && !file.endsWith('.test.js'));

  const offences = [];
  for (const file of files) {
    const source = await readFile(new URL(file, directory), 'utf8');
    if (/\bt\s*\(/.test(source)) {
      if (!/import\s+{[^}]*\bt\b[^}]*}\s+from\s+['"][^'"]*translations(?:\.js)?['"]/.test(source)) {
        offences.push(`${file} calls t() without importing it from translations`);
      }
    }
  }
  assert.deepEqual(offences, []);
});
