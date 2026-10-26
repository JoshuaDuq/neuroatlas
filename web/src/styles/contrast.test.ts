import { describe, expect, it } from 'vitest';
import { declarationsBySelector } from './css-scan.ts';
import { sheets, stageVars } from './sources.ts';

// WCAG 2.2 1.4.3 (text, 4.5:1) and 1.4.11 (non-text, 3:1), computed from the declared tokens.

const declared = declarationsBySelector(sheets['tokens.css']);
// A lookup that finds nothing spreads to nothing and would silently test the dark theme with the light tokens.
const darkOverrides = declared[":root[data-theme='dark']"];
if (!darkOverrides) throw new Error("tokens.css declares no :root[data-theme='dark'] rule.");
const themes = {
  light: declared[':root'],
  dark: { ...declared[':root'], ...darkOverrides },
};

const stageTokens = declarationsBySelector(stageVars)['.stage-dock, .stage-keys, .stage'];
if (!stageTokens)
  throw new Error('stage-vars.css declares no .stage-dock, .stage-keys, .stage rule.');

function resolve(theme: Record<string, string>, name: string): string {
  const value = theme[name];
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? resolve(theme, reference[1]) : value;
}

function luminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(theme: Record<string, string>, foreground: string, background: string): number {
  const [a, b] = [foreground, background].map((name) => luminance(resolve(theme, name)));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const PANEL_GROUNDS = [
  '--surface-base',
  '--surface-navigation',
  '--surface-sunken',
  '--surface-canvas',
  '--surface-hover',
  '--surface-raised',
  '--surface-tonal',
  '--surface-tonal-hover',
];
const OVERLAY_GROUNDS = [
  '--overlay-plate',
  '--overlay-plate-hover',
  '--overlay-track',
  '--overlay-track-hover',
];

describe.each(Object.entries(themes))('%s theme', (_name, theme) => {
  it('panel text passes 4.5:1 on every panel ground', () => {
    for (const ink of [
      '--text-primary',
      '--text-secondary',
      '--text-tertiary',
      '--accent',
      '--danger',
    ]) {
      for (const ground of PANEL_GROUNDS) {
        expect(contrast(theme, ink, ground), `${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('control edges pass 3:1 on every panel ground', () => {
    for (const edge of ['--border-control', '--thumb-ring']) {
      for (const ground of PANEL_GROUNDS) {
        expect(contrast(theme, edge, ground), `${edge} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('the primary button text passes 4.5:1 on its fill and hover fill', () => {
    for (const fill of ['--primary-fill', '--primary-fill-hover']) {
      expect(contrast(theme, '--primary-ink', fill), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('stage overlay text passes 4.5:1 and its control border 3:1 on every plate', () => {
    for (const ink of [
      '--overlay-ink',
      '--overlay-ink-muted',
      '--overlay-ink-faint',
      '--overlay-accent',
      '--overlay-danger',
    ]) {
      for (const ground of OVERLAY_GROUNDS) {
        expect(contrast(theme, ink, ground), `${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const ground of OVERLAY_GROUNDS) {
      expect(contrast(theme, '--overlay-control-border', ground), ground).toBeGreaterThanOrEqual(3);
    }
  });

  // The controls on the stage (DisplayPopover, ViewPopover, the dock) read the panel names through stage-vars.css.
  it('the stage thumb ring passes 3:1 on the raised fill, the track and the popover surface', () => {
    const stage = { ...theme, ...stageTokens };
    for (const ground of [
      '--surface-raised',
      '--surface-tonal',
      '--surface-tonal-hover',
      '--surface-navigation',
      '--surface-base',
      '--surface-hover',
    ]) {
      expect(contrast(stage, '--thumb-ring', ground), ground).toBeGreaterThanOrEqual(3);
    }
  });

  it('the scale bar ink passes 4.5:1 on its halo core', () => {
    // axe cannot measure the bar over the canvas; the halo core is the darkest ground its text sits on.
    expect(contrast(theme, '--overlay-ink', '--overlay-halo-core')).toBeGreaterThanOrEqual(4.5);
  });
});
