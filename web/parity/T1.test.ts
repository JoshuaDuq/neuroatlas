import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import {
  lengthSummary as legacyLengthSummary,
  saveLengths as legacySaveLengths,
  settingsReadout as legacySettingsReadout,
  tractRowName as legacyTractRowName,
  tractRows as legacyTractRows,
} from '../../viewer/diffusion/controls.js';
import { DIFFUSION_TEXT } from '../../viewer/diffusion/translations.js';
import { TRACT_CATALOGS } from '../src/lib/core/diffusion/catalogs.ts';
import {
  LENGTHS_CSV_FILENAME,
  LENGTHS_CSV_TYPE,
  buildLengthsCsv,
  lengthSummary,
  settingsReadout,
  tractRowName,
  tractRows,
} from '../src/lib/core/tracts.ts';
import { t } from '../src/lib/core/i18n/index.ts';
import type { TractBundle } from '../src/lib/engine/api.ts';

const [catalog] = TRACT_CATALOGS;
const LANGS = ['en', 'fr'] as const;

const loaded = (id: string, name: string, over: Partial<TractBundle> = {}): TractBundle => ({
  id,
  catalogId: id,
  name,
  label: { en: name },
  file: `${id}.trk`,
  visible: true,
  total: 1234,
  shown: 1000,
  mean: 142.25,
  min: 75,
  max: 239.46,
  ...over,
});

describe('tract rows and summaries against viewer/diffusion/controls.js', () => {
  it('groups the 30 catalog bundles into the same rows, members and names', () => {
    const legacy = legacyTractRows(catalog!.bundles);
    const next = tractRows(catalog!.bundles);
    assert.deepEqual(
      next.map((row) => ({ ...row, members: row.members.map((m) => [m.bundle.id, m.part]) })),
      legacy.map((row: { members: { bundle: { id: string }; part: string }[] }) => ({
        ...row,
        members: row.members.map((m) => [m.bundle.id, m.part]),
      })),
    );
    for (const [index, row] of next.entries()) {
      for (const lang of LANGS) {
        assert.equal(tractRowName(row, lang), legacyTractRowName(legacy[index], lang));
      }
    }
  });

  it('writes lengths and the settings readout the same way in both languages', () => {
    for (const lang of LANGS) {
      for (const metrics of [
        { mean: 142.25, min: 75, max: 239.46 },
        { mean: 0.05, min: 0, max: 1000 },
      ]) {
        assert.equal(
          lengthSummary(metrics, t(lang, 'diffusion'), lang),
          legacyLengthSummary(metrics, DIFFUSION_TEXT[lang], lang),
        );
      }
      for (const [opacity, minimum] of [
        [0.16, 1],
        [1, 40],
        [0, 250],
      ] as const) {
        assert.equal(
          settingsReadout(opacity, minimum, lang),
          legacySettingsReadout(opacity, minimum, lang),
        );
      }
    }
  });
});

describe('the lengths CSV against saveLengths', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** What legacy `saveLengths` would download: its Blob's text and type, and the file name. */
  async function legacyDownload(bundles: TractBundle[], minimum: number) {
    let blob: Blob | undefined;
    let filename = '';
    const link = {
      download: '',
      click() {
        filename = link.download;
      },
    };
    vi.stubGlobal('document', { createElement: () => link });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      blob = value as Blob;
      return 'blob:legacy';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    legacySaveLengths(bundles, minimum);
    vi.useRealTimers();
    return { text: await blob!.text(), type: blob!.type, filename };
  }

  it('is byte-identical for the catalog, quoting, formula guards, hidden and empty bundles', async () => {
    const bundles = [
      ...catalog!.bundles.map((bundle) => loaded(bundle.id, bundle.name.en)),
      loaded('q', 'He said "hi", left'),
      loaded('a', '=SUM(A1)'),
      loaded('b', '+x'),
      loaded('c', '-x'),
      loaded('d', '@x'),
      loaded('h', 'Hidden · left', { visible: false }),
      loaded('e', 'Empty · left', { shown: 0, mean: null, min: null, max: null }),
    ];
    for (const minimum of [1, 40, 250]) {
      const legacy = await legacyDownload(bundles, minimum);
      assert.equal(buildLengthsCsv(bundles, minimum), legacy.text);
      assert.equal(legacy.type, LENGTHS_CSV_TYPE);
      assert.equal(legacy.filename, LENGTHS_CSV_FILENAME);
    }
  });
});
