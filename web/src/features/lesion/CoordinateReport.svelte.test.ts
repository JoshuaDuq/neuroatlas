// A published coordinate's report: shares are of the sphere, what no region covers is its own share,
// only a deep structure at the landing point is named, and nothing functional or clinical is attached.
import { afterEach, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { cleanup, render } from 'vitest-browser-svelte';
import type { EngineLesion, LesionMeasurement } from '../../lib/engine/api.ts';
import { createLesionStore } from '../../lib/state/lesion.svelte.ts';
import type { CoordinateSpaces, Language } from '../../lib/types/index.ts';
import CoordinateReport from './CoordinateReport.svelte';

const spaces = {
  label: 'Published coordinates',
  radius_mm: 5,
  spaces: [
    {
      id: 'mni152nlin2009casym',
      label: 'MNI152NLin2009cAsym',
      description: '',
      citation: 'Fonov et al. 2009',
      doi: 'https://doi.org/10.1016/x',
      license: 'MNI template licence',
      copyright: 'Copyright (C) 1993–2004 Louis Collins',
      field: {} as never,
      registration: { cortex_dice: 0.81, round_trip_mm: { median: 0.2, p95: 0.6 } },
    },
  ],
  unstated: {
    reads_as: 'mni152nlin2009casym',
    alternatives: [
      {
        id: 'mni152nlin6asym',
        label: 'MNI152NLin6Asym',
        description: 'FSL',
        against: {
          mni152nlin2009casym: {
            cortex_offset_mm: { median: 1.56, p95: 3.2, max: 7 },
            subcortical_offset_mm: {},
            sphere_overlap: {},
          },
        },
      },
    ],
  },
  method: 'SynthMorph',
} satisfies CoordinateSpaces;

const measured = (centre: LesionMeasurement['centre']): LesionMeasurement => ({
  volume: 100,
  tissue: { cortex: 40, white: 30, deep: 20, fluid: 5, outside: 5 },
  regions: new Map([
    ['destrieux:left:34', { inside: 40, whole: 1000 }],
    ['schaefer:left:1', { inside: 30, whole: 500 }],
    ['schaefer:left:2', { inside: 10, whole: 400 }],
    ['aseg:left:10', { inside: 20, whole: 800 }],
    ['aseg:left:4', { inside: 5, whole: 600 }],
    ['arterial:left:mca', { inside: 70, whole: 90_000 }],
  ]),
  sizes: new Map(),
  centre,
  tissueOf: new Map([
    ['destrieux:left:34', 'cortex'],
    ['aseg:left:10', 'deep'],
    ['aseg:left:4', 'fluid'],
  ]),
});

let stop = () => {};
afterEach(() => {
  stop();
  cleanup();
  vi.restoreAllMocks();
});

async function mount(
  lang: Language,
  space: string,
  centre: LesionMeasurement['centre'] = { tissue: 'cortex', region: 'destrieux:left:34' },
  edit: (regions: Map<string, { inside: number; whole: number }>) => void = () => {},
) {
  let settle!: (value: LesionMeasurement) => void;
  const lesion = {
    show() {},
    setPlacing() {},
    measure: () => new Promise((resolve) => (settle = resolve)),
    tractBundles: () => [],
    showTract: () => new Promise(() => {}),
    clearTract() {},
    measureTracts: () => new Promise(() => {}),
  } as unknown as EngineLesion;
  let store!: ReturnType<typeof createLesionStore>;
  stop = $effect.root(() => {
    store = createLesionStore({
      lesion,
      cortex: { opacity: 1, seeThrough: 0.3, setOpacity() {} },
      associations: [],
      domains: { groups: [], domains: [], regions: {} } as never,
      deficitGroup: () => 'none',
    });
  });
  flushSync();
  store.placeCoordinate({ entered: [-42, 22, 6], space }, [-40.04, 20, 7], 5);
  const measurement = measured(centre);
  edit(measurement.regions as Map<string, { inside: number; whole: number }>);
  settle(measurement);
  await expect.poll(() => store.measured?.status).toBe('ready');
  const name = (id: string) => id;
  render(CoordinateReport, {
    lesion: store,
    lang,
    spaces,
    anatomy: 'cdmd',
    atlases: [
      { id: 'destrieux', name: 'Destrieux' },
      { id: 'schaefer', name: 'Schaefer' },
    ],
    networks: { id: 'yeo7', atlas: 'schaefer' },
    territories: 'arterial',
    label: name,
    bundleName: name,
    networksOf: () => [{ network: 'Default', fraction: 1 }],
  });
}

const text = () => document.querySelector('.coordinate-report')!.textContent!;
const rowOf = (name: string) =>
  [...document.querySelectorAll('.network-row')].find((row) =>
    row.querySelector('.network-row-name')!.textContent!.trim().startsWith(name),
  )!;

test('the caveat comes before any share, and each share is of the sphere, with the rest its own', async () => {
  await mount('en', 'mni152nlin2009casym');
  const caveat = [...document.querySelectorAll('p')].find((p) =>
    p.textContent!.startsWith('A template location carried onto this one brain by registration.'),
  )!;
  const within = [...document.querySelectorAll('h3')].find(
    (h) => h.textContent === 'Within 5\u202fmm',
  )!;
  expect(caveat.compareDocumentPosition(within) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(text()).toContain('−42, 22, 6\u202fmm in MNI152NLin2009cAsym');
  expect(text()).toContain('Lands at −40.0, +20.0, +7.0\u202fmm on this brain');
  // 40 of the sphere's 100 mm³, not 40 of the region's 1,000.
  expect(rowOf('destrieux:left:34').textContent).toContain('40%');
  expect(rowOf('In none of these regions').textContent).toContain('60%');
  expect(rowOf('Default mode').textContent).toContain('40%');
  // Only deep grey is listed under it; the ventricle is in the rest.
  expect(rowOf('aseg:left:10').textContent).toContain('20%');
  expect(rowOf('aseg:left:4')).toBeUndefined();
  expect(rowOf('arterial:left:mca').textContent).toContain('70%');
  expect(text()).toContain('Tracts passing within 5\u202fmm');
  expect(text()).not.toMatch(/What it reaches|Functions|Deficits|finding/);
  expect(text()).not.toContain('Template not stated');
});

test('a section whose atlas the sphere does not reach is left out', async () => {
  await mount('en', 'mni152nlin2009casym');
  expect(text()).toContain('Deep grey (aseg)');
  cleanup();
  stop();
  await mount('en', 'mni152nlin2009casym', undefined, (regions) => regions.delete('aseg:left:10'));
  expect(text()).not.toContain('Deep grey (aseg)');
  expect(text()).toContain('Arterial territories');
});

test('a cortical landing point names only its tissue; a deep one names its structure', async () => {
  await mount('en', 'mni152nlin2009casym');
  expect(text()).toContain('At that point: Cortex');
  expect(text()).not.toContain('At that point: Cortex · ');
  cleanup();
  stop();
  await mount('en', 'mni152nlin2009casym', { tissue: 'deep', region: 'aseg:left:10' });
  expect(text()).toContain('At that point: Deep grey · aseg:left:10');
});

test('a coordinate in no stated template reads as reads_as, beside each alternative’s measured offset', async () => {
  await mount('en', 'unstated');
  expect(text()).toContain('−42, 22, 6\u202fmm in MNI, template not stated');
  expect(text()).toContain('Template not stated: read as MNI152NLin2009cAsym.');
  expect(text()).toContain(
    'MNI152NLin6Asym lands a median 1.6\u202fmm (95%: 3.2\u202fmm) away on this brain',
  );
});

test('the CSV leads with how it was placed, then every atlas’s shares of the sphere', async () => {
  await mount('en', 'unstated');
  const files: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    files.push(blob as Blob);
    return 'blob:coordinate';
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Download CSV')!.click();
  const csv = await files[0]!.text();
  const lines = csv.split('\r\n');
  expect(lines[0]).toBe('item,atlas,region_id,region,value');
  expect(lines).toEqual(
    expect.arrayContaining([
      'entered_mni_mm,,,,"-42, 22, 6"',
      'space,,,,unstated',
      'read_as,,,,mni152nlin2009casym',
      'landing_surface_ras_mm,,,,"-40, 20, 7"',
      'radius_mm,,,,5',
      'template_doi,,,,https://doi.org/10.1016/x',
      'registration.round_trip_mm.p95,,,,0.6',
      'unstated.mni152nlin6asym.cortex_offset_mm.median,,,,1.56',
      'anatomy,,,,cdmd',
      'share_of_sphere,destrieux,destrieux:left:34,destrieux:left:34,0.4',
      'share_of_sphere,destrieux,,(in none of these regions),0.6',
      'share_of_sphere,yeo7,Default,Default mode,0.4',
      'share_of_sphere,aseg,aseg:left:10,aseg:left:10,0.2',
      'share_of_sphere,arterial,arterial:left:mca,arterial:left:mca,0.7',
    ]),
  );
  const firstShare = lines.findIndex((line) => line.startsWith('share_of_sphere'));
  expect(lines.slice(0, firstShare).every((line) => !line.startsWith('share_of_sphere'))).toBe(
    true,
  );
  expect(lines.slice(firstShare, -1).every((line) => line.startsWith('share_of_sphere'))).toBe(
    true,
  );
});

test('in French, the caveat and the offsets are said in French', async () => {
  await mount('fr', 'unstated');
  expect(text()).toContain(
    'Une position du gabarit reportée sur ce seul cerveau par recalage. Ce n’est pas l’endroit où serait le pic propre à cette personne, ni ce que fait ce cerveau à cet endroit.',
  );
  expect(text()).toMatch(/MNI152NLin6Asym se place à une médiane de 1,6\s?mm/);
});
