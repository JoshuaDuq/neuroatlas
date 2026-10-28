// Which plates the stage shows, how crowded a stage folds them and where they take their band
// (viewport-chrome.js:304-320, 326-387, 403-415).
import { describe, expect, test } from 'vitest';
import type { Legend } from '../../lib/core/state/paint.ts';
import { defaultOpen, keyBand, keyPlates } from './stage-keys.ts';
import type { ColoredNetworks, KeySources, StageRoom } from './stage-keys.ts';

const networks: ColoredNetworks = {
  networks: ['Vis', 'Default'],
  colors: { Vis: [120, 18, 134], Default: [205, 62, 78] },
};
const cabNp: ColoredNetworks = {
  networks: ['Visual1', 'Language'],
  colors: { Visual1: [1, 2, 3], Language: [4, 5, 6] },
};
const legend: Legend = {
  map: 'deficit',
  title: 'Aphasia',
  note: 'A note.',
  rows: [
    { id: 'f1', color: [1, 2, 3], label: 'One', pressed: true },
    { id: 'f2', color: [4, 5, 6], label: 'Two', pressed: false, absent: true },
  ],
};

const sources = (extra: Partial<KeySources> = {}): KeySources => ({
  lang: 'en',
  status: 'ready',
  surfaceColor: 'atlas',
  networks,
  cabNp,
  legend: null,
  directionShown: false,
  ...extra,
});

const names = (plates: ReturnType<typeof keyPlates>) => plates.map((plate) => plate.name);

describe('keyPlates', () => {
  test('a network colour keys its networks under the masthead name of the map', () => {
    const [plate] = keyPlates(sources({ surfaceColor: 'network' }));
    expect(plate).toMatchObject({ name: 'network', map: 'network', title: 'Yeo 7 networks' });
    expect(plate!.rows.map((row) => row.label)).toEqual(['Visual', 'Default mode']);
    expect(plate!.rows[0]!.color).toEqual([120, 18, 134]);
  });

  test('territories key every branch in its hue, in the atlas order, named in the reader’s language', () => {
    const territories = [
      {
        id: 'aca',
        major: 'aca',
        name: 'Anterior cerebral artery',
        name_fr: 'Artère cérébrale antérieure',
        color: [59, 111, 182] as const,
      },
      {
        id: 'basilar',
        major: 'vb',
        name: 'Basilar',
        name_fr: 'Basilaire',
        color: [126, 87, 166] as const,
      },
    ];
    const [plate] = keyPlates(sources({ surfaceColor: 'territory', territories, lang: 'fr' }));
    expect(plate).toMatchObject({
      name: 'network',
      map: 'territory',
      title: 'Territoires artériels',
    });
    expect(plate!.rows.map((row) => [row.id, row.label, row.color])).toEqual([
      ['aca', 'Artère cérébrale antérieure', [59, 111, 182]],
      ['basilar', 'Basilaire', [126, 87, 166]],
    ]);
    expect(keyPlates(sources({ surfaceColor: 'territory' }))).toEqual([]);
  });

  test('CAB-NP names its own networks, and French words them', () => {
    const [plate] = keyPlates(sources({ surfaceColor: 'cab-np', lang: 'fr' }));
    expect(plate).toMatchObject({ name: 'network', map: 'cab-np' });
    expect(plate!.rows.map((row) => row.label)).toEqual(['Visuel primaire', 'Langage']);
  });

  test('a paint covers the colour under it: its plate stands alone and carries the legend', () => {
    const plates = keyPlates(sources({ surfaceColor: 'network', legend }));
    expect(names(plates)).toEqual(['paint']);
    expect(plates[0]).toMatchObject({ map: 'deficit', title: 'Aphasia', note: 'A note.' });
    expect(plates[0]!.rows.map(({ id, pressed, absent }) => [id, pressed, absent])).toEqual([
      ['f1', true, false],
      ['f2', false, true],
    ]);
  });

  test('rows are toggles only for a pickable legend with more than one row', () => {
    const picked = (extra: Partial<Legend>) =>
      keyPlates(sources({ legend: { ...legend, ...extra } }))[0]!.pickable;
    expect(picked({})).toBe(true);
    expect(picked({ pickable: false })).toBe(false);
    expect(picked({ rows: legend.rows.slice(0, 1) })).toBe(false);
  });

  test('direction follows the streamlines, after the others, with its three fixed rows', () => {
    const plates = keyPlates(sources({ surfaceColor: 'network', directionShown: true }));
    expect(names(plates)).toEqual(['network', 'direction']);
    expect(plates[1]!.rows.map((row) => row.label)).toEqual([
      'Left–right',
      'Anterior–posterior',
      'Superior–inferior',
    ]);
  });

  test('no plate while the anatomy is not ready, and none for a colour that has no key', () => {
    for (const status of ['loading', 'error', 'context-lost'] as const) {
      expect(
        keyPlates(sources({ status, surfaceColor: 'network', legend, directionShown: true })),
      ).toEqual([]);
    }
    expect(keyPlates(sources({ status: 'switching', surfaceColor: 'network' }))).toHaveLength(1);
    expect(keyPlates(sources({ surfaceColor: 'atlas' }))).toEqual([]);
    expect(keyPlates(sources({ surfaceColor: 'network', networks: null }))).toEqual([]);
  });
});

describe('defaultOpen', () => {
  const room = (extra: Partial<StageRoom> = {}): StageRoom => ({
    width: 1200,
    height: 800,
    gutter: 20,
    dockHeight: 40,
    ...extra,
  });
  const plate = (count: number, extra = {}) => ({
    name: 'paint' as const,
    map: 'function',
    pickable: false,
    count,
    ...extra,
  });
  const desktop = { phone: false, coarse: false };

  test('a key of eight rows or fewer is open however crowded the stage is', () => {
    expect(defaultOpen(plate(8), desktop, room({ width: 500, height: 200 }))).toBe(true);
  });

  test('a longer key is open on a wide, tall stage and folded on a narrow one', () => {
    expect(defaultOpen(plate(9), desktop, room())).toBe(true);
    expect(defaultOpen(plate(9), desktop, room({ width: 999 }))).toBe(false);
    expect(defaultOpen(plate(9), desktop, room({ width: 1000 }))).toBe(true);
  });

  test('a longer key is folded where its rows would not fit above the dock', () => {
    // 42 + 9 rows of 24 px = 258 px against 300 - 60 - 40 = 200 px.
    expect(defaultOpen(plate(9), desktop, room({ height: 300 }))).toBe(false);
    expect(defaultOpen(plate(9), desktop, room({ height: 358 }))).toBe(true);
  });

  test('before the stage has a size nothing folds', () => {
    expect(defaultOpen(plate(30), { phone: true, coarse: true }, null)).toBe(true);
  });

  test('on a phone any key folds where it would take more than half the room', () => {
    const phone = { phone: true, coarse: false };
    // Two columns: 42 + 2 rows of 24 = 90 px against (500 - 60 - 40) / 2 = 200 px.
    expect(defaultOpen(plate(4), phone, room({ width: 390, height: 500 }))).toBe(true);
    // 42 + 5 rows of 24 = 162 px against (320 - 60 - 40) / 2 = 110 px.
    expect(defaultOpen(plate(10), phone, room({ width: 390, height: 320 }))).toBe(false);
  });

  test('touch toggles are 44 px rows, a deficit runs one column and the direction key never two', () => {
    const phone = { phone: true, coarse: true };
    const wide = room({ width: 390, height: 400 });
    // (400 - 60 - 40) / 2 = 150 px. Eight toggle rows in two columns: 42 + 4 * 44 = 218 px.
    expect(defaultOpen(plate(8, { pickable: true }), phone, wide)).toBe(false);
    // The same rows as plain 24 px rows: 42 + 4 * 24 = 138 px.
    expect(defaultOpen(plate(8), phone, wide)).toBe(true);
    // Six plain rows in two columns: 114 px. In one column, as a deficit's: 186 px.
    expect(defaultOpen(plate(6, { map: 'deficit' }), phone, wide)).toBe(false);
    expect(defaultOpen(plate(6), phone, wide)).toBe(true);
    expect(defaultOpen(plate(6, { name: 'direction', map: 'direction' }), phone, wide)).toBe(false);
  });
});

describe('keyBand', () => {
  const visible = { width: 1000, height: 600 };

  test('keys that have no size, or a stage that has none, take nothing', () => {
    expect(keyBand({ width: 0, height: 0 }, visible, 20)).toEqual({ top: 0, right: 0 });
    expect(keyBand({ width: 200, height: 100 }, null, 20)).toEqual({ top: 0, right: 0 });
    expect(keyBand({ width: 200, height: 100 }, { width: 0, height: 0 }, 20)).toEqual({
      top: 0,
      right: 0,
    });
  });

  test('a stage too narrow for a column gives the keys a strip along the top', () => {
    // Strip: min(390, 500 - 120) = 380. Column: min(390 - 370, 500) = 20.
    expect(keyBand({ width: 350, height: 100 }, { width: 390, height: 500 }, 20)).toEqual({
      top: 120,
      right: 0,
    });
  });

  test('keys taller than the stage is wide get a column on the right', () => {
    // Strip: min(1000, 600 - 520) = 80. Column: min(1000 - 120, 600) = 600.
    expect(keyBand({ width: 100, height: 500 }, visible, 20)).toEqual({ top: 0, right: 120 });
  });

  test('a tie in the larger square goes to the strip', () => {
    const square = { width: 600, height: 600 };
    // Strip: min(600, 600 - 100) = 500. Column: min(600 - 100, 600) = 500.
    expect(keyBand({ width: 80, height: 80 }, square, 20)).toEqual({ top: 100, right: 0 });
    // One pixel taller: the strip leaves 499, the column 500.
    expect(keyBand({ width: 80, height: 81 }, square, 20)).toEqual({ top: 0, right: 100 });
  });

  test('the band is whole pixels', () => {
    const phone = { width: 390, height: 500 };
    expect(keyBand({ width: 350.4, height: 100.6 }, phone, 20)).toEqual({ top: 121, right: 0 });
    expect(keyBand({ width: 100.4, height: 500.6 }, visible, 20)).toEqual({ top: 0, right: 120 });
  });
});
