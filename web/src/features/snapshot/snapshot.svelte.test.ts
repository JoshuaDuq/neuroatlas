// The snapshot in a real browser over the fake engine: the markings measured where the stage draws them,
// with what the keys say taken from `keys.model()`; the caption's inputs; the download, its announcement
// and its failure.
import '../../styles/index.css';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import type { Legend } from '../../lib/core/state/paint.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { snapshotMarkings } from './markings.ts';
import type { StageKeysModel } from './markings.ts';
import { saveSnapshot, snapshotPlan } from './snapshot.ts';
import type { SnapshotStage, SnapshotSubject } from './snapshot.ts';
import Fixture from './snapshot-test-support.svelte';

const eventually = <T>(check: () => T | Promise<T>) => vi.waitFor(check, { timeout: 5000 });

const FUNCTIONAL = {
  levels: {
    named: [{ id: 'a', number: 3, short: 'Primary', short_fr: 'Primaire', color: [9, 98, 7] }],
    sections: [
      { id: 's', number: 1, short: 'Early', short_fr: 'Précoce', color: [31, 91, 1] },
      { id: 't', number: 2, short: 'Late', short_fr: 'Tardif', color: [91, 31, 1] },
    ],
  },
} as unknown as FunctionalRegions;

const row = (id: string, label: string, extra = {}) => ({
  id,
  color: [40 + id.length * 30, 120, 200] as [number, number, number],
  label,
  pressed: false,
  ...extra,
});
/** A deficit's findings, the first picked: its rows are toggles (G3's toolbar). */
const DEFICIT: Legend = {
  map: 'deficit',
  title: 'Aphasia',
  note: 'Each finding names the regions it cites.',
  rows: [
    row('f1', 'Broca', { pressed: true }),
    row('f22', 'Wernicke', { absent: true }),
    row('f333', 'Arcuate'),
  ],
};

interface Live {
  lang: 'en' | 'fr';
  status: 'ready' | 'loading';
  surfaceColor: 'atlas' | 'functional';
  functionalLevel: 'named' | 'sections';
  networks: null;
  functionalRegions: FunctionalRegions | null;
  legend: Legend | null;
}

let engine: FakeEngine;
let stage: StageLayout;
let live: Live;
let handle: { keys?: StageKeysModel };
let cleanups: (() => void)[];

const host = () => document.querySelector<HTMLElement>('#viewport')!;
const keys = () => handle.keys!;
const plate = (name: string) => host().querySelector<HTMLElement>(`[data-name="${name}"]`)!;

async function mount(overrides: Partial<Live> = {}, { width = 1000, height = 700 } = {}) {
  engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width, height },
  });
  const state = $state<Live>({
    lang: 'en',
    status: 'ready',
    surfaceColor: 'atlas',
    functionalLevel: 'named',
    networks: null,
    functionalRegions: FUNCTIONAL,
    legend: null,
    ...overrides,
  });
  live = state;
  handle = {};
  cleanups.push(
    $effect.root(() => {
      stage = createStageLayout({ media: { phone: false }, storage: null });
    }),
  );
  render(Fixture, { engine, stage, live, handle, width, height });
  flushSync();
  await eventually(() => expect(stage.visibleRect).not.toBeNull());
}

const markings = () =>
  snapshotMarkings(host(), stage.visibleRect!, { stage, keys: keys(), lang: live.lang });

const scene = (): SnapshotStage => ({ host: host(), stage, keys: keys(), engine });

const subject = (overrides: Partial<SnapshotSubject> = {}): SnapshotSubject => ({
  lang: 'en',
  anatomy: { display_name: '“CDMD sub_013”' },
  atlas: 'hcp-mmp',
  surfaceColor: 'atlas',
  detail: 'learning',
  offersDetail: true,
  view: 'left',
  reference: null,
  section: null,
  ...overrides,
});

/** The left edge of `node`'s text, in pixels of the stage. */
const textLeft = (node: Element) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect().left - host().getBoundingClientRect().left;
};

beforeEach(async () => {
  cleanups = [];
  await page.viewport(1280, 900);
});

afterEach(() => {
  cleanup();
  cleanups.forEach((stop) => stop());
  vi.restoreAllMocks();
});

describe('the keys in the image', () => {
  test('a pickable paint key names every row beside its own swatch, the picked one in bold (g6-paint-row-labels)', async () => {
    await mount({ legend: DEFICIT });
    const [mark] = markings().keys;
    const labels = [...plate('paint').querySelectorAll('.stage-key-label')];
    const swatches = [...plate('paint').querySelectorAll('.network-swatch')];
    expect(mark!.texts.map((text) => text.text)).toEqual([
      'Aphasia',
      'Broca',
      'Wernicke',
      'Arcuate',
    ]);
    mark!.texts.slice(1).forEach((text, index) => {
      expect(text.x).toBeCloseTo(textLeft(labels[index]!), 3);
      const swatchRight =
        swatches[index]!.getBoundingClientRect().right - host().getBoundingClientRect().left;
      expect(text.x).toBeGreaterThan(swatchRight);
    });
    expect(mark!.texts.slice(1).map((text) => text.font.split(' ')[0])).toEqual([
      '600',
      '400',
      '400',
    ]);
    // A colour not shown in this view is hollow on screen, so it is not filled in the image either.
    expect(mark!.swatches.map((swatch) => swatch.color)).toEqual([
      'rgb(100, 120, 200)',
      'rgba(0, 0, 0, 0)',
      'rgb(160, 120, 200)',
    ]);
    // The note is not drawn, as in legacy (flagged on #4); the plate keeps its band.
    expect(mark!.texts.some((text) => text.text === DEFICIT.note)).toBe(false);
    const box = plate('paint').getBoundingClientRect();
    expect(mark!.box).toMatchObject({ width: box.width, height: box.height });
  });

  test('the functional level drawn is the chosen one, beside the title, and a fold keeps the title row alone', async () => {
    await mount({ surfaceColor: 'functional', functionalLevel: 'sections' });
    expect(markings().keys[0]!.texts.map((text) => text.text)).toEqual([
      'Functional divisions',
      'Sections',
      '1 · Early',
      '2 · Late',
    ]);
    const radio = plate('functional').querySelector('[role="radio"][aria-checked="true"]')!;
    expect(markings().keys[0]!.texts[1]!.x).toBeCloseTo(textLeft(radio), 3);
    await userEvent.click(plate('functional').querySelector('.stage-key-toggle')!);
    await eventually(() =>
      expect(markings().keys[0]!.texts.map((text) => text.text)).toEqual([
        'Functional divisions',
        'Sections',
      ]),
    );
    expect(markings().keys[0]!.swatches).toEqual([]);
  });

  test('a plate the model says is folded draws its title alone, though its rows are shown (the fold comes from the model)', async () => {
    await mount({ legend: DEFICIT });
    expect(plate('paint').querySelectorAll('.stage-key-list > li')).toHaveLength(3);
    const folded = {
      model: () =>
        keys()
          .model()
          .map((entry) => ({ ...entry, open: false })),
    } as StageKeysModel;
    const [mark] = snapshotMarkings(host(), stage.visibleRect!, {
      stage,
      keys: folded,
      lang: live.lang,
    }).keys;
    expect(mark!.texts.map((text) => text.text)).toEqual(['Aphasia']);
    expect(mark!.swatches).toEqual([]);
  });

  test('rows scrolled out of a long key stay out of the image', async () => {
    const long: Legend = {
      ...DEFICIT,
      rows: Array.from({ length: 40 }, (_, i) => row(`r${i}`, `Finding ${i}`)),
    };
    await mount({ legend: long }, { width: 1100, height: 420 });
    // Crowded, it starts folded; the reader opens it.
    await userEvent.click(plate('paint').querySelector('.stage-key-toggle')!);
    await eventually(() => expect(markings().keys[0]!.texts.length).toBeGreaterThan(2));
    const { texts, swatches, box } = markings().keys[0]!;
    expect(texts.length).toBeLessThan(41);
    expect(swatches.length).toBeLessThan(40);
    for (const mark of [...texts, ...swatches]) {
      expect(mark.y).toBeGreaterThanOrEqual(box.y);
      expect(mark.y).toBeLessThanOrEqual(box.y + box.height);
    }
  });
});

describe('the letters and the scale bar', () => {
  test('each letter at the centre it is drawn; the top one on the caption line without a key band; the scale bar in true pixels', async () => {
    await mount();
    const { letters, scale } = markings();
    expect(letters.map((letter) => letter.edge)).toEqual(['top', 'right', 'bottom', 'left']);
    const origin = host().getBoundingClientRect();
    for (const letter of letters) {
      const box = host().querySelector(`[data-edge="${letter.edge}"]`)!.getBoundingClientRect();
      expect(letter.text).toBe(engine.camera.view.edges[letter.edge]);
      expect(letter.x).toBeCloseTo(box.left - origin.left + box.width / 2, 3);
      if (letter.edge !== 'top')
        expect(letter.y).toBeCloseTo(box.top - origin.top + box.height / 2, 3);
    }
    expect(letters[0]!.y).toBe(20);
    expect(scale).toEqual({ pixels: 100, label: '10 mm' });
  });

  test('over a tall dock the bottom letter keeps the line above the statement', async () => {
    await mount();
    stage.setDock({ width: 300, height: 400 });
    flushSync();
    expect(stage.dockTall).toBe(true);
    const bottom = markings().letters.find((letter) => letter.edge === 'bottom')!;
    expect(bottom).toMatchObject({ x: 500, y: 700 - 16 - 32 });
  });

  test('before the anatomy is drawn there are no letters and no scale bar', async () => {
    await mount({ status: 'loading' });
    expect(markings()).toMatchObject({ letters: [], scale: null });
  });
});

describe('the caption', () => {
  const lines = (plan: ReturnType<typeof snapshotPlan>['plan']) =>
    plan.caption.map((line) => line.map((runs) => runs.map((run) => run.text).join('')));

  test('the internal anatomy only where the masthead offers it, the view only while the camera holds it', async () => {
    await mount();
    expect(lines(snapshotPlan(scene(), subject()).plan)).toEqual([
      ['CDMD sub_013'],
      ['HCP-MMP', 'Regions', 'Teaching set'],
      ['Left view'],
    ]);
    const released = { ...scene(), engine: { ...engine, camera: { viewHeld: false } } };
    expect(lines(snapshotPlan(released, subject({ offersDetail: false })).plan)).toEqual([
      ['CDMD sub_013'],
      ['HCP-MMP', 'Regions'],
    ]);
  });

  test('the tract reference replaces subject and labels and drops the section; a held view is still named', async () => {
    await mount();
    const section = { plane: 'axial', offset: 4, tilt: 0, azimuth: 0 } as const;
    expect(lines(snapshotPlan(scene(), subject({ section })).plan)[2]).toEqual([
      'Axial section',
      '+4.0 mm',
    ]);
    expect(
      lines(snapshotPlan(scene(), subject({ section, reference: 'HCP tract reference' })).plan),
    ).toEqual([['HCP tract reference'], ['Left view']]);
  });
});

describe('saving', () => {
  let region: HTMLElement;
  let links: { download: string; href: string }[];
  const commands = { fail: vi.fn() };

  beforeEach(() => {
    region = document.body.appendChild(document.createElement('div'));
    cleanups.push(attachAnnouncer(region), () => region.remove());
    links = [];
    commands.fail.mockReset();
    // The download itself is the browser's; the link it is given is what the test reads.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      links.push({ download: this.download, href: this.href });
    });
  });

  test('downloads planum-<atlas>.png, a PNG of the visible stage, and says so in the reader’s language', async () => {
    await mount({ legend: DEFICIT });
    engine.camera.setChromeInsets({ bottom: 100 }, {});
    flushSync();
    await saveSnapshot(scene(), subject({ lang: 'fr' }), commands);
    expect(commands.fail).not.toHaveBeenCalled();
    expect(links).toHaveLength(1);
    expect(links[0]!.download).toBe('planum-hcp-mmp.png');
    const blob = await (await fetch(links[0]!.href)).blob();
    expect(blob.type).toBe('image/png');
    const image = await createImageBitmap(blob);
    expect([image.width, image.height]).toEqual([1000, 600]);
    expect(region.textContent).toBe('Image enregistrée : planum-hcp-mmp.png.');
  });

  test('a second request while one is being made joins it: one file', async () => {
    await mount();
    const first = saveSnapshot(scene(), subject({ atlas: null }), commands);
    const second = saveSnapshot(scene(), subject({ atlas: null }), commands);
    expect(second).toBe(first);
    await first;
    expect(links.map((link) => link.download)).toEqual(['planum-brain.png']);
    expect(region.textContent).toBe('Image saved as planum-brain.png.');
    await saveSnapshot(scene(), subject(), commands);
    expect(links).toHaveLength(2);
  });

  test('the object URL is released 40 s after the click, not before', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const revoke = vi.spyOn(URL, 'revokeObjectURL');
      await mount();
      await saveSnapshot(scene(), subject(), commands);
      expect(links).toHaveLength(1);
      // Read the blob before the URL is released.
      expect((await (await fetch(links[0]!.href)).blob()).type).toBe('image/png');
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(39_999);
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(revoke).toHaveBeenCalledExactlyOnceWith(links[0]!.href);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a failure is the snapshot notice, and nothing is downloaded or said', async () => {
    await mount();
    const lost = new Error('context lost');
    const failing = {
      ...scene(),
      engine: {
        camera: engine.camera,
        captureSnapshot: () => {
          throw lost;
        },
      },
    };
    await saveSnapshot(failing, subject(), commands);
    expect(commands.fail).toHaveBeenCalledExactlyOnceWith('snapshot', lost);
    expect(links).toEqual([]);
    expect(region.textContent).toBe('');
  });
});
