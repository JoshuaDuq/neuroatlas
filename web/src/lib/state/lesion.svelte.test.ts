import { afterEach, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { FINDING_COLORS } from '../core/clinical/catalog.ts';
import type {
  EngineLesion,
  LesionMeasurement,
  LesionSphere,
  TractCrossing,
} from '../engine/api.ts';
import { createLesionStore } from './lesion.svelte.ts';

const measurement = (regions: [string, number, number][]): LesionMeasurement => ({
  volume: 100,
  tissue: { cortex: 100, white: 0, deep: 0, fluid: 0, outside: 0 },
  regions: new Map(regions.map(([id, inside, whole]) => [id, { inside, whole }])),
  sizes: new Map([
    ...regions.map(([id, , whole]) => [id, whole] as const),
    ['hcp-mmp:left:1', 200],
  ]),
});

const domains = {
  groups: [{ id: 'language-number' }, { id: 'perception' }],
  domains: [
    { id: 'phonology', group: 'language-number', name: 'Phonology', name_fr: 'Phonologie' },
    { id: 'hearing', group: 'perception', name: 'Hearing', name_fr: 'Audition' },
  ],
  regions: {
    'hcp-mmp:left:1': [{ domain: 'phonology', z: 5 }],
    'hcp-mmp:left:2': [{ domain: 'hearing', z: 4 }],
  },
} as never;

const associations = [
  {
    id: 'naming',
    deficit: 'aphasia',
    laterality: 'left',
    title: { en: 'Naming', fr: 'Dénomination' },
    mappings: [{ region: 'destrieux:left:38', source_name: 'G_temporal_middle' }],
  },
  {
    id: 'repetition',
    deficit: 'aphasia',
    laterality: 'left',
    title: { en: 'Repetition', fr: 'Répétition' },
    mappings: [{ region: 'destrieux:left:34', source_name: 'G_temp_sup-Lateral' }],
  },
] as never;

/** The engine's lesion with each measurement held until the test settles it. */
function heldLesion() {
  const pending: { sphere: LesionSphere; settle: (value: LesionMeasurement) => void }[] = [];
  const counts: { sphere: LesionSphere; settle: (value: TractCrossing[]) => void }[] = [];
  const shown: (LesionSphere | null)[] = [];
  const placing: boolean[] = [];
  const lesion: EngineLesion = {
    show: (sphere) => void shown.push(sphere),
    setPlacing: (next) => void placing.push(next),
    measure: (sphere) => new Promise((settle) => pending.push({ sphere, settle })),
    tractBundles: () => ['af-left'],
    measureTracts: (sphere) => new Promise((settle) => counts.push({ sphere, settle })),
  };
  return { lesion, pending, counts, shown, placing };
}

let stop = () => {};
afterEach(() => stop());

function build(held = heldLesion()) {
  let store!: ReturnType<typeof createLesionStore>;
  stop = $effect.root(() => {
    store = createLesionStore({
      lesion: held.lesion,
      associations,
      domains,
      deficitGroup: () => 'language-number',
    });
  });
  flushSync();
  return { store, ...held };
}

test('a placement is drawn and measured at the chosen radius, its centre to a tenth of a millimetre', async () => {
  const { store, pending, shown } = build();
  store.place([-45.04, -25.01, 30.06]);
  flushSync();
  const sphere = { centre: [-45, -25, 30.1], radius: 10 };
  expect(shown.at(-1)).toEqual(sphere);
  expect(pending.map((entry) => entry.sphere)).toEqual([sphere]);
  expect(store.measured).toEqual({ status: 'measuring' });
  pending[0]!.settle(measurement([]));
  await expect.poll(() => store.measured?.status).toBe('ready');
});

test('a later placement drops a measurement still on its way', async () => {
  const { store, pending } = build();
  store.place([1, 2, 3]);
  store.place([4, 5, 6]);
  pending[1]!.settle(measurement([['destrieux:left:34', 10, 100]]));
  await expect.poll(() => store.measured?.status).toBe('ready');
  pending[0]!.settle(measurement([['destrieux:left:38', 50, 100]]));
  await Promise.resolve();
  expect(store.findings!.shown.map((row) => row.association.id)).toEqual(['repetition']);
});

test('dragging the radius redraws at once and measures only once it is let go', () => {
  const { store, pending, shown } = build();
  store.place([0, 0, 0]);
  store.previewRadius(20);
  flushSync();
  expect(shown.at(-1)).toEqual({ centre: [0, 0, 0], radius: 20 });
  expect(pending).toHaveLength(1);
  store.commitRadius(20);
  expect(pending.map((entry) => entry.sphere.radius)).toEqual([10, 20]);
});

test('paints the ranked findings only once asked, in rank order', async () => {
  const { store, pending } = build();
  store.place([0, 0, 0]);
  pending[0]!.settle(
    measurement([
      ['destrieux:left:38', 10, 100],
      ['destrieux:left:34', 50, 100],
    ]),
  );
  await expect.poll(() => store.findings?.shown.length).toBe(2);
  expect(store.paint).toBe(null);
  store.setMode('deficits');
  expect(store.paint!.kind).toBe('deficits');
  expect(store.paint!.rows.map((row) => [row.id, row.color])).toEqual([
    ['repetition', FINDING_COLORS[0]],
    ['naming', FINDING_COLORS[1]],
  ]);
  expect(store.paint!.paint.colors.get('destrieux:left:34')).toBe(FINDING_COLORS[0]);
});

test('profiles the functions and deficits it reaches by group, and paints the functions on asking', async () => {
  const { store, pending } = build();
  store.place([0, 0, 0]);
  pending[0]!.settle(
    measurement([
      ['hcp-mmp:left:2', 10, 100],
      ['destrieux:left:34', 50, 100],
    ]),
  );
  await expect.poll(() => store.profile?.length).toBe(2);
  expect(
    store.profile!.map((group) => [
      group.group,
      group.functions.map((row) => row.id),
      group.deficits.map((row) => row.deficit),
    ]),
  ).toEqual([
    ['language-number', [], ['aphasia']],
    ['perception', ['hearing'], []],
  ]);
  store.setMode('functions');
  expect(store.paint!.kind).toBe('functions');
  expect(store.paint!.rows).toEqual([
    { id: 'hearing', color: FINDING_COLORS[0], title: { en: 'Hearing', fr: 'Audition' } },
  ]);
});

test('counts the tracts once asked, then again for every later placement', async () => {
  const { store, counts } = build();
  store.place([0, 0, 0]);
  expect(counts).toHaveLength(0);
  store.countTracts();
  expect(counts).toHaveLength(1);
  store.place([1, 0, 0]);
  expect(counts.map((entry) => entry.sphere.centre)).toEqual([
    [0, 0, 0],
    [1, 0, 0],
  ]);
});

test('removing it takes it off the stage and forgets its measurement and paint', () => {
  const { store, shown } = build();
  store.place([0, 0, 0]);
  store.setMode('deficits');
  store.remove();
  flushSync();
  expect(shown.at(-1)).toBe(null);
  expect([store.sphere, store.measured, store.paint]).toEqual([null, null, null]);
});

test('the engine places on a click only while the reader is placing', () => {
  const { store, placing } = build();
  store.setPlacing(true);
  flushSync();
  store.setPlacing(false);
  flushSync();
  expect(placing).toEqual([false, true, false]);
});
