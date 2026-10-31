// The lesion report's wording: it says it predicts nothing before it shows any share, and a deficit's
// share reads as overlap with a cited region, not as a chance of the deficit.
import { afterEach, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { cleanup, render } from 'vitest-browser-svelte';
import type { EngineLesion, LesionMeasurement } from '../../lib/engine/api.ts';
import { createLesionStore } from '../../lib/state/lesion.svelte.ts';
import type { Language } from '../../lib/types/index.ts';
import LesionReport from './LesionReport.svelte';

const domains = {
  groups: [{ id: 'language-number' }],
  domains: [
    { id: 'phonology', group: 'language-number', name: 'Phonology', name_fr: 'Phonologie' },
  ],
  regions: {},
} as never;

const associations = [
  {
    id: 'repetition',
    deficit: 'aphasia',
    laterality: 'left',
    title: { en: 'Repetition', fr: 'Répétition' },
    mapping_note: { en: 'Approximate.', fr: 'Approximatif.' },
    mappings: [{ region: 'destrieux:left:34', source_name: 'G_temp_sup-Lateral' }],
  },
] as never;

const measurement: LesionMeasurement = {
  volume: 100,
  tissue: { cortex: 100, white: 0, deep: 0, fluid: 0, outside: 0 },
  regions: new Map([['destrieux:left:34', { inside: 40, whole: 100 }]]),
  sizes: new Map([['destrieux:left:34', 100]]),
  centre: { tissue: 'cortex', region: 'destrieux:left:34' },
  tissueOf: new Map([['destrieux:left:34', 'cortex']]),
};

let stop = () => {};
afterEach(() => {
  stop();
  cleanup();
});

async function mount(lang: Language) {
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
      associations,
      domains,
      deficitGroup: () => 'language-number',
    });
  });
  flushSync();
  store.place([-50, -20, 5]);
  settle(measurement);
  await expect.poll(() => store.profile?.length).toBe(1);
  const name = (id: string) => id;
  render(LesionReport, {
    lesion: store,
    lang,
    atlases: [{ id: 'destrieux', name: 'Destrieux' }],
    label: name,
    bundleName: name,
    functionName: name,
    groupName: name,
    deficitName: () => (lang === 'fr' ? 'Aphasie' : 'Aphasia'),
    mode: 'lesion',
    onMode() {},
    onFunction() {},
    onDeficit() {},
    onFinding() {},
  });
}

const paragraph = (text: RegExp) =>
  [...document.querySelectorAll('p')].find((element) => text.test(element.textContent ?? ''))!;

test('the caveat comes before what the lesion reaches, and a deficit’s share is of a cited region', async () => {
  await mount('en');
  const caveat = paragraph(/predicts no deficit/);
  const reaches = [...document.querySelectorAll('h3')].find(
    (heading) => heading.textContent === 'What it reaches',
  )!;
  expect(caveat.compareDocumentPosition(reaches) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // Said once: the note on the shares no longer repeats it.
  expect(
    [...document.querySelectorAll('p')].filter((p) =>
      /predicts no deficit/.test(p.textContent ?? ''),
    ),
  ).toHaveLength(1);
  const row = [...document.querySelectorAll('.lesion-target')].find((button) =>
    button.textContent?.includes('Aphasia'),
  )!;
  expect(row.textContent).toContain('1 finding · up to 40% of a cited region inside');
});

test('in French, the share is of a cited region in the lesion', async () => {
  await mount('fr');
  const row = [...document.querySelectorAll('.lesion-target')].find((button) =>
    button.textContent?.includes('Aphasie'),
  )!;
  expect(row.textContent).toMatch(/jusqu’à 40\s?% d’une région citée dans la lésion/);
});
