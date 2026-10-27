import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Node types belong to the test programs (tsconfig.test.json) and the DOM lib to the
// tsconfigs; a triple-slash directive would put either back into the app program.
it('no source file carries a triple-slash reference directive', () => {
  const offenders = readdirSync(new URL('../src/', import.meta.url), { recursive: true })
    .map((path) => new URL(`../src/${String(path)}`, import.meta.url))
    .filter((url) => /\.(ts|svelte)$/.test(url.pathname))
    .filter((url) => /^\/\/\/ *<reference (types|lib)=/m.test(readFileSync(url, 'utf8')));
  expect(offenders.map((url) => url.pathname)).toEqual([]);
});
