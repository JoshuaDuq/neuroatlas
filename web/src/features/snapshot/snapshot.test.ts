// Ported from viewer/ui/chrome/snapshot.test.js: the caption, how it packs and shortens, and the bottom line.
import { expect, test } from 'vitest';
import { SEPARATOR, bottomLine, ellipsize, packFacts, snapshotCaption } from './snapshot.ts';
import type { CaptionLine } from './snapshot.ts';

const words = (lines: CaptionLine[]) =>
  lines.map((line) => line.map((runs) => runs.map((run) => run.text).join('')).join(SEPARATOR));

test('the caption names the subject, then atlas, colouring and internal anatomy as the masthead does', () => {
  const lines = snapshotCaption('en', {
    subject: 'SNAIL subj_1',
    atlas: 'destrieux',
    surfaceColor: 'tissue',
    detail: 'learning',
    view: 'anterior',
  });
  expect(words(lines)).toEqual([
    'SNAIL subj_1',
    'Destrieux · Tissue · Teaching set',
    'Anterior view',
  ]);
  expect(lines[0]![0]![0]!.strong).toBe(true);
});

test('a cut replaces the view with the section and its signed position, kept with its unit', () => {
  const lines = snapshotCaption('fr', {
    subject: 'SNAIL subj_1',
    atlas: 'hcp-mmp',
    surfaceColor: 'network',
    detail: null,
    view: 'oblique',
    section: { plane: 'coronal', offset: -12.34, tilt: 30, azimuth: 30 },
  });
  expect(lines).toHaveLength(3);
  expect(words(lines)[2]).toBe('Coupe coronale · −12,3\u202fmm');
  // One numeric voice: the caption's figures are set in the UI face, as on screen.
  expect(lines.flat(2).some((run) => 'mono' in run)).toBe(false);
});

test('an oblique section carries its tilt and azimuth', () => {
  const [, , section] = snapshotCaption('en', {
    subject: 'S',
    atlas: 'destrieux',
    surfaceColor: 'atlas',
    section: { plane: 'oblique', offset: 0, tilt: 30, azimuth: -45 },
  });
  expect(words([section!])[0]).toBe('Oblique section · 0.0\u202fmm · Tilt 30° · Azimuth −45°');
});

test('the tract reference is named alone, and a camera off every preset names no view', () => {
  const lines = snapshotCaption('en', { reference: 'HCP tract reference', view: null });
  expect(words(lines)).toEqual(['HCP tract reference']);
});

test('the French view agrees with « vue »', () => {
  const [, , view] = snapshotCaption('fr', {
    subject: 'S',
    atlas: 'destrieux',
    surfaceColor: 'mri',
    view: 'posterior',
  });
  expect(words([view!])[0]).toBe('Vue postérieure');
});

test('a narrow image breaks a caption line between its facts, never inside one', () => {
  // Destrieux · Regions · Teaching set at 10px a character, a 3-character separator.
  expect(packFacts([90, 70, 120], 30, 400)).toEqual([[0, 1, 2]]);
  expect(packFacts([90, 70, 120], 30, 200)).toEqual([[0, 1], [2]]);
  expect(packFacts([90, 70, 120], 30, 100)).toEqual([[0], [1], [2]]);
  // A fact wider than the room still gets a line of its own, to be shortened there.
  expect(packFacts([300, 70], 30, 100)).toEqual([[0], [1]]);
});

test('a line too long for its room keeps its start and ends in an ellipsis', () => {
  const measure = (text: string) => text.length * 10;
  expect(ellipsize('Destrieux', 200, measure)).toBe('Destrieux');
  expect(ellipsize('Destrieux · Tissue', 100, measure)).toBe('Destrieux…');
  expect(measure(ellipsize('Destrieux · Tissue', 100, measure))).toBeLessThanOrEqual(100);
  expect(ellipsize('Destrieux', 5, measure)).toBe('…');
});

test('statement and scale bar share the bottom line until they would meet', () => {
  const wide = bottomLine({ width: 1120, height: 824, statementWidth: 190, scaleWidth: 110 });
  expect(wide.statement).toEqual({ x: 16, y: 800 });
  expect(wide.scale).toEqual({ x: 994, y: 800 });
  const narrow = bottomLine({ width: 300, height: 600, statementWidth: 190, scaleWidth: 110 });
  expect(narrow.scale.y).toBe(576 - 16 - 8);
  expect(narrow.scale.x + 110).toBe(300 - 16);
});
