import { describe, expect, it } from 'vitest';
import { declarationsBySelector, parseCss, walk } from './css-scan.ts';
import { sheets } from './sources.ts';

const tokens = declarationsBySelector(sheets['tokens.css']);
const light = tokens[':root']!;
const dark = tokens[":root[data-theme='dark']"]!;

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

  it('gives the light theme its published inks, grounds and borders', () => {
    expect(light).toMatchObject({
      '--text-primary': '#232a30',
      '--text-secondary': '#555f68',
      '--text-tertiary': '#606a72',
      '--accent': '#28615d',
      '--danger': '#a61b1b',
      '--primary-ink': '#ffffff',
      '--surface-base': '#ffffff',
      '--surface-sunken': '#f0f2f3',
      '--surface-canvas': '#f3f4f5',
      '--surface-raised': '#ffffff',
      '--border-subtle': '#e0e5e7',
      '--border-control': '#77828c',
    });
  });

  it('gives the dark theme its published inks, grounds and borders', () => {
    expect(dark).toMatchObject({
      '--text-primary': '#e9ebee',
      '--text-secondary': '#b6bcc3',
      '--text-tertiary': '#9ca3ab',
      '--accent': '#7fd0cc',
      '--danger': '#f1928f',
      '--surface-base': '#1b1e21',
      '--surface-sunken': '#141517',
      '--surface-canvas': '#111214',
      '--surface-raised': '#343a40',
      '--border-subtle': '#303338',
      '--border-control': '#7d848c',
    });
  });

  it('keeps the overlay palette once, with the control border at 3:1 on every plate', () => {
    expect(light).toMatchObject({
      '--overlay-ink': '#f1f2f4',
      '--overlay-plate': '#16171a',
      '--overlay-control-border': '#70777f',
    });
    expect(dark['--overlay-control-border']).toBeUndefined();
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
