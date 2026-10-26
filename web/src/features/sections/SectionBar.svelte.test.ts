// The Section popover and the section row against legacy ui/chrome/sections.js, stage-tools.js and stage.css,
// the APG Toolbar, Slider, Spinbutton and Disclosure patterns and WCAG 2.2 (1.4.4, 2.1.1, 2.4.3, 2.5.3, 2.5.8,
// 3.3.1, 4.1.3), inside G2's dock over the fake engine in a real browser. The controller's queue, overtaking
// and busy rules are proved in section-controls.test.ts; here what the reader sees, hears and presses.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';
import { flushSync } from 'svelte';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createEngineSync } from '../../lib/state/engine-sync.svelte.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { CutMode, Language, Manifest, Paint, SurfaceColor } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { createSectionControls } from './section-controls.svelte.ts';
import type { SectionControls, SectionControlsDeps } from './section-controls.svelte.ts';
import Fixture from './sections-test-support.svelte';

const published = manifest as unknown as Manifest;

interface Live {
  lang: Language;
  phone: boolean;
  tractReference: boolean;
  view: { surfaceColor: SurfaceColor; paint: Paint | null };
}

let engine: FakeEngine;
let stage: StageLayout;
let controls: SectionControls;
let live: Live;
let cut: Mock<(plane: CutMode, current: () => boolean) => Promise<boolean>>;
let openLinkedMri: Mock<SectionControlsDeps['openLinkedMri']>;
let cleanups: (() => void)[];

function liveState(overrides: Partial<Live>): Live {
  const state = $state<Live>({
    lang: 'en',
    phone: false,
    tractReference: false,
    view: { surfaceColor: 'atlas', paint: null },
    ...overrides,
  });
  return state;
}

async function mount(
  overrides: Partial<Live> = {},
  { width = 900, height = 600 }: { width?: number; height?: number } = {},
) {
  engine = createFakeEngine({ manifest: published, hostSize: { width, height } });
  live = liveState(overrides);
  cut = vi.fn(async (plane: CutMode) => {
    await engine.sections.setMode(plane);
    return true;
  });
  openLinkedMri = vi.fn(async () => {});
  cleanups.push(
    $effect.root(() => {
      stage = createStageLayout({
        media: {
          get phone() {
            return live.phone;
          },
        },
      });
      const engineState = createEngineSync(engine);
      controls = createSectionControls({
        engine,
        engineState,
        commands: { begin: () => () => true, cut },
        session: { setView: () => true },
        openLinkedMri,
      });
    }),
  );
  const result = await render(Fixture, { engine, stage, controls, live, width, height });
  stage.setGutter(20);
  stage.setViewport(engine.camera.visibleRect, engine.camera.hostSize);
  flushSync();
  return result;
}

/** A plane cut as the controller cuts it, with the row up. */
async function cutPlane(plane: CutMode) {
  await controls.choose(plane);
  flushSync();
}

const locate = (
  role: 'button' | 'slider' | 'spinbutton' | 'checkbox' | 'group' | 'toolbar',
  name: string,
) => page.getByRole(role, { name, exact: true });
const control = (role: Parameters<typeof locate>[0], name: string) =>
  locate(role, name).element() as HTMLElement;
const tool = (name: string) => control('button', name);
const bar = () => document.querySelector<HTMLElement>('.section-bar')!;
const group = () => bar().querySelector<HTMLElement>('[role="group"]');
const said = () => bar().querySelector('[role="status"] .visually-hidden')!.textContent;
const shown = () =>
  bar().querySelector('[role="status"] [aria-hidden="true"]')?.textContent ?? null;
const position = () => bar().querySelector<HTMLInputElement>('input[type="range"]')!;
const exact = () => bar().querySelector<HTMLInputElement>('input[type="number"]')!;
const active = () => document.activeElement;

async function openSection() {
  tool('Section').focus();
  await userEvent.keyboard('{Enter}');
  await vi.waitFor(() => expect(tool('Section').getAttribute('aria-expanded')).toBe('true'));
}

/** Types into the exact field and commits it, as Enter does. */
async function typeExact(text: string) {
  exact().focus();
  await userEvent.clear(exact());
  if (text) await userEvent.type(exact(), text);
  await userEvent.keyboard('{Enter}');
  flushSync();
}

beforeEach(async () => {
  cleanups = [];
  await page.viewport(1280, 800);
});

afterEach(async () => {
  cleanup();
  for (const stop of cleanups.splice(0)) stop();
  await page.viewport(1280, 800);
});

describe('the Section popover', () => {
  test('offers five planes as a labelled toolbar of toggles, Full brain pressed and focused', async () => {
    await mount();
    await openSection();
    const planes = locate('toolbar', 'Cutting plane');
    const buttons = planes.getByRole('button').elements() as HTMLElement[];
    expect(buttons.map((button) => button.textContent!.trim())).toEqual([
      'Full brain',
      'Sagittal',
      'Coronal',
      'Axial',
      'Oblique',
    ]);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(active()).toBe(buttons[0]);
    // The names are the words; nothing repeats them as a tooltip (g4-label-in-name).
    expect(buttons.some((button) => button.hasAttribute('title'))).toBe(false);
  });

  test('the arrows only move; Enter chooses, closes the popover and gives focus back to the Section tool', async () => {
    await mount();
    await openSection();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(active()).toBe(control('button', 'Coronal'));
    expect(cut).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(tool('Section').getAttribute('aria-expanded')).toBe('false'));
    expect(active()).toBe(tool('Section'));
    expect(cut.mock.calls.map(([plane]) => plane)).toEqual(['coronal']);
    await vi.waitFor(() => expect(group()?.getAttribute('aria-label')).toBe('Coronal section'));
  });

  test('a pointer choice of the plane on screen closes the popover and cuts nothing', async () => {
    await mount();
    await cutPlane('axial');
    await locate('button', 'Section').click();
    await locate('button', 'Axial').click();
    await vi.waitFor(() => expect(tool('Section').getAttribute('aria-expanded')).toBe('false'));
    expect(cut.mock.calls.map(([plane]) => plane)).toEqual(['axial']);
  });

  test('the chosen plane is pressed while its anatomy is prepared, and the row names it with nothing to move', async () => {
    await mount();
    let land!: (kept: boolean) => void;
    cut.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    await openSection();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    flushSync();
    expect(bar().dataset.pending).toBe('true');
    expect(group()!.getAttribute('aria-label')).toBe('Sagittal section');
    expect(group()!.querySelectorAll('input')).toHaveLength(0);
    expect(
      [...group()!.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Close section and show the full brain']);
    await openSection();
    expect(control('button', 'Sagittal').getAttribute('aria-pressed')).toBe('true');
    await userEvent.keyboard('{Escape}');
    await engine.sections.setMode('sagittal');
    land(true);
    await vi.waitFor(() => expect(bar().dataset.pending).toBe('false'));
    expect(position()).not.toBeNull();
  });

  test('on a phone the planes show short names and keep the full ones as their names', async () => {
    await page.viewport(390, 844);
    await mount({ phone: true }, { width: 390, height: 700 });
    await openSection();
    const sagittal = control('button', 'Sagittal');
    expect(sagittal.textContent!.trim()).toBe('Sag');
    expect(sagittal.offsetHeight).toBeGreaterThanOrEqual(44);
    expect(
      getComputedStyle(locate('toolbar', 'Cutting plane').element()).gridTemplateColumns.split(' '),
    ).toHaveLength(5);
  });

  test('Cut labels names each published label set; a choice that fails returns to the labels still cut', async () => {
    await mount();
    await cutPlane('axial');
    await openSection();
    const select = page.getByRole('combobox', { name: 'Cut labels' });
    const element = select.element() as HTMLSelectElement;
    expect([...element.options].map((option) => option.value)).toEqual([
      'destrieux',
      'hcp-mmp',
      'nextbrain',
    ]);
    expect(element.value).toBe('destrieux');
    await select.selectOptions('hcp-mmp');
    await vi.waitFor(() => expect(controls.state.cutAtlas).toBe('hcp-mmp'));

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(engine.sections, 'setCutAtlas').mockRejectedValueOnce(new Error('offline'));
    await select.selectOptions('nextbrain');
    await vi.waitFor(() => expect(element.value).toBe('hcp-mmp'));
    expect(said()).toBe('Could not prepare the section.');
  });

  test('is French in French', async () => {
    await mount({ lang: 'fr' });
    tool('Coupe').focus();
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(locate('toolbar', 'Plan de coupe').element()).toBeTruthy());
    expect(control('button', 'Cerveau entier').getAttribute('aria-pressed')).toBe('true');
    expect(page.getByRole('combobox', { name: 'Étiquettes de coupe' }).element()).toBeTruthy();
  });
});

describe('the section row', () => {
  test('is a group named by the plane, inside the dock after its tools, with its slider named by the axis', async () => {
    await mount();
    expect(group()).toBeNull();
    await cutPlane('sagittal');
    expect(group()!.getAttribute('aria-label')).toBe('Sagittal section');
    const dock = document.querySelector('.stage-dock')!;
    expect(bar().parentElement).toBe(dock);
    expect(dock.querySelector('.stage-toolbar')!.compareDocumentPosition(bar())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // Drawn above the tools (stage.css:325).
    expect(bar().getBoundingClientRect().bottom).toBeLessThanOrEqual(
      dock.querySelector('.stage-toolbar')!.getBoundingClientRect().top + 0.5,
    );
    const slider = control('slider', 'R coordinate (mm): − left / + right');
    expect(slider).toBe(position());
    expect([
      slider.getAttribute('min'),
      slider.getAttribute('max'),
      slider.getAttribute('step'),
    ]).toEqual(['-128', '128', '0.5']);
    expect(slider.getAttribute('aria-valuetext')).toBe('0.0 mm');
    expect(control('spinbutton', 'Exact cut position in millimetres')).toBe(exact());
    const ends = [...bar().querySelectorAll('.cut-end')];
    expect(ends.map((end) => [end.textContent, end.getAttribute('aria-hidden')])).toEqual([
      ['L', 'true'],
      ['R', 'true'],
    ]);
    expect(shown()).toBe('1 mm source grid · native Destrieux labels');
  });

  test('in French the ends are G and D and the position is said with a comma', async () => {
    await mount({ lang: 'fr' });
    await cutPlane('sagittal');
    controls.setOffset(-12.5);
    flushSync();
    expect([...bar().querySelectorAll('.cut-end')].map((end) => end.textContent)).toEqual([
      'G',
      'D',
    ]);
    expect(position().getAttribute('aria-valuetext')).toBe('−12,5 mm');
    expect(said()).toMatch(/^Coupe tissulaire à −12,5 mm/);
  });

  test('the slider builds the cut as it moves; the sentence waits until the slider is left', async () => {
    await mount();
    await cutPlane('axial');
    const before = said();
    position().focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await vi.waitFor(() => expect(controls.offset).toBe(1));
    expect(position().getAttribute('aria-valuetext')).toBe('+1.0 mm');
    expect(exact().value).toBe('1.0');
    expect(said()).toBe(before);
    await userEvent.keyboard('{Tab}');
    await vi.waitFor(() => expect(said()).toMatch(/^Tissue cut at \+1\.0 mm/));
  });

  test('the slider keeps the reader’s value while they hold it, and catches up when left', async () => {
    await mount();
    await cutPlane('axial');
    position().focus();
    controls.setOffset(20);
    flushSync();
    expect(position().value).toBe('0');
    position().blur();
    flushSync();
    expect(position().value).toBe('20');
  });

  test('the exact field: empty puts the position back without moving the cut; valid values move it', async () => {
    await mount();
    await cutPlane('axial');
    controls.setOffset(37.5);
    flushSync();
    const setOffset = vi.spyOn(engine.sections, 'setOffset');
    await typeExact('');
    expect(setOffset).not.toHaveBeenCalled();
    expect(exact().value).toBe('37.5');
    for (const value of ['-12.5', '0', '18.75']) await typeExact(value);
    expect(setOffset.mock.calls).toEqual([[-12.5], [0], [18.75]]);
  });

  test('the exact field explains a value outside the range and does not apply it', async () => {
    await mount();
    await cutPlane('axial');
    const setOffset = vi.spyOn(engine.sections, 'setOffset');
    await typeExact('900');
    expect(setOffset).not.toHaveBeenCalled();
    const field = exact();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(field.getAttribute('aria-describedby')!)!;
    expect(message.textContent).toBe('Enter a position from −128 to 128 mm.');
    expect(message.checkVisibility()).toBe(true);
    // Kept for correcting, also once the field is left.
    await userEvent.keyboard('{Tab}');
    expect(field.value).toBe('900');
    await typeExact('12');
    expect(field.getAttribute('aria-invalid')).toBe('false');
    expect(field.hasAttribute('aria-describedby')).toBe(false);
    expect(setOffset.mock.calls).toEqual([[12]]);
  });

  test('Reverse side is named by its words and keeps the other half', async () => {
    await mount();
    await cutPlane('coronal');
    const reverse = control('checkbox', 'Reverse side');
    await userEvent.click(reverse);
    await vi.waitFor(() => expect(controls.state.reverse).toBe(true));
    expect(reverse.closest('[data-tooltip]')!.getAttribute('data-tooltip')).toBe(
      'Reverse retained side',
    );
  });

  test('Linked MRI is named by its words, has M, opens at once from the keyboard and waits while it loads', async () => {
    await mount();
    await cutPlane('axial');
    const opener = control('button', 'Linked MRI');
    expect(opener.getAttribute('aria-keyshortcuts')).toBe('M');
    let loaded!: () => void;
    openLinkedMri.mockImplementationOnce(() => new Promise<void>((resolve) => (loaded = resolve)));
    opener.focus();
    await userEvent.keyboard('{Enter}');
    flushSync();
    expect(opener.getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(openLinkedMri.mock.calls).toEqual([[{ instant: true }]]);
    loaded();
    await vi.waitFor(() => expect(opener.hasAttribute('aria-disabled')).toBe(false));
    await locate('button', 'Linked MRI').click();
    expect(openLinkedMri.mock.calls).toEqual([[{ instant: true }], [{ instant: false }]]);
  });

  test('Close hands focus to the Section tool at once, and the closed section is still said', async () => {
    await mount();
    await cutPlane('axial');
    let restored!: () => void;
    const setMode = engine.sections.setMode.bind(engine.sections);
    vi.spyOn(engine.sections, 'setMode').mockImplementationOnce(
      (mode) => new Promise<void>((resolve) => (restored = () => resolve(setMode(mode)))),
    );
    control('button', 'Close section and show the full brain').focus();
    await userEvent.keyboard('{Enter}');
    // Before the whole brain is back and the row goes (sections.js:239-241).
    expect(group()).not.toBeNull();
    expect(active()).toBe(tool('Section'));
    restored();
    await vi.waitFor(() => expect(group()).toBeNull());
    expect(controls.state.mode).toBe('off');
    const status = bar().querySelector('[role="status"]')!;
    expect(status.isConnected).toBe(true);
    expect(said()).toBe('Full brain · no cut');
  });

  test('focus inside the row goes to the Section tool when the cut is closed elsewhere', async () => {
    await mount();
    await cutPlane('axial');
    position().focus();
    await engine.sections.setMode('off');
    flushSync();
    expect(group()).toBeNull();
    expect(active()).toBe(tool('Section'));
  });

  test('over the tract reference the row goes and focus inside it goes to the dock’s first tool', async () => {
    await mount();
    await cutPlane('axial');
    exact().focus();
    live.tractReference = true;
    flushSync();
    expect(group()).toBeNull();
    expect(active()).toBe(document.querySelector('.stage-tool'));
    expect((active() as HTMLElement).checkVisibility()).toBe(true);
  });

  test('an oblique cut adds tilt and azimuth sliders, named by their words, in degrees', async () => {
    await mount();
    await cutPlane('oblique');
    const tilt = control('slider', 'Tilt');
    const azimuth = control('slider', 'Azimuth');
    expect(tilt.getAttribute('aria-valuetext')).toBe('30°');
    expect(azimuth.getAttribute('aria-valuetext')).toBe('+30°');
    expect(azimuth.closest('[data-tooltip]')!.getAttribute('data-tooltip')).toBe(
      'Rotation around superior axis',
    );
    expect([...bar().querySelectorAll('.cut-end')].map((end) => end.textContent)).toEqual([
      '−',
      '+',
    ]);
    azimuth.focus();
    await userEvent.keyboard('{End}');
    await vi.waitFor(() => expect(controls.state.azimuth).toBe(180));
    expect(azimuth.getAttribute('aria-valuetext')).toBe('+180°');
    expect(controls.state.tilt).toBe(30);
  });
});

describe('the compact row', () => {
  test('writes its one-line width to the stage layout, again in French, and nothing once gone', async () => {
    await mount({}, { width: 1280, height: 700 });
    expect(stage.sectionNeed).toBe(0);
    await cutPlane('coronal');
    const dock = document.querySelector<HTMLElement>('.stage-dock')!;
    // On a stage with room the dock is the row's own width, which is what was measured.
    await vi.waitFor(() => expect(stage.sectionNeed).toBeGreaterThan(0));
    expect(bar().dataset.compact).toBe('false');
    expect(stage.sectionNeed).toBe(dock.offsetWidth);
    const english = stage.sectionNeed;
    live.lang = 'fr';
    flushSync();
    await vi.waitFor(() => expect(stage.sectionNeed).not.toBe(english));
    expect(stage.sectionNeed).toBe(dock.offsetWidth);
    await controls.close();
    flushSync();
    expect(stage.sectionNeed).toBe(0);
  });

  test('is measured whole while it is folded, so it unfolds once the stage has room', async () => {
    await mount({}, { width: 1280, height: 600 });
    // The sheet or a key band leaves 560 px of the stage in sight.
    stage.setViewport({ x: 0, y: 0, width: 560, height: 600 }, { width: 1280, height: 600 });
    await cutPlane('coronal');
    await vi.waitFor(() => expect(bar().dataset.compact).toBe('true'));
    // New words are measured while the row is folded.
    const english = stage.sectionNeed;
    live.lang = 'fr';
    flushSync();
    await vi.waitFor(() => expect(stage.sectionNeed).not.toBe(english));
    const folded = stage.sectionNeed;
    expect(bar().dataset.compact).toBe('true');
    stage.setViewport({ x: 0, y: 0, width: 1280, height: 600 }, { width: 1280, height: 600 });
    flushSync();
    expect(bar().dataset.compact).toBe('false');
    // Unfolded, the dock is exactly the width measured while folded.
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLElement>('.stage-dock')!.offsetWidth).toBe(folded),
    );
    expect(stage.sectionNeed).toBe(folded);
  });

  test('where one line would not fit, Reverse side and Linked MRI fold behind More', async () => {
    await mount({}, { width: 560, height: 600 });
    await cutPlane('coronal');
    await vi.waitFor(() => expect(bar().dataset.compact).toBe('true'));
    const more = control('button', 'More section controls');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(more.getAttribute('aria-controls')!)!.checkVisibility()).toBe(
      false,
    );
    expect(page.getByRole('checkbox', { name: 'Reverse side' }).query()).toBeNull();
    more.focus();
    await userEvent.keyboard('{Enter}');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(control('checkbox', 'Reverse side').checkVisibility()).toBe(true);
    // The row stays inside the stage.
    const dock = document.querySelector('.stage-dock')!.getBoundingClientRect();
    expect(dock.right).toBeLessThanOrEqual(560);
  });

  test('a row that folds with focus in its details hands focus to More', async () => {
    await mount({}, { width: 900, height: 600 });
    await cutPlane('coronal');
    await vi.waitFor(() => expect(bar().dataset.compact).toBe('false'));
    control('checkbox', 'Reverse side').focus();
    stage.setViewport({ x: 0, y: 0, width: 500, height: 600 }, { width: 900, height: 600 });
    flushSync();
    expect(bar().dataset.compact).toBe('true');
    await vi.waitFor(() => expect(active()).toBe(control('button', 'More section controls')));
  });

  test('a phone always folds the row, under the plane’s short name', async () => {
    await page.viewport(390, 844);
    await mount({ phone: true }, { width: 390, height: 700 });
    await cutPlane('sagittal');
    expect(bar().dataset.compact).toBe('true');
    const name = bar().querySelector('.section-bar-name')!;
    expect(name.querySelector('.section-bar-full')!.checkVisibility()).toBe(false);
    expect(name.querySelector('.section-bar-short')!.textContent).toBe('Sag');
    // The dock takes the stage's width less its gutters (stage.css:621).
    const dock = document.querySelector<HTMLElement>('.stage-dock')!;
    const gutter = parseFloat(getComputedStyle(dock).getPropertyValue('--stage-gutter'));
    expect(dock.getBoundingClientRect().width).toBeCloseTo(390 - 2 * gutter, 0);
  });
});

describe('size and media', () => {
  const targets = () =>
    [...bar().querySelectorAll<HTMLElement>('button, input, label.check')]
      .filter(
        (node) =>
          node.checkVisibility() && !(node instanceof HTMLInputElement && node.type === 'checkbox'),
      )
      .map((node) => ({
        name: node.getAttribute('aria-label') ?? node.textContent!.trim() ?? node.tagName,
        box: node.getBoundingClientRect(),
      }));

  test('every control is 24 px tall, and 44 px on a coarse pointer', async () => {
    await mount();
    await cutPlane('oblique');
    for (const { name, box } of targets()) expect(box.height, name).toBeGreaterThanOrEqual(24);
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const { name, box } of targets()) expect(box.height, name).toBeGreaterThanOrEqual(44);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('forced colours draw the sliders and the tick box in system colours', async () => {
    await mount();
    await cutPlane('axial');
    const resolve = (colour: string) => {
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.color = colour;
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(getComputedStyle(position()).forcedColorAdjust).toBe('none');
      expect(getComputedStyle(position(), '::-webkit-slider-thumb').borderTopColor).toBe(
        resolve('CanvasText'),
      );
      const box = bar().querySelector<HTMLElement>('input[type="checkbox"]')!;
      expect(getComputedStyle(box).appearance).toBe('auto');
    });
  });

  test.each(['en', 'fr'] as const)(
    '%s: axe finds nothing with the row, its error and the popover open',
    async (lang) => {
      await mount({ lang });
      await cutPlane('oblique');
      await typeExact('900');
      await expectAxeClean();
      tool(lang === 'fr' ? 'Coupe' : 'Section').focus();
      await userEvent.keyboard('{Enter}');
      await vi.waitFor(() => expect(document.querySelector('.cut-mode')).not.toBeNull());
      await expectAxeClean();
    },
  );

  test('axe finds nothing in the folded and unfolded phone row', async () => {
    await page.viewport(390, 844);
    await mount({ phone: true }, { width: 390, height: 700 });
    await cutPlane('coronal');
    await expectAxeClean();
    control('button', 'More section controls').click();
    flushSync();
    await expectAxeClean();
  });
});
