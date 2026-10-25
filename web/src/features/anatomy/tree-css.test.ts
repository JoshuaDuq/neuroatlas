// tree.css is a plain stylesheet, which the component <style> scan in styles/stylesheets.test.ts does
// not reach: it gets the same invariants here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCss, styleViolations, walk } from '../../styles/css-scan.ts';

const source = readFileSync(new URL('./tree.css', import.meta.url), 'utf8');
const nodes = parseCss(source);

describe('tree.css', () => {
  it('is two top-level layers, features then a11y', () => {
    expect(nodes.map(({ prelude }) => prelude)).toEqual(['@layer features', '@layer a11y']);
  });

  it('keeps forced-colour and contrast rules in @layer a11y, hover under one query, no nested layer', () => {
    expect(styleViolations(nodes)).toEqual([]);
  });

  it('takes line heights from the scale', () => {
    for (const { node } of walk(nodes)) {
      for (const declaration of node.declarations) {
        const [, value] = /^line-height\s*:\s*(.+)$/.exec(declaration) ?? [];
        if (value !== undefined) expect(value.trim()).toMatch(/^var\(--lh-(caption|ui)\)$/);
      }
    }
  });

  it('reads only tokens that are declared', () => {
    const declared = new Set([...source.matchAll(/(--[\w-]+)\s*:/g)].map(([, token]) => token));
    const tokens = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');
    for (const [, token] of tokens.matchAll(/(--[\w-]+)\s*:/g)) declared.add(token);
    for (const [, token] of source.matchAll(/var\((--[\w-]+)\)/g)) {
      expect(declared.has(token), token).toBe(true);
    }
  });
});
