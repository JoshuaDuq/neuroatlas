// Ported from viewer/ui/chrome/snapshot.test.js: the caption, how it packs and shortens, and the bottom line.
import { expect, test } from 'vitest';
import { SURFACE_COLORS, VIEW_NAMES } from '../../lib/types/constants.ts';
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

test('SNAP-01: a missing atlas and detail leave only the subject and colouring, and an empty subject has no line', () => {
  expect(
    words(
      snapshotCaption('en', {
        subject: 'S',
        atlas: null,
        surfaceColor: 'tissue',
        detail: null,
        view: null,
      }),
    ),
  ).toEqual(['S', 'Tissue']);
  const lines = snapshotCaption('en', {
    subject: '',
    atlas: 'destrieux',
    surfaceColor: 'atlas',
    detail: 'nextbrain',
    view: 'left',
  });
  expect(lines).toHaveLength(2);
  expect(words(lines)[0]).toMatch(/^Destrieux · Regions · /);
  expect(words(lines)[1]).toBe('Left view');
});

test('SNAP-03: an axial section at +4 reads its plane and signed position', () => {
  const [, , section] = snapshotCaption('en', {
    subject: 'S',
    atlas: 'destrieux',
    surfaceColor: 'atlas',
    section: { plane: 'axial', offset: 4, tilt: 0, azimuth: 0 },
  });
  expect(section!.map((runs) => runs.map((run) => run.text).join(''))).toEqual([
    'Axial section',
    '+4.0 mm',
  ]);
});

test('SNAP-04: the reference with a held view names both, in bold, and no subject or labels', () => {
  const lines = snapshotCaption('en', { reference: 'HCP tract reference', view: 'left' });
  expect(words(lines)).toEqual(['HCP tract reference', 'Left view']);
  expect(lines[0]![0]![0]!.strong).toBe(true);
});

const FACTS = { subject: 'CDMD sub_013', atlas: 'hcp-mmp', detail: 'learning' } as const;

test('SNAP-05: every colouring has its words in English and French', () => {
  const table = {
    en: {
      tissue: 'Tissue',
      mri: 'T1 MRI',
      atlas: 'Regions',
      network: 'Yeo 7 networks',
      'cab-np': 'CAB-NP networks',
      functional: 'Functional divisions',
    },
    fr: {
      tissue: 'Tissu',
      mri: 'IRM T1',
      atlas: 'Régions',
      network: 'Réseaux Yeo 7',
      'cab-np': 'Réseaux CAB-NP',
      functional: 'Divisions fonctionnelles',
    },
  } as const;
  const teaching = { en: 'Teaching set', fr: 'Ensemble pédagogique' };
  for (const lang of ['en', 'fr'] as const) {
    for (const surfaceColor of SURFACE_COLORS) {
      expect(
        words(snapshotCaption(lang, { ...FACTS, surfaceColor })),
        `${lang} ${surfaceColor}`,
      ).toEqual(['CDMD sub_013', `HCP-MMP · ${table[lang][surfaceColor]} · ${teaching[lang]}`]);
    }
  }
});

test('SNAP-05: every named view has its words in English and French', () => {
  const table = {
    en: {
      oblique: 'Oblique view',
      left: 'Left view',
      right: 'Right view',
      anterior: 'Anterior view',
      posterior: 'Posterior view',
      superior: 'Superior view',
      inferior: 'Inferior view',
    },
    fr: {
      oblique: 'Vue oblique',
      left: 'Vue gauche',
      right: 'Vue droite',
      anterior: 'Vue antérieure',
      posterior: 'Vue postérieure',
      superior: 'Vue supérieure',
      inferior: 'Vue inférieure',
    },
  } as const;
  for (const lang of ['en', 'fr'] as const) {
    for (const view of VIEW_NAMES) {
      expect(words(snapshotCaption(lang, { subject: 'X', view }))[1], `${lang} ${view}`).toBe(
        table[lang][view],
      );
    }
  }
});

test('SNAP-05: every plane has its words and signed position in English and French', () => {
  const planes = [
    ['sagittal', 12.34, 'Sagittal section · +12.3 mm', 'Coupe sagittale · +12,3 mm'],
    ['coronal', -0.04, 'Coronal section · 0.0 mm', 'Coupe coronale · 0,0 mm'],
    ['axial', 5, 'Axial section · +5.0 mm', 'Coupe axiale · +5,0 mm'],
    [
      'oblique',
      -7.5,
      'Oblique section · −7.5 mm · Tilt 30° · Azimuth −45°',
      'Coupe oblique · −7,5 mm · Inclinaison 30° · Azimut −45°',
    ],
  ] as const;
  for (const [plane, offset, en, fr] of planes) {
    const section = { plane, offset, tilt: 30, azimuth: -45 };
    expect(words(snapshotCaption('en', { subject: 'X', section }))[1]).toBe(en);
    expect(words(snapshotCaption('fr', { subject: 'X', section }))[1]).toBe(fr);
  }
});

/** A fixed-seed generator, so the sweeps below repeat. */
function seeded(seed: number) {
  let state = seed;
  return (max: number) => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32) * max;
}

test('SNAP-06: packed lines keep the facts in order and exceed the room only with one fact', () => {
  const random = seeded(20261026);
  for (let i = 0; i < 300; i++) {
    const widths = Array.from(
      { length: 1 + Math.floor(random(6)) },
      () => Math.round(random(30)) * 10,
    );
    const separator = Math.round(random(3)) * 10;
    const room = Math.round(random(60)) * 10;
    const lines = packFacts(widths, separator, room);
    expect(lines.flat()).toEqual(widths.map((_, index) => index));
    for (const line of lines) {
      const used =
        line.reduce((sum, index) => sum + widths[index]!, 0) + separator * (line.length - 1);
      if (line.length > 1) expect(used).toBeLessThanOrEqual(room);
    }
  }
});

test('SNAP-07: a shortened run is a trimmed prefix plus an ellipsis that fits, or the ellipsis alone', () => {
  const measure = (text: string) =>
    [...text].reduce((sum, c) => sum + 5 + (c.charCodeAt(0) % 7), 0);
  const full = 'Destrieux · Tissue · Teaching set · Coupe coronale';
  const random = seeded(20261026);
  for (let i = 0; i < 300; i++) {
    const text = full.slice(0, random(full.length + 1));
    const width = random(300);
    const result = ellipsize(text, width, measure);
    if (result === text) {
      expect(measure(text)).toBeLessThanOrEqual(width);
    } else if (result === '…') {
      expect(text.length).toBeGreaterThan(0);
    } else {
      expect(result.endsWith('…')).toBe(true);
      const prefix = result.slice(0, -1);
      expect(text.startsWith(prefix)).toBe(true);
      expect(prefix).toBe(prefix.trimEnd());
      expect(measure(result)).toBeLessThanOrEqual(width);
    }
  }
});

test('SNAP-09: the statement and scale never overlap, and the scale shares the line exactly when it fits', () => {
  const random = seeded(20261026);
  for (let i = 0; i < 300; i++) {
    const size = {
      width: 200 + random(1400),
      height: 200 + random(800),
      statementWidth: random(300),
      scaleWidth: random(200),
    };
    const { statement, scale } = bottomLine(size);
    const shared = scale.y === statement.y;
    const fits = size.statementWidth + 16 + size.scaleWidth <= size.width - 32;
    expect(shared, JSON.stringify(size)).toBe(fits);
    if (shared) expect(statement.x + size.statementWidth).toBeLessThan(scale.x);
    else expect(scale.y).toBeLessThan(statement.y);
  }
});

test('SNAP-06: a fact that fills the room exactly stays on the line', () => {
  expect(packFacts([90, 70], 30, 190)).toEqual([[0, 1]]);
  expect(packFacts([90, 70], 30, 189)).toEqual([[0], [1]]);
});
