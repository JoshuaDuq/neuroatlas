import { describe, expect, it } from 'vitest';
import { type CssNode, parseCss, styleBlocks, walk } from './css-scan.ts';
import { components, fontsource, main, sheets } from './sources.ts';

const LAYERS = ['tokens', 'base', 'elements', 'components', 'features', 'a11y'];
const LAYER_STATEMENT = `@layer ${LAYERS.join(', ')}`;
const COMPONENT_LAYERS = ['@layer components', '@layer features', '@layer a11y'];
// At-rules that are not styled rules and so need no layer.
const UNLAYERED_AT_RULES = /^@(keyframes|property|font-face)\b/;
const HOVER_QUERY = /^@media (not )?\(hover: hover\) and \(pointer: fine\)$/;

const entries = (modules: Record<string, string>) =>
  Object.entries(modules).map(([path, source]) => ({ path, source }));

const sheetFiles = entries(sheets);
const componentFiles = entries(components);

// Every stylesheet and every component <style> block, parsed.
const styles = [
  ...sheetFiles.map(({ path, source }) => ({ path, css: source, kind: 'sheet' as const })),
  ...componentFiles.flatMap(({ path, source }) =>
    styleBlocks(source).map((css) => ({ path, css, kind: 'component' as const })),
  ),
].map((style) => ({ ...style, nodes: parseCss(style.css) }));

const isA11yLayer = (node: CssNode, ancestors: string[]) =>
  ancestors.includes('@layer a11y') ||
  (node.children.length > 0 && node.children.every((child) => child.prelude === '@layer a11y'));

describe('cascade layers', () => {
  const index = sheetFiles.find(({ path }) => path === 'index.css')!;
  const indexNodes = parseCss(index.source);

  it('index.css declares the layer order first, with a11y last', () => {
    expect(indexNodes[0].prelude).toBe(LAYER_STATEMENT);
    expect(LAYERS.at(-1)).toBe('a11y');
  });

  it('index.css imports every other stylesheet, the font first, and main.ts imports index.css', () => {
    const imported = indexNodes
      .filter(({ prelude }) => prelude.startsWith('@import'))
      .map(({ prelude }) => /^@import ['"](?:\.\/)?([^'"]+)['"]$/.exec(prelude)![1]);
    const others = sheetFiles.map(({ path }) => path).filter((path) => path !== 'index.css');
    expect(imported[0]).toBe('@fontsource-variable/source-sans-3/wght.css');
    expect(imported.slice(1).sort()).toEqual(others.sort());
    expect(main).toMatch(/import '\.\/styles\/index\.css';/);
  });

  it('each stylesheet is one layer named after it', () => {
    for (const { path, nodes } of styles.filter(
      ({ kind, path }) => kind === 'sheet' && path !== 'index.css',
    )) {
      const layer = path.replace(/\.css$/, '');
      expect(LAYERS, path).toContain(layer);
      expect(
        nodes.map(({ prelude }) => prelude),
        path,
      ).toEqual(nodes.map(() => `@layer ${layer}`));
    }
  });

  it('every component <style> rule sits in components, features or a11y', () => {
    for (const { path, nodes } of styles.filter(({ kind }) => kind === 'component')) {
      for (const node of nodes) {
        if (UNLAYERED_AT_RULES.test(node.prelude)) continue;
        expect(COMPONENT_LAYERS, `${path}: ${node.prelude}`).toContain(node.prelude);
      }
    }
  });

  it('the vendored font family is the one tokens.css names', () => {
    expect(fontsource).toContain("font-family: 'Source Sans 3 Variable'");
    const tokens = sheetFiles.find(({ path }) => path === 'tokens.css')!.source;
    expect(tokens).toMatch(/--font-ui: ["']Source Sans 3 Variable["'], sans-serif;/);
  });
});

describe('invariants over src/styles and every component <style>', () => {
  it('forced-colour and increased-contrast rules live only in @layer a11y', () => {
    for (const { path, nodes } of styles) {
      for (const { node, ancestors } of walk(nodes)) {
        if (!/^@media.*(forced-colors|prefers-contrast)/.test(node.prelude)) continue;
        expect(isA11yLayer(node, ancestors), `${path}: ${node.prelude}`).toBe(true);
      }
    }
  });

  it('hover styles answer one query: a pointer that hovers and is fine', () => {
    for (const { path, nodes } of styles) {
      for (const { node, ancestors } of walk(nodes)) {
        if (node.prelude.startsWith('@media') && /\bhover\b/.test(node.prelude)) {
          expect(node.prelude, path).toMatch(HOVER_QUERY);
        }
        if (node.hasBlock && !node.prelude.startsWith('@') && node.prelude.includes(':hover')) {
          const inHoverQuery = ancestors.some((prelude) => HOVER_QUERY.test(prelude));
          expect(inHoverQuery, `${path}: ${node.prelude}`).toBe(true);
        }
      }
    }
  });

  it('type sizes and line heights come from the scale', () => {
    for (const { path, css, nodes } of styles) {
      expect(css, path).not.toMatch(/--text-(small|micro|body)\b/);
      for (const { node } of walk(nodes)) {
        for (const declaration of node.declarations) {
          const [, value] = /^line-height\s*:\s*(.+)$/.exec(declaration) ?? [];
          if (value === undefined) continue;
          expect(value.trim(), `${path}: line-height ${value}`).toMatch(
            /^(var\(--lh-(caption|ui|prose|title)\)|inherit|\d+px)$/,
          );
        }
      }
    }
  });

  it('every token read without a fallback is declared somewhere', () => {
    const declared = new Set([
      ...styles.flatMap(({ css }) =>
        [...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, token]) => token),
      ),
      // Custom properties set from markup: style="--x: 1" and style:--x={value}.
      ...componentFiles.flatMap(({ source }) =>
        [...source.matchAll(/(?:style:|["';\s])(--[\w-]+)\s*[:=]/g)].map(([, token]) => token),
      ),
    ]);
    for (const { path, css } of styles) {
      for (const [, token] of css.matchAll(/var\((--[\w-]+)\)/g)) {
        expect(declared.has(token), `${path}: ${token}`).toBe(true);
      }
    }
  });
});

describe('the scanner', () => {
  it('nests blocks, keeps statements and ignores comments', () => {
    const nodes = parseCss(
      '/* c { */ @layer a, b; @layer a { @media (x) { p { color: red; margin: 0 } } }',
    );
    expect(nodes.map(({ prelude }) => prelude)).toEqual(['@layer a, b', '@layer a']);
    const rule = [...walk(nodes)].find(({ node }) => node.prelude === 'p')!;
    expect(rule.ancestors).toEqual(['@layer a', '@media (x)']);
    expect(rule.node.declarations).toEqual(['color: red', 'margin: 0']);
  });
});
