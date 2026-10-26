// The stage's colour keys against the legacy viewport-chrome.js behaviour and WCAG 2.2, in a real browser:
// the folds (APG Disclosure), the functional level (Radio Group), the paint rows (Toolbar), focus, the
// band the keys take off the framing and the contrast and target sizes the stage needs.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { tick } from 'svelte';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import type { Legend } from '../../lib/core/state/paint.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import Fixture from './stage-keys-test-support.svelte';
import type { ColoredNetworks, KeyPlate } from './stage-keys.ts';

/** Waits for what a `ResizeObserver` delivers: it reports before the next paint, which a loaded machine can delay. */
const eventually = <T>(check: () => T | Promise<T>) => vi.waitFor(check, { timeout: 5000 });

const YEO: ColoredNetworks = {
  networks: ['Vis', 'Default'],
  colors: { Vis: [120, 18, 134], Default: [205, 62, 78] },
};
const CAB_NP_KEYS = [
  'Visual1',
  'Visual2',
  'Somatomotor',
  'Cingulo-Opercular',
  'Dorsal-Attention',
  'Language',
  'Frontoparietal',
  'Auditory',
  'Default',
  'Posterior-Multimodal',
  'Ventral-Multimodal',
  'Orbito-Affective',
];
const CAB_NP: ColoredNetworks = {
  networks: CAB_NP_KEYS,
  colors: Object.fromEntries(CAB_NP_KEYS.map((key, i) => [key, [20 * i, 90, 200 - 10 * i]])),
};
const FUNCTIONAL = {
  levels: {
    named: [
      { id: 'a', number: 3, short: 'Primary', short_fr: 'Primaire', color: [9, 98, 7] },
      { id: 'b', short: 'Insula', short_fr: 'Insula', color: [66, 5, 144] },
    ],
    sections: [{ id: 's', number: 1, short: 'Early', short_fr: 'Précoce', color: [31, 91, 1] }],
  },
} as unknown as FunctionalRegions;

const finding = (id: string, label: string, extra = {}) => ({
  id,
  color: [id.charCodeAt(1) * 3, 120, 200] as [number, number, number],
  label,
  pressed: false,
  ...extra,
});
const DEFICIT: Legend = {
  map: 'deficit',
  title: 'Aphasia',
  note: 'Each finding names the regions it cites.',
  rows: [
    finding('f1', 'Broca'),
    finding('f2', 'Wernicke', { absent: true }),
    finding('f3', 'Arcuate'),
  ],
};
const picked = (legend: Legend, id: string): Legend => ({
  ...legend,
  rows: legend.rows.map((row) => ({ ...row, pressed: row.id === id })),
});

type Live = {
  lang: 'en' | 'fr';
  status: 'ready' | 'loading';
  surfaceColor: 'atlas' | 'network' | 'cab-np' | 'functional';
  functionalLevel: 'named' | 'sections';
  networks: ColoredNetworks | null;
  cabNp: ColoredNetworks | null;
  functionalRegions: FunctionalRegions | null;
  legend: Legend | null;
  directionShown: boolean;
  media: { phone: boolean; coarsePointer: boolean };
};

let stage: StageLayout;
let live: Live;
let handle: { model?: () => (KeyPlate & { open: boolean })[] };
const onFunctionalLevel = vi.fn();
const onPaintPick = vi.fn();
const onDock = vi.fn();

function mount(
  overrides: Partial<Live> = {},
  {
    width = 1200,
    height = 800,
    sized = true,
  }: { width?: number; height?: number; sized?: boolean } = {},
) {
  stage = createStageLayout({ media: { phone: false }, onDock, storage: null });
  stage.setGutter(12);
  stage.setDock({ width: 300, height: 38 });
  if (sized) stage.setViewport({ x: 0, y: 0, width, height }, { width, height });
  const reactive = $state<Live>({
    lang: 'en',
    status: 'ready',
    surfaceColor: 'network',
    functionalLevel: 'named',
    networks: YEO,
    cabNp: CAB_NP,
    functionalRegions: FUNCTIONAL,
    legend: null,
    directionShown: false,
    media: { phone: false, coarsePointer: false },
    ...overrides,
  });
  live = reactive;
  handle = {};
  return render(Fixture, { stage, live, onFunctionalLevel, onPaintPick, width, height, handle });
}

const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const toggle = (name: string) => page.getByRole('button', { name, exact: true });
const plate = (name: string) => find(`#${name}-key`);
const rowButtons = () => [...document.querySelectorAll<HTMLButtonElement>('#paint-key li button')];
const swatch = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('li')]
    .find((li) => li.textContent!.trim().startsWith(label))!
    .querySelector<HTMLElement>('.network-swatch')!;

beforeEach(async () => {
  await page.viewport(1280, 900);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onFunctionalLevel.mockClear();
  onPaintPick.mockClear();
  onDock.mockClear();
});

describe('plates', () => {
  test('a plate is a named disclosure over a list of its rows, with a swatch for each', async () => {
    mount();
    const button = toggle('Yeo 7 networks');
    await expect.element(button).toHaveAttribute('aria-expanded', 'true');
    expect(button.element().getAttribute('aria-controls')).toBe(find('#network-key-body').id);
    const list = page.getByRole('list', { name: 'Yeo 7 networks' });
    expect(list.getByRole('listitem').elements()).toHaveLength(2);
    await expect.element(list).toHaveTextContent('Visual Default mode');
    expect(getComputedStyle(swatch('Visual')).backgroundColor).toBe('rgb(120, 18, 134)');
  });

  test('French titles the plate, the rows and the level in French', async () => {
    mount({ lang: 'fr', surfaceColor: 'functional' });
    await expect.element(toggle('Divisions fonctionnelles')).toBeVisible();
    await expect.element(page.getByRole('radio', { name: 'Nommées' })).toBeChecked();
    await expect.element(page.getByText('3 · Primaire')).toBeVisible();
  });

  test('the direction key names three directions in the colours of the streamlines', async () => {
    mount({ surfaceColor: 'atlas', directionShown: true });
    await expect.element(toggle('Local streamline direction')).toBeVisible();
    const colors = ['Left–right', 'Anterior–posterior', 'Superior–inferior'].map(
      (label) => getComputedStyle(swatch(label)).backgroundColor,
    );
    expect(colors).toEqual(['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)']);
  });

  test('no plate while the anatomy loads, and none appears for a colour with no key', async () => {
    mount({ status: 'loading' });
    expect(document.querySelectorAll('.stage-key')).toHaveLength(0);
    live.status = 'ready';
    await expect.element(toggle('Yeo 7 networks')).toBeVisible();
    live.surfaceColor = 'atlas';
    await vi.waitFor(() => expect(document.querySelectorAll('.stage-key')).toHaveLength(0));
  });
});

describe('folding', () => {
  test('the toggle folds the rows away and opens them again, keeping focus', async () => {
    mount();
    const button = toggle('Yeo 7 networks');
    button.element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(button).toHaveAttribute('aria-expanded', 'false');
    expect(find('#network-key-body').checkVisibility()).toBe(false);
    expect(document.activeElement).toBe(button.element());
    await userEvent.keyboard(' ');
    await expect.element(button).toHaveAttribute('aria-expanded', 'true');
    await expect.element(page.getByRole('list', { name: 'Yeo 7 networks' })).toBeVisible();
  });

  test('the reader’s fold of a map is kept for the visit, per map', async () => {
    mount({ cabNp: { ...CAB_NP, networks: CAB_NP_KEYS.slice(0, 3) } });
    await toggle('Yeo 7 networks').click();
    live.surfaceColor = 'cab-np';
    await expect.element(toggle('CAB-NP networks')).toHaveAttribute('aria-expanded', 'true');
    live.surfaceColor = 'network';
    await expect.element(toggle('Yeo 7 networks')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a key longer than eight rows folds when the stage first gets a width under 1000 px', async () => {
    mount({ surfaceColor: 'cab-np' }, { sized: false });
    await expect.element(toggle('CAB-NP networks')).toHaveAttribute('aria-expanded', 'true');
    stage.setViewport({ x: 0, y: 0, width: 900, height: 800 }, { width: 900, height: 800 });
    await expect.element(toggle('CAB-NP networks')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a coarse pointer weighs the paint rows as 44 px and folds a key whose rows no longer fit', async () => {
    const rows = Array.from({ length: 9 }, (_, i) => finding(`f${i}`, `Finding ${i}`));
    mount({ legend: { ...DEFICIT, rows } }, { height: 400 });
    await expect.element(toggle('Aphasia')).toHaveAttribute('aria-expanded', 'true');
    live.media.coarsePointer = true;
    await expect.element(toggle('Aphasia')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a key of more than eight rows starts folded on a stage under 1000 px, and open on a wide one', async () => {
    mount({ surfaceColor: 'cab-np' }, { width: 900 });
    await expect.element(toggle('CAB-NP networks')).toHaveAttribute('aria-expanded', 'false');
    cleanup();
    mount({ surfaceColor: 'cab-np' }, { width: 1200 });
    await expect.element(toggle('CAB-NP networks')).toHaveAttribute('aria-expanded', 'true');
  });

  test('the reader’s own choice outranks the crowd default, through a change of language', async () => {
    mount({ surfaceColor: 'cab-np' }, { width: 900 });
    await toggle('CAB-NP networks').click();
    await expect.element(toggle('CAB-NP networks')).toHaveAttribute('aria-expanded', 'true');
    live.lang = 'fr';
    await expect.element(toggle('Réseaux CAB-NP')).toHaveAttribute('aria-expanded', 'true');
  });

  test('model() reports each plate’s fold, crowd-folded or reader-folded, and the functional level', async () => {
    mount({ surfaceColor: 'cab-np' }, { width: 900 });
    const model = () => handle.model!();
    expect(model().map(({ name, open }) => [name, open])).toEqual([['network', false]]);
    await toggle('CAB-NP networks').click();
    expect(model()[0]!.open).toBe(true);
    await toggle('CAB-NP networks').click();
    expect(model()[0]!.open).toBe(false);
    live.surfaceColor = 'network';
    await expect.element(toggle('Yeo 7 networks')).toBeVisible();
    expect(model()[0]).toMatchObject({ open: true, level: null });
    await toggle('Yeo 7 networks').click();
    expect(model()[0]!.open).toBe(false);
    live.surfaceColor = 'functional';
    live.functionalLevel = 'sections';
    await expect.element(toggle('Functional divisions')).toBeVisible();
    expect(model()[0]).toMatchObject({ name: 'functional', open: true, level: 'sections' });
  });

  test('a resize does not refold a key the stage has already drawn', async () => {
    mount({ surfaceColor: 'cab-np' }, { width: 1200 });
    await expect.element(toggle('CAB-NP networks')).toHaveAttribute('aria-expanded', 'true');
    stage.setViewport({ x: 0, y: 0, width: 800, height: 800 }, { width: 800, height: 800 });
    await tick();
    expect(toggle('CAB-NP networks').element().getAttribute('aria-expanded')).toBe('true');
  });
});

describe('functional level', () => {
  test('is a radio group: the level is checked, and an arrow chooses the other', async () => {
    mount({ surfaceColor: 'functional' });
    const named = page.getByRole('radio', { name: 'Named' });
    await expect
      .element(page.getByRole('radiogroup', { name: 'Functional division level' }))
      .toBeVisible();
    await expect.element(named).toBeChecked();
    named.element().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onFunctionalLevel).toHaveBeenCalledExactlyOnceWith('sections');
  });

  test('the checked level and the rows follow the state', async () => {
    mount({ surfaceColor: 'functional' });
    await expect.element(page.getByText('3 · Primary')).toBeVisible();
    live.functionalLevel = 'sections';
    await expect.element(page.getByRole('radio', { name: 'Sections' })).toBeChecked();
    await expect.element(page.getByText('1 · Early')).toBeVisible();
    await expect.element(page.getByText('3 · Primary')).not.toBeInTheDocument();
  });

  test('a click on the other level chooses it, on the one shown it chooses nothing', async () => {
    mount({ surfaceColor: 'functional' });
    await page.getByRole('radio', { name: 'Named' }).click();
    expect(onFunctionalLevel).not.toHaveBeenCalled();
    await page.getByRole('radio', { name: 'Sections' }).click();
    expect(onFunctionalLevel).toHaveBeenCalledExactlyOnceWith('sections');
  });
});

describe('paint rows', () => {
  test('with more than one row they are toggles in a named toolbar, one Tab stop', async () => {
    mount({ legend: picked(DEFICIT, 'f3') });
    const bar = page.getByRole('toolbar', { name: 'Aphasia' });
    await expect.element(bar).toBeVisible();
    await expect
      .element(bar.getByRole('button', { name: /^Arcuate/ }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(bar.getByRole('button', { name: /^Broca/ }))
      .toHaveAttribute('aria-pressed', 'false');
    // The pressed row holds the stop.
    expect(rowButtons().map((button) => button.tabIndex)).toEqual([-1, -1, 0]);
    expect(find('#paint-key .stage-key-list').hasAttribute('data-picked')).toBe(true);
  });

  test('arrows, Home and End move focus and wrap, and Enter picks the focused row', async () => {
    mount({ legend: DEFICIT });
    const rows = rowButtons();
    const [first, second, third] = [rows[0]!, rows[1]!, rows[2]!];
    first.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(second);
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(third);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(third);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(first);
    expect(onPaintPick).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onPaintPick).toHaveBeenCalledExactlyOnceWith('f1');
  });

  test('choosing the pressed row again clears the pick', async () => {
    mount({ legend: picked(DEFICIT, 'f1') });
    await page.getByRole('button', { name: /^Broca/ }).click();
    expect(onPaintPick).toHaveBeenCalledExactlyOnceWith(null);
    await page.getByRole('button', { name: /^Arcuate/ }).click();
    expect(onPaintPick).toHaveBeenLastCalledWith('f3');
  });

  test('a row stays the same element as its state changes, so focus stays on it', async () => {
    mount({ legend: DEFICIT });
    const row = rowButtons()[0]!;
    row.focus();
    live.legend = picked(DEFICIT, 'f1');
    await vi.waitFor(() => expect(row.getAttribute('aria-pressed')).toBe('true'));
    expect(rowButtons()[0]).toBe(row);
    expect(document.activeElement).toBe(row);
  });

  test('a row that goes leaves focus on the plate’s toggle, a plate that goes on the stage', async () => {
    mount({ legend: DEFICIT });
    rowButtons()[2]!.focus();
    live.legend = { ...DEFICIT, rows: DEFICIT.rows.slice(0, 2) };
    await vi.waitFor(() => expect(document.activeElement).toBe(toggle('Aphasia').element()));
    rowButtons()[1]!.focus();
    live.legend = null;
    live.surfaceColor = 'atlas';
    await vi.waitFor(() => expect(document.activeElement).toBe(find('#viewport')));
  });

  test('a row is its finding: when the focused finding goes, focus does not pass to its neighbour', async () => {
    mount({ legend: DEFICIT });
    rowButtons()[0]!.focus();
    live.legend = { ...DEFICIT, rows: DEFICIT.rows.slice(1) };
    await vi.waitFor(() => expect(document.activeElement).toBe(toggle('Aphasia').element()));
    expect(rowButtons().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Wernicke'),
      expect.stringContaining('Arcuate'),
    ]);
  });

  test('a pick that places focus itself, as opening a profile does, is not preceded by the toggle', async () => {
    const title = document.body.appendChild(document.createElement('h2'));
    title.tabIndex = -1;
    const seen: string[] = [];
    const record = (event: Event) => seen.push((event.target as HTMLElement).className);
    document.addEventListener('focusin', record);
    onPaintPick.mockImplementation(async () => {
      live.legend = { ...DEFICIT, pickable: false };
      await tick();
      title.focus();
    });
    try {
      mount({ legend: DEFICIT });
      rowButtons()[0]!.focus();
      seen.length = 0;
      await userEvent.keyboard('{Enter}');
      await vi.waitFor(() => expect(document.activeElement).toBe(title));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      expect(document.activeElement).toBe(title);
      expect(seen.filter((name) => name.includes('stage-key-toggle'))).toEqual([]);
    } finally {
      document.removeEventListener('focusin', record);
      title.remove();
    }
  });

  test('a key the crowd folds under the focused row hands focus to its toggle', async () => {
    const rows = Array.from({ length: 9 }, (_, i) => finding(`f${i}`, `Finding ${i}`));
    mount({ legend: { ...DEFICIT, rows } }, { height: 400 });
    await expect.element(toggle('Aphasia')).toHaveAttribute('aria-expanded', 'true');
    rowButtons()[4]!.focus();
    // A phone's 44 px rows would take more than half the room the stage leaves.
    live.media.phone = true;
    await expect.element(toggle('Aphasia')).toHaveAttribute('aria-expanded', 'false');
    await vi.waitFor(() => expect(document.activeElement).toBe(toggle('Aphasia').element()));
  });

  test('a z scale, or a single finding, is a plain list: no toolbar and no buttons', async () => {
    mount({ legend: { ...DEFICIT, pickable: false } });
    await expect.element(page.getByRole('list', { name: 'Aphasia' })).toBeVisible();
    expect(
      document.querySelectorAll('[role=toolbar], #paint-key button:not(.stage-key-toggle)'),
    ).toHaveLength(0);
    live.legend = { ...DEFICIT, rows: DEFICIT.rows.slice(0, 1) };
    await vi.waitFor(() => expect(document.querySelectorAll('#paint-key li')).toHaveLength(1));
    expect(document.querySelectorAll('[role=toolbar]')).toHaveLength(0);
  });

  test('a colour the stage does not show is outlined, not filled, and says so to a screen reader', async () => {
    mount({ legend: DEFICIT });
    const absent = swatch('Wernicke');
    const style = getComputedStyle(absent);
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.boxShadow).toContain('inset');
    expect(getComputedStyle(swatch('Broca')).boxShadow).toBe('none');
    // Its name starts with the visible label (2.5.3) and ends with why it is faint (1.4.1).
    const button = page.getByRole('button', { name: /^Wernicke/ });
    expect(button.element().textContent).toMatch(/^\s*Wernicke\s*\.\s*Not shown in this view$/);
    // The visible label is its own element, apart from the hidden words.
    expect(button.element().querySelector('.stage-key-label')!.textContent).toBe('Wernicke');
    expect(page.getByRole('button', { name: 'Broca', exact: true }).element()).toBeTruthy();
    live.lang = 'fr';
    await expect.element(page.getByRole('button', { name: /Absent de cette vue/ })).toBeVisible();
  });

  test('the picked key mutes the rows it stepped back from, and bolds the one in front', async () => {
    mount({ legend: picked(DEFICIT, 'f1') });
    const rows = rowButtons();
    const [first, second] = [rows[0]!, rows[1]!];
    expect(getComputedStyle(first).fontWeight).toBe('600');
    expect(getComputedStyle(second).fontWeight).not.toBe('600');
    expect(getComputedStyle(second).color).toBe('rgb(174, 179, 186)');
    expect(getComputedStyle(first).color).toBe('rgb(241, 242, 244)');
  });
});

describe('the note', () => {
  const note = () => find('#paint-key .stage-key-note');
  const shown = () => note().checkVisibility();

  test('sits under the rows while the key is open on a stage 600 px wide or more', async () => {
    mount({ legend: DEFICIT });
    await expect.element(page.getByText('Each finding names the regions it cites.')).toBeVisible();
  });

  test('is dropped when the key is folded', async () => {
    mount({ legend: DEFICIT });
    await toggle('Aphasia').click();
    await vi.waitFor(() => expect(shown()).toBe(false));
  });

  test('is dropped on a stage narrower than 600 px, and returns when it widens', async () => {
    mount({ legend: DEFICIT });
    stage.setViewport({ x: 0, y: 0, width: 599, height: 800 }, { width: 1200, height: 800 });
    await vi.waitFor(() => expect(shown()).toBe(false));
    stage.setViewport({ x: 0, y: 0, width: 600, height: 800 }, { width: 1200, height: 800 });
    await vi.waitFor(() => expect(shown()).toBe(true));
  });

  test('gives way where the stage leaves the rows too little height', async () => {
    mount({ legend: DEFICIT }, { height: 200 });
    // 200 - 3 * 12 - 38 = 126 px for a plate whose rows alone need 32 + 72 px.
    await vi.waitFor(() => expect(note().hasAttribute('data-clipped')).toBe(true));
    expect(shown()).toBe(false);
  });
});

describe('framing', () => {
  const host = () => find('.stage-keys');

  test('the keys take a band off the framing rectangle, the one that leaves the larger square', async () => {
    mount({ legend: DEFICIT });
    await eventually(() => expect(stage.keyInset.top + stage.keyInset.right).toBeGreaterThan(0));
    const box = host().getBoundingClientRect();
    // 1200 x 800 stage: the column leaves min(1200 - right, 800) and the strip min(1200, 800 - top).
    const top = Math.round(12 + box.height);
    const right = Math.round(12 + box.width);
    const strip = Math.min(1200, 800 - top) >= Math.min(1200 - right, 800);
    expect(stage.keyInset).toEqual(strip ? { top, right: 0 } : { top: 0, right });
    expect(stage.keySize.width).toBeCloseTo(box.width, 1);
    expect(stage.keySize.height).toBeCloseTo(box.height, 1);
  });

  test('a change of the keys’ size reframes once through the dock signal', async () => {
    mount({ legend: DEFICIT }, { width: 390, height: 700 });
    await eventually(() => expect(stage.keyInset.top).toBeGreaterThan(0));
    onDock.mockClear();
    const before = stage.keyInset.top;
    await toggle('Aphasia').click();
    await eventually(() => expect(stage.keyInset.top).toBeLessThan(before));
    expect(onDock).toHaveBeenCalledTimes(1);
  });

  test('the fitting runs on every framing without forcing layout, and reports only what changed', async () => {
    // 390 x 700: the strip leaves the larger square.
    mount({ legend: DEFICIT }, { width: 390, height: 700 });
    await eventually(() => expect(stage.keyInset.top).toBeGreaterThan(0));
    const setKeys = vi.spyOn(stage, 'setKeys');
    const reads = [
      vi.spyOn(Element.prototype, 'getBoundingClientRect'),
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get'),
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get'),
      vi.spyOn(Element.prototype, 'scrollHeight', 'get'),
      vi.spyOn(Element.prototype, 'clientHeight', 'get'),
    ];
    stage.framing();
    stage.framing();
    stage.setViewport({ x: 0, y: 0, width: 380, height: 700 }, { width: 380, height: 700 });
    expect(setKeys).not.toHaveBeenCalled();
    expect(reads.map((read) => read.mock.calls.length)).toEqual([0, 0, 0, 0, 0]);
    // A wide stage moves the band to the right column: that, and only that, is reported.
    stage.setViewport({ x: 0, y: 0, width: 1200, height: 800 }, { width: 1200, height: 800 });
    expect(setKeys).toHaveBeenCalledTimes(1);
    expect(stage.keyInset.right).toBeGreaterThan(0);
    expect(stage.keyInset.top).toBe(0);
    stage.framing();
    expect(setKeys).toHaveBeenCalledTimes(1);
  });

  test('no plate, no band', async () => {
    mount({ legend: DEFICIT });
    await eventually(() => expect(stage.keyInset.top + stage.keyInset.right).toBeGreaterThan(0));
    live.legend = null;
    live.surfaceColor = 'atlas';
    await eventually(() => expect(stage.keyInset).toEqual({ top: 0, right: 0 }));
    expect(stage.keySize).toEqual({ width: 0, height: 0 });
  });

  test('the fitter is let go with the keys', async () => {
    mount({ legend: DEFICIT });
    await eventually(() => expect(stage.keyInset.top + stage.keyInset.right).toBeGreaterThan(0));
    cleanup();
    const setKeys = vi.spyOn(stage, 'setKeys');
    // Were the fitting still registered, this stage would move the band from the column to the strip.
    stage.setViewport({ x: 0, y: 0, width: 390, height: 700 }, { width: 390, height: 700 });
    stage.framing();
    expect(setKeys).not.toHaveBeenCalled();
  });
});

describe('targets, reflow and the stage’s colours', () => {
  const height = (element: Element) => element.getBoundingClientRect().height;

  test('desktop targets: rows and toggle are 24 px; the 20 px level buttons keep WCAG 2.5.8’s spacing exception', async () => {
    mount({ legend: DEFICIT });
    for (const button of [...rowButtons(), find('.stage-key-toggle')]) {
      expect(height(button), button.textContent!).toBeGreaterThanOrEqual(24);
    }
    live.legend = null;
    live.surfaceColor = 'functional';
    await expect.element(page.getByRole('radio', { name: 'Named' })).toBeVisible();
    const radios = [...document.querySelectorAll('[role=radio]')];
    const boxes = radios.map((radio) => radio.getBoundingClientRect());
    for (const box of boxes) expect(box.height).toBeLessThan(24);
    // A 24 px circle on each button's centre reaches neither the other button's circle nor the toggle.
    const centre = (box: DOMRect) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const [a, b] = boxes.map(centre) as [{ x: number; y: number }, { x: number; y: number }];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(24);
    const toggle = find('.stage-key-toggle').getBoundingClientRect();
    const gap = (c: { x: number; y: number }, box: DOMRect) =>
      Math.hypot(
        Math.max(box.left - c.x, 0, c.x - box.right),
        Math.max(box.top - c.y, 0, c.y - box.bottom),
      );
    expect(gap(a, toggle)).toBeGreaterThanOrEqual(12);
    expect(gap(b, toggle)).toBeGreaterThanOrEqual(12);
    expect(gap(a, boxes[1]!)).toBeGreaterThanOrEqual(12);
    expect(gap(b, boxes[0]!)).toBeGreaterThanOrEqual(12);
  });

  test('a coarse pointer makes the level and the paint rows 44 px', async () => {
    mount({ legend: DEFICIT });
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const button of rowButtons()) expect(height(button)).toBeGreaterThanOrEqual(44);
      live.legend = null;
      live.surfaceColor = 'functional';
      await expect.element(page.getByRole('radio', { name: 'Named' })).toBeVisible();
      for (const radio of document.querySelectorAll('[role=radio]')) {
        expect(height(radio)).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('a phone: the title row is 44 px, a deficit’s findings run one to a line, networks two', async () => {
    mount(
      { legend: DEFICIT, media: { phone: true, coarsePointer: false } },
      { width: 390, height: 600 },
    );
    await page.viewport(390, 844);
    try {
      expect(height(find('.stage-key-toggle'))).toBeGreaterThanOrEqual(44);
      const columns = (selector: string) =>
        getComputedStyle(find(selector)).gridTemplateColumns.split(' ').length;
      expect(columns('#paint-key .stage-key-list')).toBe(1);
      live.legend = null;
      await expect.element(toggle('Yeo 7 networks')).toBeVisible();
      expect(columns('#network-key .stage-key-list')).toBe(2);
    } finally {
      await page.viewport(1280, 800);
    }
  });

  test('200 % text and WCAG 1.4.12 spacing: no row is clipped and the plate does not spill', async () => {
    mount({ legend: DEFICIT }, { height: 1600 });
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    document.documentElement.style.fontSize = '200%';
    try {
      const size = parseFloat(getComputedStyle(find('.stage-key-toggle')).fontSize);
      expect(size).toBeGreaterThanOrEqual(24);
      for (const row of document.querySelectorAll('#paint-key li, #paint-key button')) {
        expect(row.scrollHeight, row.textContent!).toBeLessThanOrEqual(row.clientHeight + 1);
        expect(row.scrollWidth, row.textContent!).toBeLessThanOrEqual(row.clientWidth + 1);
      }
      const box = plate('paint');
      expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test('keyboard focus is ringed in the stage’s teal, inside the plate', async () => {
    mount();
    find('#stage-canvas').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(find('.stage-key-toggle'));
    const style = getComputedStyle(find('.stage-key-toggle'));
    expect(style.outlineColor).toBe('rgb(127, 208, 204)');
    expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(parseFloat(style.outlineOffset)).toBeLessThan(0);
  });

  test('forced colours keep every swatch its own colour and the plate a system edge', async () => {
    mount({ legend: DEFICIT });
    const filled = swatch('Broca');
    const own = getComputedStyle(filled).backgroundColor;
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(getComputedStyle(filled).backgroundColor).toBe(own);
      expect(getComputedStyle(plate('paint')).borderTopColor).toBe(
        getComputedStyle(document.body).color,
      );
      expect(getComputedStyle(swatch('Wernicke')).boxShadow).toContain('inset');
    });
  });

  test('axe: the functional plate with the level and the direction key', async () => {
    mount({ surfaceColor: 'functional', directionShown: true });
    await expect.element(page.getByRole('radio', { name: 'Named' })).toBeVisible();
    await expectAxeClean();
  });

  test('axe: a paint with a pick, a faint finding and its note', async () => {
    mount({ legend: picked(DEFICIT, 'f1') });
    await expect.element(page.getByRole('toolbar', { name: 'Aphasia' })).toBeVisible();
    await expectAxeClean();
  });
});
