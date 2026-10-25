import { describe, expect, it } from 'vitest';
import { parseCss, styleBlocks, styleViolations, walk } from './css-scan.ts';
import { components, fontsource, main, sheets } from './sources.ts';

const LAYERS = ['tokens', 'base', 'elements', 'components', 'features', 'a11y'];
const LAYER_STATEMENT = `@layer ${LAYERS.join(', ')}`;
const COMPONENT_LAYERS = ['@layer components', '@layer features', '@layer a11y'];
// At-rules that are not styled rules and so need no layer.
const UNLAYERED_AT_RULES = /^@(keyframes|property|font-face)\b/;

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
  });

  it('main.ts imports index.css before any component, so the layer statement leads the bundle', () => {
    const imports = [...main.matchAll(/^import .*?['"]([^'"]+)['"];/gm)].map(([, path]) => path);
    expect(imports.indexOf('./styles/index.css')).toBeGreaterThanOrEqual(0);
    const firstComponent = imports.findIndex((path) => path.endsWith('.svelte'));
    expect(imports.indexOf('./styles/index.css')).toBeLessThan(firstComponent);
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
  it('forced-colour and contrast rules sit directly in the top-level @layer a11y, hover styles answer one query, and no layer is nested', () => {
    for (const { path, nodes } of styles) {
      expect(styleViolations(nodes), path).toEqual([]);
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

  const violations = (css: string) => styleViolations(parseCss(css));

  it('accepts a11y rules written directly in the top-level a11y layer, in either media order', () => {
    expect(
      violations('@layer a11y { @media (forced-colors: active) { b { color: red } } }'),
    ).toEqual([]);
    expect(
      violations('@layer a11y { @media (prefers-contrast: more) { b { color: red } } }'),
    ).toEqual([]);
  });

  it('rejects a11y sublayers nested in a component layer and media blocks outside a11y', () => {
    expect(
      violations(
        '@layer components { @media (forced-colors: active) { @layer a11y { button { color: red } } } }',
      ),
    ).toEqual(['outside @layer a11y: @media (forced-colors: active)', 'nested layer: @layer a11y']);
    expect(
      violations(
        '@layer components { @layer a11y { @media (prefers-contrast: more) { b { x: y } } } }',
      ),
    ).toEqual([
      'nested layer: @layer a11y',
      'outside @layer a11y: @media (prefers-contrast: more)',
    ]);
    expect(violations('@media (forced-colors: active) { b { color: red } }')).toEqual([
      'outside @layer a11y: @media (forced-colors: active)',
    ]);
    expect(violations('@layer a11y { @media (forced-colors: active) { b { x: y } } }')).toEqual([]);
  });

  it('accepts the hover query and its negated form and rejects the invalid grammar', () => {
    const hover = '(hover: hover) and (pointer: fine)';
    expect(violations(`@layer components { @media ${hover} { a:hover { x: y } } }`)).toEqual([]);
    expect(violations(`@layer components { @media not (${hover}) { a { x: y } } }`)).toEqual([]);
    expect(violations(`@layer components { @media not ${hover} { a { x: y } } }`)).toEqual([
      `hover query: @media not ${hover}`,
    ]);
    expect(violations('@layer components { @media (hover: hover) { a { x: y } } }')).toEqual([
      'hover query: @media (hover: hover)',
    ]);
    expect(violations('@layer components { a:hover { x: y } }')).toEqual([
      ':hover outside the hover query: a:hover',
    ]);
  });
});
