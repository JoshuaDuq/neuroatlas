// The Linked MRI dialog over the fake engine in a real browser: what the reader gets from the three
// planes, the keyboard and the pointer, the phone's one-plane mode, the live region and the saved
// PNG. Each test states one rule with fixed expected values; the legacy viewer is not imported
// (decision on #4, 2026-10-26). The engine's own maths are proved in mpr-dialog.test.ts.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createEngineSync } from '../../lib/state/engine-sync.svelte.ts';
import type { Language, Manifest } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { createMprDialog } from './mpr-dialog.svelte.ts';
import type { MprDialogController } from './mpr-dialog.svelte.ts';
import Fixture from './mpr-test-support.svelte';

const SIZE = 128;
const anatomy = { subject: 'sub_013', individual: true };

let engine: FakeEngine;
let mpr: MprDialogController;
let live: { lang: Language };
let announced: string[];
let watcher: MutationObserver | undefined;

function liveState(): { lang: Language } {
  const state = $state<{ lang: Language }>({ lang: 'en' });
  return state;
}

beforeEach(async () => {
  await page.viewport(1280, 900);
  engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    mri: { fieldOfView: 256, size: SIZE, windowCenter: 90, windowWidth: 180 },
  });
  live = liveState();
  mpr = createMprDialog({
    engine,
    select: () => {},
  });
  announced = [];
});
afterEach(() => {
  mpr.dispose();
  watcher?.disconnect();
  vi.restoreAllMocks();
  cleanup();
});

async function mount() {
  const result = await render(Fixture, {
    engine,
    engineState: createEngineSync(engine),
    mpr,
    live,
    anatomy,
  });
  // What the dialog's live region is made to say, in order.
  const status = statusRegion();
  watcher = new MutationObserver(() => {
    if (status.textContent) announced.push(status.textContent);
  });
  watcher.observe(status, { childList: true, characterData: true, subtree: true });
  return result;
}

const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
const statusRegion = () => document.querySelector('dialog [role="status"]') as HTMLElement;
const opener = () => page.getByRole('button', { name: 'Linked MRI' }).element() as HTMLElement;
const section = (plane: string) =>
  dialog().querySelector<HTMLElement>(`.plane[data-plane="${plane}"]`)!;
const canvas = (plane: string) => section(plane).querySelector('canvas')!;
const slider = (name: string) => page.getByRole('slider', { name, exact: true });
const sliderElement = (name: string) => slider(name).element() as HTMLInputElement;
const crosshair = () => engine.sections.state.crosshair;
const calls = (method: string) =>
  engine.calls.filter((call) => call.domain === 'sections' && call.method === method);

/** Keyboard open, as Enter on the opener does; waits for the dialog. */
async function openFromKeyboard() {
  opener().focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => dialog().open).toBe(true);
}

async function opened() {
  await mount();
  await openFromKeyboard();
}

/** A frame later: the moves a slider makes are coalesced to one a frame. */
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function pixel(plane: string, x: number, y: number) {
  const context = canvas(plane).getContext('2d')!;
  return [...context.getImageData(x, y, 1, 1).data];
}

describe('opening and closing', () => {
  test('is a modal named for what it shows, with Close the first stop', async () => {
    await opened();
    await expect.element(page.getByRole('dialog', { name: 'Linked MRI sections' })).toBeVisible();
    expect(document.activeElement).toBe(page.getByRole('button', { name: 'Close' }).element());
  });

  test('Escape closes it at once and focus returns to the button that opened it', async () => {
    await opened();
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => dialog().open).toBe(false);
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    await expect.poll(() => document.activeElement).toBe(opener());
  });

  test('a keyboard opening has no transition; a pointer opening does', async () => {
    await mount();
    await openFromKeyboard();
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => dialog().open).toBe(false);
    await page.getByRole('button', { name: 'Linked MRI' }).click();
    await expect.poll(() => dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-instant')).toBe(false);
  });

  test('is not dismissed by a click on the backdrop', async () => {
    await opened();
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await frame();
    expect(dialog().open).toBe(true);
  });

  test('the Close button closes it', async () => {
    await opened();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => dialog().open).toBe(false);
  });
});

describe('the three planes', () => {
  test('each plane is a named section with a picture, a position slider and its own Save button', async () => {
    await opened();
    for (const [plane, label] of [
      ['sagittal', 'Sagittal'],
      ['coronal', 'Coronal'],
      ['axial', 'Axial'],
    ] as const) {
      await expect.element(page.getByRole('region', { name: label })).toBeVisible();
      await expect.element(slider(`${label} position`)).toBeVisible();
      await expect
        .element(page.getByRole('button', { name: `Save PNG, ${plane}`, exact: true }))
        .toBeVisible();
      await expect
        .element(page.getByRole('img', { name: new RegExp(`^${label} MRI\\.`) }))
        .toBeVisible();
    }
  });

  test('a picture is an image, not a control: it takes no focus and has no key handler of its own', async () => {
    await opened();
    expect(canvas('axial').tabIndex).toBe(-1);
    // Arrow keys on a picture leave the crosshair alone (the slider is the keyboard route).
    canvas('axial').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await frame();
    expect(crosshair()).toEqual([0, 0, 0]);
  });

  test("Tab visits Close, then each plane's slider and Save, then Window, Level and the overlay", async () => {
    await opened();
    const nameOf = (element: HTMLElement) =>
      (element as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
      element.getAttribute('aria-label') ??
      element.textContent!.trim();
    const names: string[] = [];
    for (let stop = 0; stop < 10; stop++) {
      names.push(nameOf(document.activeElement as HTMLElement));
      await userEvent.tab();
    }
    expect(names).toEqual([
      'Close',
      'Sagittal position',
      'Save PNG, sagittal',
      'Coronal position',
      'Save PNG, coronal',
      'Axial position',
      'Save PNG, axial',
      'Window',
      'Level',
      'Segmentation overlay',
    ]);
  });
});

describe('moving the crosshair', () => {
  test("a position slider's arrows move one millimetre along its own axis, and its value is read in signed mm", async () => {
    await opened();
    sliderElement('Sagittal position').focus();
    await userEvent.keyboard('{ArrowRight}');
    await frame();
    await frame();
    expect(crosshair()).toEqual([1, 0, 0]);
    expect(sliderElement('Sagittal position').getAttribute('aria-valuetext')).toMatch(
      /^\+1\.0.mm$/,
    );
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await frame();
    await frame();
    expect(crosshair()).toEqual([-1, 0, 0]);
  });

  test('PageUp takes a larger step than an arrow, Home and End go to the ends of the range', async () => {
    await opened();
    sliderElement('Axial position').focus();
    await userEvent.keyboard('{PageUp}');
    await frame();
    await frame();
    // The browser's own page step (a tenth of the range in Chromium).
    expect(crosshair()[2]).toBeGreaterThan(1);
    expect(crosshair()[2]).toBeLessThanOrEqual(26);
    await userEvent.keyboard('{End}');
    await frame();
    await frame();
    expect(crosshair()[2]).toBe(128);
    await userEvent.keyboard('{Home}');
    await frame();
    await frame();
    expect(crosshair()[2]).toBe(-128);
  });

  test("the other planes' sliders follow a move made on one", async () => {
    await opened();
    sliderElement('Sagittal position').focus();
    await userEvent.keyboard('{PageUp}');
    await frame();
    await frame();
    // A different plane's slider shows the shared crosshair on its own axis, unaffected.
    expect(sliderElement('Axial position').value).toBe('0');
    engine.sections.setCrosshair([10, 20, 30]);
    await expect.poll(() => sliderElement('Coronal position').value).toBe('20');
    expect(sliderElement('Axial position').value).toBe('30');
  });

  test('a position slider that has focus still shows the crosshair when the wheel moves it', async () => {
    await opened();
    sliderElement('Axial position').focus();
    for (let notch = 0; notch < 3; notch++) {
      canvas('axial').dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }),
      );
    }
    await expect.poll(() => sliderElement('Axial position').value).toBe('3');
    expect(sliderElement('Axial position').getAttribute('aria-valuetext')).toMatch(/^\+3\.0.mm$/);
    await userEvent.keyboard('{ArrowUp}');
    await frame();
    await frame();
    expect(crosshair()[2]).toBe(4);
  });

  test('a click on a picture puts the crosshair under it, in that plane', async () => {
    await opened();
    const box = canvas('axial').getBoundingClientRect();
    canvas('axial').dispatchEvent(
      new MouseEvent('click', {
        clientX: box.left + box.width * 0.75,
        clientY: box.top + box.height * 0.25,
        bubbles: true,
      }),
    );
    // A quarter of the 256 mm field across and up, to the pixel the pointer event can report.
    expect(crosshair()[0]).toBeCloseTo(64, -0.5);
    expect(crosshair()[1]).toBeCloseTo(64, -0.5);
    expect(crosshair()[2]).toBe(0);
  });

  test('the wheel over a picture moves one millimetre a notch and keeps the page still', async () => {
    await opened();
    const event = new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true });
    canvas('coronal').dispatchEvent(event);
    expect(crosshair()).toEqual([0, -1, 0]);
    expect(event.defaultPrevented).toBe(true);
  });

  test("Ctrl and Meta with the wheel are the browser's zoom: the picture does not take them", async () => {
    await opened();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      const event = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
        ...modifier,
      });
      canvas('coronal').dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(crosshair()).toEqual([0, 0, 0]);
  });

  test('the wheel at the end of the range is left to the page, so the dialog can still scroll', async () => {
    await opened();
    engine.sections.setCrosshair([0, 0, 128]);
    const event = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    canvas('axial').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(crosshair()).toEqual([0, 0, 128]);
  });
});

describe('display', () => {
  test("Window and Level start at the scan's window and their arrows step by one", async () => {
    await opened();
    expect(sliderElement('Window').value).toBe('180');
    expect(sliderElement('Level').value).toBe('90');
    sliderElement('Window').focus();
    await userEvent.keyboard('{ArrowRight}');
    await frame();
    await frame();
    expect(engine.sections.display).toMatchObject({ windowWidth: 181, windowCenter: 90 });
    sliderElement('Level').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await frame();
    await frame();
    expect(engine.sections.display).toMatchObject({ windowWidth: 181, windowCenter: 89 });
  });

  test("the segmentation overlay is a checkbox that sets the sections' overlay", async () => {
    await opened();
    const box = page.getByRole('checkbox', { name: 'Segmentation overlay' });
    await box.click();
    expect(engine.sections.state.overlay).toBe(true);
    await box.click();
    expect(engine.sections.state.overlay).toBe(false);
  });
});

describe('the pictures', () => {
  test("draw the slice at the scan's resolution with the crosshair over it", async () => {
    await mount();
    engine.sections.setCrosshair([1, 1, 0]);
    await openFromKeyboard();
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    // 1 mm of a 256 mm field on 128 pixels: the crosshair is the single column 64, ringed in dark.
    await expect.poll(() => pixel('axial', 64, 40)).toEqual([79, 182, 224, 255]);
    expect(pixel('axial', 63, 40)).toEqual([14, 17, 22, 255]);
    expect(pixel('axial', 65, 40)).toEqual([14, 17, 22, 255]);
  });

  test('every voxel is shown, however the segmentation covers it', async () => {
    // Voxels no label covers come back transparent; the picture still shows their intensity.
    vi.spyOn(engine.sections, 'pixels').mockImplementation(
      () => new Uint8ClampedArray(SIZE * SIZE * 4),
    );
    await opened();
    await expect.poll(() => canvas('sagittal').width).toBe(SIZE);
    expect(pixel('sagittal', 5, 5)[3]).toBe(255);
  });

  test("letter the edges and the plane's offset in the reader's language, right and left as D and G in French", async () => {
    const drawn: string[] = [];
    vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText').mockImplementation((text) => {
      drawn.push(text);
    });
    await mount();
    engine.sections.setCrosshair([0, 0, 12.5]);
    await openFromKeyboard();
    await expect.poll(() => drawn.length).toBeGreaterThanOrEqual(15);
    const axial = drawn.slice(-5);
    expect(axial).toEqual(['A', 'R', 'P', 'L', 'Axial +12.5 mm']);
    drawn.length = 0;
    live.lang = 'fr';
    await expect.poll(() => drawn.length).toBeGreaterThanOrEqual(15);
    expect(drawn.slice(-5)).toEqual(['A', 'D', 'P', 'G', 'Axial +12,5 mm']);
  });

  test('a change that leaves the picture as it was does not resample it', async () => {
    await opened();
    await expect.poll(() => calls('pixels').length).toBe(3);
    // The cut atlas is not part of the picture.
    await engine.sections.setCutAtlas(engine.sections.state.cutAtlas);
    engine.sections.setDisplay({ reverse: true });
    await frame();
    await frame();
    expect(calls('pixels')).toHaveLength(3);
    engine.sections.setCrosshair([3, 0, 0]);
    await expect.poll(() => calls('pixels').length).toBe(6);
  });
});

describe('the readout', () => {
  test('shows where the crosshair is and what is under it, at once', async () => {
    await opened();
    expect(dialog().querySelector('.where')!.textContent).toBe(
      '0.0, 0.0, 0.0 mm — Unlabelled (label 0)',
    );
    engine.sections.setCrosshair([1, -2, 3.5]);
    await expect
      .poll(() => dialog().querySelector('.where')!.textContent)
      .toBe('+1.0, −2.0, +3.5 mm — label-1 (label 1)');
  });

  test("is in the reader's language", async () => {
    await opened();
    engine.sections.setCrosshair([1, -2, 3.5]);
    live.lang = 'fr';
    await expect
      .poll(() => dialog().querySelector('.where')!.textContent)
      .toBe('+1,0 ; −2,0 ; +3,5 mm — label-1 (étiquette 1)');
  });

  test('is said once the crosshair has rested, and not at all on opening', async () => {
    await opened();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(announced).toEqual([]);
    // Four moves inside the quiet period, whatever the machine's speed.
    for (const x of [1, 2, 3, 4]) {
      engine.sections.setCrosshair([x, 0, 0]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await expect.poll(() => announced.length, { timeout: 2000 }).toBe(1);
    expect(announced).toEqual(['+4.0, 0.0, 0.0\u202fmm — Unlabelled (label 0)']);
  });

  test('is the only live region in the page that can be heard: exactly one, inside the dialog, polite', async () => {
    await opened();
    const live = document.querySelectorAll(
      '[role="status"], [role="alert"], [role="log"], [aria-live]:not([aria-live="off"]), output:not([aria-hidden="true"])',
    );
    expect([...live]).toEqual([statusRegion()]);
    expect(dialog().contains(statusRegion())).toBe(true);
    expect(getComputedStyle(statusRegion()).position).toBe('absolute');
  });
});

describe('Save PNG', () => {
  test("saves the plane's picture under subject, plane and offset, and says it did", async () => {
    const clicked: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ download: this.download, href: this.href });
    });
    await mount();
    engine.sections.setCrosshair([0, 0, -7.46]);
    await openFromKeyboard();
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    await page.getByRole('button', { name: 'Save PNG, axial', exact: true }).click();
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe('sub_013-axial--7.5mm.png');
    expect(clicked[0]!.href.startsWith('data:image/png;base64,')).toBe(true);
    await expect.poll(() => statusRegion().textContent).toBe('Saved the axial section as a PNG.');
  });

  test('saving the same plane twice is spoken twice: the sentence is cleared, then written a moment later', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await opened();
    const writes: { text: string; at: number }[] = [];
    new MutationObserver(() =>
      writes.push({ text: statusRegion().textContent!, at: performance.now() }),
    ).observe(statusRegion(), { childList: true, characterData: true, subtree: true });
    const save = page.getByRole('button', { name: 'Save PNG, axial', exact: true });
    await save.click();
    await expect.poll(() => statusRegion().textContent).toBe('Saved the axial section as a PNG.');
    writes.length = 0;
    await save.click();
    await expect
      .poll(() => writes.map((write) => write.text))
      .toEqual(['', 'Saved the axial section as a PNG.']);
    expect(writes[1]!.at - writes[0]!.at).toBeGreaterThanOrEqual(16);
  });

  test('says so in French', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    live.lang = 'fr';
    await opened();
    await page.getByRole('button', { name: 'Enregistrer PNG, sagittal', exact: true }).click();
    await expect
      .poll(() => statusRegion().textContent)
      .toBe('Coupe sagittale enregistrée au format PNG.');
  });
});

describe('on a phone', () => {
  beforeEach(() => page.viewport(390, 844));

  test('one plane is shown, chosen by a radio group, and only it is drawn', async () => {
    await opened();
    await expect.element(page.getByRole('radiogroup', { name: 'Section plane' })).toBeVisible();
    await expect.element(page.getByRole('radio', { name: 'Axial' })).toBeChecked();
    expect(section('axial').hidden).toBe(false);
    expect(section('sagittal').hidden).toBe(true);
    expect(section('coronal').hidden).toBe(true);
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    expect(calls('pixels')).toHaveLength(1);
  });

  test('the arrow keys choose the plane, and the plane chosen is drawn at once', async () => {
    await opened();
    (page.getByRole('radio', { name: 'Axial' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(page.getByRole('radio', { name: 'Coronal' })).toBeChecked();
    expect(document.activeElement).toBe(page.getByRole('radio', { name: 'Coronal' }).element());
    expect(section('coronal').hidden).toBe(false);
    expect(section('axial').hidden).toBe(true);
    await expect.poll(() => canvas('coronal').width).toBe(SIZE);
  });

  test('the plane still has its heading for a screen reader, though the radio names it', async () => {
    await opened();
    await expect
      .element(page.getByRole('heading', { name: 'Axial', level: 3 }))
      .toBeInTheDocument();
    const heading = section('axial').querySelector('h3')!.getBoundingClientRect();
    expect(heading.width).toBeLessThanOrEqual(1);
  });

  test("the plane fills the dialog's width, up to 800 px of window", async () => {
    await page.viewport(780, 900);
    await opened();
    const grid = dialog().querySelector('.grid')!.getBoundingClientRect();
    expect(section('axial').getBoundingClientRect().width).toBeGreaterThan(grid.width * 0.9);
  });

  test('focus in a plane that the window then hides goes to the radio group', async () => {
    await page.viewport(1280, 900);
    await opened();
    sliderElement('Coronal position').focus();
    await page.viewport(390, 844);
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByRole('radio', { name: 'Axial' }).element());
  });

  test("widening the window while a radio has focus keeps focus in the dialog, on the plane's slider", async () => {
    await opened();
    (page.getByRole('radio', { name: 'Axial' }).element() as HTMLElement).focus();
    await page.viewport(1280, 900);
    await expect.poll(() => document.activeElement).toBe(sliderElement('Axial position'));
  });

  test('has no horizontal scroll, and the targets are 44 px on a coarse pointer', async () => {
    await opened();
    expect(dialog().scrollWidth).toBeLessThanOrEqual(dialog().clientWidth);
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const element of [
        page.getByRole('button', { name: 'Close' }).element(),
        page.getByRole('radio', { name: 'Axial' }).element(),
        page.getByRole('button', { name: 'Save PNG, axial' }).element(),
        sliderElement('Axial position'),
        sliderElement('Window'),
      ]) {
        expect(
          element.getBoundingClientRect().height,
          element.outerHTML.slice(0, 60),
        ).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });
});

describe('the sticky header', () => {
  test('never covers a control that keyboard focus scrolls into view', async () => {
    await page.viewport(390, 500);
    await opened();
    sliderElement('Level').focus();
    sliderElement('Axial position').focus();
    await frame();
    const header = dialog().querySelector('.dialog-header')!.getBoundingClientRect();
    expect(sliderElement('Axial position').getBoundingClientRect().top).toBeGreaterThanOrEqual(
      header.bottom,
    );
  });
});

describe('contrast and colour modes', () => {
  test('the position sliders are drawn exactly as the Window slider: no native appearance, the same box', async () => {
    await opened();
    const drawn = (name: string) => {
      const style = getComputedStyle(sliderElement(name));
      return [
        style.appearance,
        style.height,
        style.marginTop,
        style.accentColor,
        style.backgroundColor,
      ];
    };
    expect(drawn('Window')[0]).toBe('none');
    for (const name of ['Sagittal position', 'Coronal position', 'Axial position']) {
      expect(drawn(name), name).toEqual(drawn('Window'));
    }
  });

  test('forced colours draw the position sliders in system colours', async () => {
    await opened();
    const resolve = (colour: string) => {
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.color = colour;
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const slider = sliderElement('Axial position');
      expect(getComputedStyle(slider).forcedColorAdjust).toBe('none');
      expect(getComputedStyle(slider, '::-webkit-slider-thumb').borderTopColor).toBe(
        resolve('CanvasText'),
      );
    });
  });

  test('forced colours draw the checkbox as a system control', async () => {
    await opened();
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const box = page.getByRole('checkbox').element();
      expect(getComputedStyle(box).appearance).toBe('auto');
    });
  });

  test('more contrast gives the dialog the stronger text and border colours', async () => {
    await opened();
    const probe = (variable: string) => {
      const element = dialog().querySelector('.mpr')!;
      return getComputedStyle(element).getPropertyValue(variable).trim();
    };
    const normal = probe('--border-control');
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      expect(probe('--border-control')).toBe(probe('--text-primary'));
      expect(probe('--text-tertiary')).toBe(probe('--text-secondary'));
    });
    expect(probe('--border-control')).toBe(normal);
  });
});

describe('accessibility', () => {
  test('passes axe in light and dark, on a desktop and a phone, in English', async () => {
    await opened();
    await expectAxeClean();
  });

  test('passes axe in French', async () => {
    live.lang = 'fr';
    await opened();
    await expectAxeClean();
  });
});
