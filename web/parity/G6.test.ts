/** G6 parity: the snapshot's caption and layout against legacy `viewer/ui/chrome/snapshot.js`. */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  bottomLine as legacyBottomLine,
  ellipsize as legacyEllipsize,
  packFacts as legacyPackFacts,
  snapshotCaption as legacyCaption,
} from '../../viewer/ui/chrome/snapshot.js';
import {
  bottomLine,
  ellipsize,
  packFacts,
  snapshotCaption,
} from '../src/features/snapshot/snapshot.ts';
import type { CaptionFacts } from '../src/features/snapshot/snapshot.ts';
import { SURFACE_COLORS, VIEW_NAMES } from '../src/lib/types/constants.ts';

/** Legacy writes a missing fact as `null` before dropping it; only the drawn runs are compared. */
const drawn = (lines: { text: unknown; strong?: boolean }[][][]) =>
  lines.map((line) => line.map((runs) => runs.map(({ text, strong }) => ({ text, strong }))));

test('the caption matches legacy for every colouring, view, section and the tract reference, in both languages', () => {
  const sections = [
    null,
    { plane: 'sagittal', offset: 12.34, tilt: 0, azimuth: 0 },
    { plane: 'axial', offset: -0.04, tilt: 0, azimuth: 0 },
    { plane: 'oblique', offset: -7.5, tilt: 30, azimuth: -45 },
  ] as const;
  const cases: CaptionFacts[] = [];
  for (const surfaceColor of SURFACE_COLORS) {
    for (const view of [...VIEW_NAMES, null]) {
      for (const section of sections) {
        cases.push({
          subject: 'CDMD sub_013',
          atlas: 'hcp-mmp',
          surfaceColor,
          detail: 'learning',
          view,
          section,
        });
      }
    }
  }
  cases.push(
    { subject: 'S', atlas: null, surfaceColor: 'tissue', detail: null, view: null },
    { subject: '', atlas: 'destrieux', surfaceColor: 'atlas', detail: 'nextbrain', view: 'left' },
    { reference: 'HCP tract reference', view: 'left', section: null },
  );
  for (const lang of ['en', 'fr'] as const) {
    for (const facts of cases) {
      assert.deepEqual(
        drawn(snapshotCaption(lang, facts)),
        drawn(legacyCaption(lang, facts as Parameters<typeof legacyCaption>[1])),
        `${lang} ${JSON.stringify(facts)}`,
      );
    }
  }
});

test('packing, shortening and the bottom line match legacy over a seeded sweep', () => {
  let seed = 20261026;
  const random = (max: number) => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * max;
  const measure = (text: string) =>
    [...text].reduce((sum, c) => sum + 5 + (c.charCodeAt(0) % 7), 0);
  for (let i = 0; i < 1000; i++) {
    // Whole pixels half the time, so a line that fits exactly comes up.
    const pixels = (max: number) => (i % 2 ? random(max) : Math.round(random(max / 10)) * 10);
    const widths = Array.from({ length: 1 + Math.floor(random(6)) }, () => pixels(300));
    const separator = pixels(30);
    const room = pixels(600);
    assert.deepEqual(packFacts(widths, separator, room), legacyPackFacts(widths, separator, room));
    const text = 'Destrieux · Tissue · Teaching set · Coupe coronale'.slice(0, random(52));
    assert.equal(ellipsize(text, room / 2, measure), legacyEllipsize(text, room / 2, measure));
    const size = {
      width: random(1600),
      height: random(1000),
      statementWidth: random(300),
      scaleWidth: random(200),
    };
    assert.deepEqual(bottomLine(size), legacyBottomLine(size));
  }
});
