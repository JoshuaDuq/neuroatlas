// The stage overlay against the legacy viewport-chrome.js behaviour and WCAG 2.2 (1.4.13, 2.4.11, 2.5.8),
// over the fake engine in a real browser.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { t } from '../../lib/core/i18n/index.ts';
import { decimal, withUnit } from '../../lib/core/format.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { PREF_KEYS } from '../../lib/state/prefs.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { Manifest, Region, SessionState } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import type { HoverSources, HoverView } from './hover-text.ts';
import Fixture from './stage-test-support.svelte';

interface Live {
  lang: 'en' | 'fr';
  status: SessionState['status'];
  tractReference: boolean;
  selectedId: string | null;
  view: HoverView;
  media: { phone: boolean; coarsePointer: boolean };
}

const published = manifest as unknown as Manifest;
const regionA = { id: 'a', label: 'Area A', hemisphere: 'left', kind: 'cortex' } as Region;
const regionB = { id: 'b', label: 'Area B', hemisphere: 'right', kind: 'cortex' } as Region;

const sources: HoverSources = {
  regions: new Map(),
  functionalRegions: null,
  cabNp: null,
  domains: null,
  catalogName: () => undefined,
  canSelect: () => true,
};

let engine: FakeEngine;
let stage: StageLayout;
let live: Live;
let cleanups: (() => void)[];

const find = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const host = () => find('#viewport');
const chip = () => find('#hover-label');
const canvas = () => find<HTMLCanvasElement>('#stage-canvas');
const letters = () =>
  ['top', 'right', 'bottom', 'left'].map((edge) => find(`[data-edge="${edge}"]`).textContent);

function liveState(overrides: Partial<Live>): Live {
  const state = $state<Live>({
    lang: 'en',
    status: 'ready',
    tractReference: false,
    selectedId: null,
    view: {
      lang: 'en',
      surfaceColor: 'atlas',
      functionalLevel: 'named',
      paint: null,
      selectedFunction: null,
    },
    media: { phone: false, coarsePointer: false },
    ...overrides,
  });
  return state;
}

async function mount(
  overrides: Partial<Live> = {},
  options: { dock?: boolean; retired?: boolean; width?: number; height?: number } = {},
) {
  const { width = 900, height = 600 } = options;
  engine = createFakeEngine({ manifest: published, hostSize: { width, height } });
  if (options.retired) localStorage.setItem(PREF_KEYS.stageHint, 'retired');
  live = liveState(overrides);
  cleanups.push(
    $effect.root(() => {
      stage = createStageLayout({
        media: {
          get phone() {
            return live.media.phone;
          },
        },
      });
    }),
  );
  const result = await render(Fixture, { engine, stage, live, sources, width, height });
  if (options.dock) stage.setDock({ width: 300, height: 38 });
  flushSync();
  return result;
}

const pointerAt = (region: Region | null, x: number, y: number) =>
  engine.emit('hover', { region, position: region ? { x, y } : null });

beforeEach(async () => {
  cleanups = [];
  localStorage.removeItem(PREF_KEYS.stageHint);
  await page.viewport(1280, 800);
});

afterEach(() => {
  cleanup();
  cleanups.forEach((stop) => stop());
  localStorage.removeItem(PREF_KEYS.stageHint);
});

describe('the layer', () => {
  test('is hidden from assistive technology, never focusable, and never takes the pointer', async () => {
    await mount();
    const layer = find('.stage-overlay');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.parentElement).toBe(host());
    for (const node of layer.querySelectorAll<HTMLElement>('*')) {
      expect(node.hasAttribute('tabindex'), node.outerHTML).toBe(false);
      expect(getComputedStyle(node).pointerEvents, node.outerHTML).toBe('none');
    }
    // Tab goes from the host's own canvas on, never into an overlay (2.1.1, 2.5.8: nothing here is a target).
    canvas().focus();
    await userEvent.tab();
    expect(layer.contains(document.activeElement)).toBe(false);
  });

  test('writes the visible rectangle, the key band, the dock and the chrome mode on the host', async () => {
    await mount({}, { dock: true });
    engine.camera.setChromeInsets({ bottom: 200, top: 10 }, {});
    stage.setKeys({ top: 0, right: 90 }, { width: 90, height: 200 });
    flushSync();
    const style = host().style;
    expect(style.getPropertyValue('--vis-top')).toBe('10px');
    expect(style.getPropertyValue('--vis-left')).toBe('0px');
    expect(style.getPropertyValue('--vis-right')).toBe('0px');
    expect(style.getPropertyValue('--vis-bottom')).toBe('200px');
    expect(style.getPropertyValue('--key-right')).toBe('90px');
    expect(style.getPropertyValue('--dock-height')).toBe('38px');
    expect(host().dataset.chrome).toBe('wide');
    expect(host().dataset.dockTall).toBe('false');
    stage.setDock({ width: 300, height: 190 });
    flushSync();
    expect(host().dataset.dockTall).toBe('true');
  });

  test('reads the gutter again when the device class changes', async () => {
    await mount();
    expect(stage.gutter).toBe(20);
    host().style.setProperty('--stage-gutter', '12px');
    live.media.phone = true;
    flushSync();
    expect(stage.gutter).toBe(12);
  });

  test('the model focus ring runs round the visible rectangle, not under the dock', async () => {
    await mount();
    engine.camera.setChromeInsets({ bottom: 120 }, {});
    flushSync();
    canvas().focus();
    await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(canvas());
    const ring = getComputedStyle(host(), '::after');
    expect(ring.borderTopWidth).toBe('2px');
    expect(ring.bottom).toBe('120px');
    expect(ring.borderTopColor).toBe('rgb(127, 208, 204)');
  });

  test('the ring is a system colour in forced-colours mode', async () => {
    await mount();
    canvas().focus();
    await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}');
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(getComputedStyle(host(), '::after').borderTopColor).not.toBe('rgb(127, 208, 204)');
    });
  });
});

describe('orientation', () => {
  test('shows the letter the camera reports at each edge, and follows the camera', async () => {
    await mount();
    engine.camera.applyView('left');
    const left = letters();
    engine.camera.applyView('right');
    const right = letters();
    expect(left).not.toEqual(right);
    expect(new Set(left).size).toBe(4);
    expect(left.every((letter) => /^[RLSIPA]$/.test(letter!))).toBe(true);
  });

  test('a language change re-words the letters without reading the camera again', async () => {
    await mount();
    engine.camera.applyView('anterior');
    const english = letters();
    const read = vi.spyOn(engine.camera, 'view', 'get');
    live.lang = 'fr';
    flushSync();
    expect(read).not.toHaveBeenCalled();
    expect(letters()).toEqual(english.map((letter) => ({ R: 'D', L: 'G' })[letter!] ?? letter));
    expect(letters()).not.toEqual(english);
  });

  test('is hidden until the anatomy is on screen', async () => {
    await mount({ status: 'loading' });
    expect(find('#orientation').hidden).toBe(true);
    live.status = 'switching';
    flushSync();
    expect(find('#orientation').hidden).toBe(false);
  });

  test('keeps only an opacity transition under reduced motion', async () => {
    await mount();
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], () => {
      expect(getComputedStyle(find('#orientation')).transitionProperty).toBe('opacity');
    });
  });
});

describe('scale bar', () => {
  const emitScale = (millimetres: number, pixels: number) =>
    engine.emit('camera', { ...engine.camera.view, scale: { millimetres, pixels } });

  test('draws the rule in pixels and words the length in the reader language', async () => {
    await mount();
    emitScale(2.5, 87.4);
    expect(find('.scale-bar-rule').style.width).toBe('87px');
    expect(find('#scale-bar .measure').textContent).toBe(
      withUnit(decimal(2.5, 1, 'en', { trim: true }), 'mm', 'en'),
    );
    live.lang = 'fr';
    flushSync();
    expect(find('#scale-bar .measure').textContent).toBe(
      withUnit(decimal(2.5, 1, 'fr', { trim: true }), 'mm', 'fr'),
    );
    expect(find('#scale-bar .measure').textContent).toContain('2,5');
  });

  test('is hidden while the stage has no size, and takes no room', async () => {
    await mount();
    emitScale(10, 100);
    expect(find('#scale-bar').hidden).toBe(false);
    expect(stage.chrome).toBe('wide');
    engine.emit('camera', { ...engine.camera.view, scale: null });
    expect(find('#scale-bar').hidden).toBe(true);
    live.status = 'loading';
    emitScale(10, 100);
    flushSync();
    expect(find('#scale-bar').hidden).toBe(true);
  });

  test('its width, rule and label, decides how the dock and the bar share a line', async () => {
    await mount({}, { dock: true });
    emitScale(10, 100);
    await vi.waitFor(() =>
      expect(find('#scale-bar').getBoundingClientRect().width).toBeGreaterThan(100),
    );
    expect(host().dataset.chrome).toBe('wide');
    // A 300 px dock, the bar and 48 px of margins need more than a 440 px stage has.
    engine.camera.setChromeInsets({ right: 460 }, {});
    await vi.waitFor(() => expect(host().dataset.chrome).toBe('tight'));
  });
});

describe('hover chip', () => {
  test('names the region beside the pointer, and is silent and untouchable', async () => {
    await mount();
    pointerAt(regionA, 100, 120);
    expect(chip().hidden).toBe(false);
    expect(chip().textContent).toBe('Area A · Left');
    expect(chip().style.left).toBe('114px');
    expect(chip().style.top).toBe('134px');
    expect(chip().getAttribute('aria-hidden')).toBe(null);
    expect(chip().closest('[aria-hidden="true"]')).not.toBeNull();
    expect(chip().hasAttribute('role')).toBe(false);
    expect(getComputedStyle(chip()).pointerEvents).toBe('none');
  });

  test('is kept 8 px inside the stage', async () => {
    await mount();
    pointerAt(regionA, 2, 3);
    pointerAt(regionA, 0, 0);
    expect(chip().style.left).toBe('14px');
    pointerAt(regionA, 890, 590);
    const width = chip().offsetWidth;
    const height = chip().offsetHeight;
    expect(chip().style.left).toBe(`${900 - width - 8}px`);
    expect(chip().style.top).toBe(`${600 - height - 8}px`);
  });

  test('rewrites its text only when the words change', async () => {
    await mount();
    pointerAt(regionA, 100, 100);
    const writes: string[] = [];
    const watch = new MutationObserver((records) => {
      for (const record of records) if (record.type === 'childList') writes.push('text');
    });
    watch.observe(chip(), { childList: true, characterData: true, subtree: true });
    pointerAt(regionA, 120, 100);
    pointerAt(regionA, 140, 100);
    await Promise.resolve();
    expect(writes).toEqual([]);
    pointerAt(regionB, 140, 100);
    await Promise.resolve();
    expect(writes.length).toBeGreaterThan(0);
    expect(chip().textContent).toBe('Area B · Right');
    watch.disconnect();
  });

  test('goes when the pointer leaves, when the camera moves and where the model will not select', async () => {
    await mount();
    pointerAt(regionA, 100, 100);
    pointerAt(null, 0, 0);
    expect(chip().hidden).toBe(true);
    pointerAt(regionA, 100, 100);
    engine.camera.applyView('left');
    expect(chip().hidden).toBe(true);
    pointerAt(regionA, 100, 100);
    expect(chip().hidden).toBe(false);
  });

  test('is re-worded under a still pointer when the language changes', async () => {
    await mount();
    pointerAt(regionA, 100, 100);
    live.view = { ...live.view, lang: 'fr' };
    flushSync();
    expect(chip().textContent).toBe('Area A · Gauche');
  });

  test('Escape dismisses it without moving focus, until another region or a return (WCAG 1.4.13)', async () => {
    await mount();
    canvas().focus();
    pointerAt(regionA, 100, 100);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(chip().hidden).toBe(true);
    expect(document.activeElement).toBe(canvas());

    pointerAt(regionA, 130, 100);
    expect(chip().hidden).toBe(true);
    pointerAt(regionB, 130, 100);
    expect(chip().hidden).toBe(false);

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    pointerAt(null, 0, 0);
    pointerAt(regionB, 130, 100);
    expect(chip().hidden).toBe(false);
  });

  test('Escape the page already handled, or with no chip showing, is left alone', async () => {
    await mount();
    const idle = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);

    pointerAt(regionA, 100, 100);
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.body.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
    document.body.dispatchEvent(handled);
    expect(chip().hidden).toBe(false);
  });
});

describe('hints', () => {
  const help = () => find('#viewport-help');
  const focusHint = () => find('#viewport-focus-hint');

  test('say how to move the model, in the language and for the pointer', async () => {
    await mount();
    expect(help().textContent!.trim()).toBe('Drag to rotate · Scroll to zoom · Click to inspect');
    expect(focusHint().textContent!.trim()).toBe('3D view · Arrow keys rotate · + − zoom');
    live.tractReference = true;
    flushSync();
    expect(help().textContent!.trim()).toBe('Drag to rotate · Scroll to zoom');
    live.lang = 'fr';
    flushSync();
    expect(help().textContent!.trim()).toBe(t('fr', 'viewport').navigationHintTracts);
    live.tractReference = false;
    flushSync();
    expect(help().textContent!.trim()).toBe(t('fr', 'viewport').navigationHint);
  });

  test('name touch gestures on a coarse pointer (decision 21)', async () => {
    await mount({ media: { phone: false, coarsePointer: true } });
    expect(help().textContent!.trim()).toBe('Drag to rotate · Pinch to zoom · Tap to inspect');
    live.tractReference = true;
    live.lang = 'fr';
    flushSync();
    expect(help().textContent!.trim()).toBe('Glisser\u202f: tourner · Pincer\u202f: zoom');
  });

  test.each([
    [
      'a pointer down on the canvas',
      () => canvas().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
    ],
    [
      'a wheel turn on the canvas',
      () => canvas().dispatchEvent(new WheelEvent('wheel', { bubbles: true })),
    ],
    [
      'an arrow key on the canvas',
      () =>
        canvas().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })),
    ],
    [
      'a zoom key on the canvas',
      () => canvas().dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true })),
    ],
    ['the store, for a preset or a view key', () => stage.retireHint()],
  ])('retire for good on %s', async (_name, gesture) => {
    await mount();
    expect(help().dataset.dismissed).toBe('false');
    gesture();
    flushSync();
    expect(help().dataset.dismissed).toBe('true');
    expect(localStorage.getItem(PREF_KEYS.stageHint)).toBe('retired');
  });

  test('stay while the reader does something else', async () => {
    await mount();
    host().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    canvas().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    flushSync();
    expect(help().dataset.dismissed).toBe('false');
  });

  test('retire when the reader selects something other than what the stage opened on', async () => {
    await mount({ selectedId: 'a' });
    live.selectedId = 'a';
    flushSync();
    expect(help().dataset.dismissed).toBe('false');
    live.selectedId = 'b';
    flushSync();
    expect(help().dataset.dismissed).toBe('true');
  });

  test('are already retired after an earlier visit, and fade rather than jump', async () => {
    await mount({}, { retired: true });
    expect(help().dataset.dismissed).toBe('true');
    expect(getComputedStyle(help()).visibility).toBe('hidden');
  });

  test('the keyboard hint shows only while the canvas has keyboard focus', async () => {
    await mount();
    expect(getComputedStyle(focusHint()).opacity).toBe('0');
    await userEvent.tab();
    await userEvent.tab();
    if (document.activeElement !== canvas()) await userEvent.tab();
    expect(document.activeElement).toBe(canvas());
    // Both fade over the camera transition.
    await vi.waitFor(() => expect(getComputedStyle(focusHint()).opacity).toBe('1'), {
      timeout: 5000,
    });
    await vi.waitFor(() => expect(getComputedStyle(help()).opacity).toBe('0'), { timeout: 5000 });
  });

  test('are not drawn where one line would not fit clear of the top letter', async () => {
    await mount();
    await vi.waitFor(() => expect(help().dataset.room).toBe('true'));
    engine.camera.setChromeInsets({ right: 540 }, {});
    await vi.waitFor(() => expect(help().dataset.room).toBe('false'));
    expect(getComputedStyle(help()).visibility).toBe('hidden');
    engine.camera.setChromeInsets({ right: 0 }, {});
    await vi.waitFor(() => expect(help().dataset.room).toBe('true'));
  });

  test('take the reader contrast setting', async () => {
    await mount();
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      expect(getComputedStyle(help()).color).toBe(
        getComputedStyle(find('[data-edge="top"]')).color,
      );
    });
  });
});

describe('text size and spacing set after the stage is up (WCAG 1.4.4, 1.4.12)', () => {
  const SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }`;
  const rect = (selector: string) => find(selector).getBoundingClientRect();
  /** A hint that is drawn must end before the top letter begins. */
  const hintClear = () =>
    getComputedStyle(help()).visibility === 'hidden' ||
    rect('#viewport-help').right <= rect('[data-edge="top"]').left;
  const help = () => find('#viewport-help');
  let style: HTMLStyleElement | null = null;

  afterEach(() => {
    document.documentElement.style.fontSize = '';
    style?.remove();
    style = null;
  });

  const cases = [
    ['320 px wide at 568 tall (400 % zoom)', 320, 400, 320, 568],
    ['844 × 390 landscape', 844, 300, 844, 390],
    ['a 700 px stage', 700, 500, 1280, 800],
    ['a desktop stage', 900, 600, 1280, 800],
  ] as const;

  test.each(cases)(
    '%s: 200 % text keeps the hint off the top letter and the chip inside',
    async (_name, width, height, viewportWidth, viewportHeight) => {
      await page.viewport(viewportWidth, viewportHeight);
      await mount({}, { width, height });
      await vi.waitFor(() => expect(help().dataset.room).toBeDefined());
      pointerAt(regionA, width - 2, height - 2);
      document.documentElement.style.fontSize = '200%';
      await vi.waitFor(() => expect(hintClear()).toBe(true));
      await vi.waitFor(() => {
        const chipBox = chip().getBoundingClientRect();
        const stageBox = host().getBoundingClientRect();
        expect(chipBox.right).toBeLessThanOrEqual(stageBox.right + 0.5);
        expect(chipBox.bottom).toBeLessThanOrEqual(stageBox.bottom + 0.5);
        expect(chipBox.left).toBeGreaterThanOrEqual(stageBox.left - 0.5);
        expect(chipBox.top).toBeGreaterThanOrEqual(stageBox.top - 0.5);
      });
    },
  );

  test.each(cases)(
    '%s: text spacing keeps the hint off the top letter and the chip inside',
    async (_name, width, height, viewportWidth, viewportHeight) => {
      await page.viewport(viewportWidth, viewportHeight);
      await mount({}, { width, height });
      await vi.waitFor(() => expect(help().dataset.room).toBeDefined());
      pointerAt(regionA, width - 2, height - 2);
      style = document.head.appendChild(document.createElement('style'));
      style.textContent = SPACING;
      await vi.waitFor(() => expect(hintClear()).toBe(true));
      await vi.waitFor(() => {
        const chipBox = chip().getBoundingClientRect();
        const stageBox = host().getBoundingClientRect();
        expect(chipBox.right).toBeLessThanOrEqual(stageBox.right + 0.5);
        expect(chipBox.bottom).toBeLessThanOrEqual(stageBox.bottom + 0.5);
      });
    },
  );

  test('the scale bar width follows the text, so the dock and the bar are refitted', async () => {
    await mount({}, { dock: true });
    engine.emit('camera', { ...engine.camera.view, scale: { millimetres: 10, pixels: 100 } });
    const narrow = await vi.waitFor(() => {
      const width = find('#scale-bar').getBoundingClientRect().width;
      expect(width).toBeGreaterThan(100);
      return width;
    });
    document.documentElement.style.fontSize = '200%';
    await vi.waitFor(() =>
      expect(find('#scale-bar').getBoundingClientRect().width).toBeGreaterThan(narrow),
    );
  });
});

describe('Escape and dialogs', () => {
  test('an Escape inside a modal dialog closes the dialog and leaves the chip alone', async () => {
    await mount();
    pointerAt(regionA, 100, 100);
    const modal = find<HTMLDialogElement>('#modal');
    modal.showModal();
    await userEvent.keyboard('{Escape}');
    expect(modal.open).toBe(false);
    expect(chip().hidden).toBe(false);
    // With the dialog gone, the next Escape dismisses the chip.
    await userEvent.keyboard('{Escape}');
    expect(chip().hidden).toBe(true);
  });
});

describe('accessibility', () => {
  test('axe finds nothing in the light and dark themes, desktop and phone width, in both languages', async () => {
    await mount({}, { dock: true });
    pointerAt(regionA, 100, 100);
    emitFor(engine);
    await expectAxeClean();
    live.lang = 'fr';
    flushSync();
    await expectAxeClean();
  });
});

function emitFor(fake: FakeEngine) {
  fake.emit('camera', { ...fake.camera.view, scale: { millimetres: 10, pixels: 100 } });
}
