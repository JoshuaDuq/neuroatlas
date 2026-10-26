import { describe, expect, it } from 'vitest';
import { declarationsBySelector, parseCss, walk } from './css-scan.ts';
import { sheets } from './sources.ts';

/** The declarations written directly in each theme's rule, the phone and coarse-pointer rules left out. */
function themeRule(selector: string): Record<string, string> {
  const found = [...walk(parseCss(sheets['tokens.css']))].filter(
    ({ node, ancestors }) =>
      node.hasBlock &&
      node.prelude === selector &&
      !ancestors.some((prelude) => prelude.startsWith('@media')),
  );
  expect(found).toHaveLength(1);
  return Object.fromEntries(
    found[0]!.node.declarations.map((declaration) => {
      const colon = declaration.indexOf(':');
      return [
        declaration.slice(0, colon).trim(),
        declaration
          .slice(colon + 1)
          .trim()
          .replace(/\s+/g, ' '),
      ];
    }),
  );
}
const light = themeRule(':root');
const dark = themeRule(":root[data-theme='dark']");

// Taken once from tokens.css (the light set is the legacy palette apart from --overlay-control-border,
// see deviations/u1-overlay-control-contrast.md, and the dark --thumb-ring, u1-thumb-ring-contrast.md).
const LIGHT = {
  'color-scheme': 'light',
  '--text-primary': '#232a30',
  '--text-secondary': '#555f68',
  '--text-tertiary': '#606a72',
  '--accent': '#28615d',
  '--accent-hover': '#1d4d49',
  '--accent-wash': '#edf3f1',
  '--primary-fill': 'var(--accent)',
  '--primary-fill-hover': 'var(--accent-hover)',
  '--primary-ink': '#ffffff',
  '--danger': '#a61b1b',
  '--surface-base': '#ffffff',
  '--surface-navigation': '#f7f8f9',
  '--surface-sunken': '#f0f2f3',
  '--surface-canvas': '#f3f4f5',
  '--surface-hover': '#f1f4f4',
  '--surface-raised': '#ffffff',
  '--surface-tonal': '#eef1f2',
  '--surface-tonal-hover': '#e4e9eb',
  '--border-subtle': '#e0e5e7',
  '--border-control': '#77828c',
  '--thumb-ring': '#78838d',
  '--scene-background': '#0e1116',
  '--scene-outline-core': '#0b1114',
  '--scene-outline-halo': '#f2f6fa',
  '--scene-outline-hidden': '#46505e',
  '--scene-exposure': '1',
  '--scene-direction-lr': '#ff0000',
  '--scene-direction-ap': '#00ff00',
  '--scene-direction-si': '#0000ff',
  '--overlay-ink': '#f1f2f4',
  '--overlay-ink-muted': '#aeb3ba',
  '--overlay-ink-faint': '#90969e',
  '--overlay-halo': 'rgb(6 7 9 / 0.85)',
  '--overlay-halo-core': '#060709',
  '--overlay-danger': '#f1928f',
  '--overlay-plate': '#16171a',
  '--overlay-plate-hover': '#24262a',
  '--overlay-track': '#222428',
  '--overlay-track-hover': '#2b2e33',
  '--overlay-raised': '#3a3d42',
  '--overlay-border': '#3d4046',
  '--overlay-control-border': '#70777f',
  '--overlay-accent': '#7fd0cc',
  '--overlay-accent-hover': '#a3e0dc',
  '--overlay-accent-wash': '#1f3637',
  '--overlay-primary-fill': '#2a7678',
  '--overlay-primary-fill-hover': '#24686a',
  '--scrim': 'color-mix(in srgb, var(--overlay-halo-core) 50%, transparent)',
  '--scrim-imaging': 'color-mix(in srgb, var(--overlay-halo-core) 72%, transparent)',
  '--mpr-canvas': '#000000',
  '--font-ui': "'Source Sans 3 Variable', sans-serif",
  '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  '--text-caption': '0.8125rem',
  '--text-ui': '0.875rem',
  '--text-title': '1rem',
  '--text-brand': '1.1875rem',
  '--text-headline': '1.5rem',
  '--text-stage': '0.875rem',
  '--lh-caption': 'max(18px, 1.125rem)',
  '--lh-ui': 'max(20px, 1.25rem)',
  '--lh-prose': 'max(22px, 1.375rem)',
  '--lh-title': 'max(28px, 1.75rem)',
  '--shadow-popover': '0 6px 16px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.08)',
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '20px',
  '--space-6': '24px',
  '--space-8': '32px',
  '--row-height': '32px',
  '--control-height': '32px',
  '--tab-height': 'max(44px, 2.75rem)',
  '--rail-width': '360px',
  '--header-height': 'max(48px, 3rem)',
  '--footer-height': 'max(32px, 2rem)',
  '--panel-inset': 'var(--space-6)',
  '--stage-gutter': 'var(--space-5)',
  '--indent': 'calc(var(--panel-inset) + 20px)',
  '--radius-control': '4px',
  '--radius-panel': '6px',
  '--radius-small': '3px',
  '--radius-mark': '2px',
  '--camera-transition': '240ms',
  '--ui-transition': '140ms',
  '--ease-ui': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-sheet': 'cubic-bezier(0.32, 0.72, 0, 1)',
  '--press-transition': '160ms',
  '--press-scale': '0.97',
  '--popover-transition': '180ms',
  '--popover-exit': '120ms',
  '--dialog-transition': '200ms',
  '--tooltip-transition': '125ms',
};

const DARK = {
  'color-scheme': 'dark',
  '--text-primary': '#e9ebee',
  '--text-secondary': '#b6bcc3',
  '--text-tertiary': '#9ca3ab',
  '--accent': '#7fd0cc',
  '--accent-hover': '#a3e0dc',
  '--accent-wash': '#1f3637',
  '--primary-fill': 'var(--overlay-primary-fill)',
  '--primary-fill-hover': 'var(--overlay-primary-fill-hover)',
  '--danger': '#f1928f',
  '--surface-base': '#1b1e21',
  '--surface-navigation': '#191c1f',
  '--surface-sunken': '#141517',
  '--surface-canvas': '#111214',
  '--surface-hover': '#25272b',
  '--surface-raised': '#343a40',
  '--surface-tonal': '#272d32',
  '--surface-tonal-hover': '#303338',
  '--border-subtle': '#303338',
  '--border-control': '#7d848c',
  '--thumb-ring': '#7d848c',
  '--shadow-popover': '0 6px 16px rgb(0 0 0 / 0.4), 0 1px 2px rgb(0 0 0 / 0.3)',
};

describe('UI-06: both themes declare the published palette', () => {
  it('has one light set on :root and one dark override, before the media rules', () => {
    const selectors = [...walk(parseCss(sheets['tokens.css']))]
      .filter(
        ({ node, ancestors }) =>
          node.hasBlock &&
          !node.prelude.startsWith('@') &&
          !ancestors.some((prelude) => prelude.startsWith('@media')),
      )
      .map(({ node }) => node.prelude);
    expect(selectors).toEqual([':root', ":root[data-theme='dark']"]);
  });

  it('declares exactly the published light set on :root', () => {
    expect(light).toEqual(LIGHT);
  });

  it('declares exactly the published dark overrides', () => {
    expect(dark).toEqual(DARK);
  });
});

describe('UI-08: increased contrast strengthens the faint tokens in both themes', () => {
  it('swaps them on :root and the dark theme alike', () => {
    const contrastRule = declarationsBySelector(sheets['a11y.css'])[
      ":root, :root[data-theme='dark']"
    ];
    expect(contrastRule).toEqual({
      '--text-tertiary': 'var(--text-secondary)',
      '--border-control': 'var(--text-primary)',
      '--border-subtle': 'var(--border-control)',
      '--thumb-ring': 'var(--text-primary)',
      '--overlay-ink-muted': 'var(--overlay-ink)',
      '--overlay-halo': 'rgb(6 9 13 / 0.95)',
      '--overlay-plate': '#0c0d0f',
      '--overlay-plate-hover': '#1e2024',
      '--overlay-border': 'var(--overlay-ink)',
      '--overlay-ink-faint': 'var(--overlay-ink)',
      '--overlay-control-border': 'var(--overlay-ink)',
    });
  });
});
