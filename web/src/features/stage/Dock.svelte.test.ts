// The stage dock against the legacy stage-tools.js and display.js behaviour, the
// APG Toolbar and non-modal Dialog patterns and WCAG 2.2 (1.4.4, 1.4.12, 2.1.1, 2.4.3, 2.5.8),
// over the fake engine in a real browser. U5's popover rules (one open, Escape, Tab-out, outside press) are
// proved in its own tests; here only what the dock wires onto them.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';
import { flushSync } from 'svelte';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import { PREF_KEYS } from '../../lib/state/prefs.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import type { DockCommands } from './dock-commands.ts';
import Fixture from './dock-test-support.svelte';

const published = manifest as unknown as Manifest;

interface Live {
  lang: 'en' | 'fr';
  status: 'loading' | 'ready' | 'switching' | 'error' | 'context-lost';
  tractReference: boolean;
  hasSpinalCord: boolean;
  coordinates: boolean;
  phone: boolean;
  view: {
    hemisphere: 'both' | 'left' | 'right';
    cortexVisible: boolean;
    cortexOpacity: number;
    internalVisible: boolean;
    spinalCordVisible: boolean;
  };
}

let engine: FakeEngine;
let stage: StageLayout;
let live: Live;
type Commands = Omit<DockCommands, 'chooseView' | 'reset'>;
let commands: { [K in keyof Commands]: Mock<Commands[K]> };
let cleanups: (() => void)[];
/** What the stage layout's `onDock` runs: the camera refit in the app. */
let onDock: () => void;
/** Each placing state the dock has asked for, in order. */
let placing: boolean[];

function liveState(overrides: Partial<Live>): Live {
  const state = $state<Live>({
    lang: 'en',
    status: 'ready',
    tractReference: false,
    hasSpinalCord: true,
    coordinates: true,
    phone: false,
    view: {
      hemisphere: 'both',
      cortexVisible: true,
      cortexOpacity: 1,
      internalVisible: true,
      spinalCordVisible: false,
    },
    ...overrides,
  });
  return state;
}

async function mount(
  overrides: Partial<Live> = {},
  {
    width = 900,
    height = 600,
    bottomInset = 0,
  }: { width?: number; height?: number; bottomInset?: number } = {},
) {
  engine = createFakeEngine({ manifest: published, hostSize: { width, height } });
  engine.camera.setChromeInsets({ bottom: bottomInset }, {});
  live = liveState(overrides);
  commands = {
    setHemisphere: vi.fn<DockCommands['setHemisphere']>(),
    setCortexVisible: vi.fn<DockCommands['setCortexVisible']>(),
    setCortexOpacity: vi.fn<DockCommands['setCortexOpacity']>(),
    setInternalVisible: vi.fn<DockCommands['setInternalVisible']>(),
    setSpinalCordVisible: vi.fn<DockCommands['setSpinalCordVisible']>(),
  };
  cleanups.push(
    $effect.root(() => {
      stage = createStageLayout({
        media: {
          get phone() {
            return live.phone;
          },
        },
        onDock: () => onDock(),
      });
    }),
  );
  placing = [];
  const result = await render(Fixture, { stage, live, commands, width, height, placing });
  stage.setGutter(20);
  stage.setViewport(engine.camera.visibleRect, engine.camera.hostSize);
  flushSync();
  return result;
}

const locate = (role: 'button' | 'radio' | 'checkbox' | 'slider', name: string) =>
  page.getByRole(role, { name, exact: true });
const control = (role: 'button' | 'radio' | 'checkbox' | 'slider', name: string) =>
  locate(role, name).element() as HTMLElement;
const tool = (name: string) => control('button', name);
/** A real pointer click, which the controls' pointer handling sees. */
const press = (role: 'button' | 'radio' | 'checkbox', name: string) => locate(role, name).click();
const active = () => document.activeElement;
const dock = () => document.querySelector<HTMLElement>('.stage-dock')!;
const popover = () => document.querySelector<HTMLElement>('.popover')!;
const dialogs = () => document.querySelectorAll('[role="dialog"]');
const canvas = () => document.getElementById('stage-canvas');

/** Opens a tool from the keyboard: focus lands in its popover. */
async function open(name: string) {
  tool(name).focus();
  await userEvent.keyboard('{Enter}');
  await vi.waitFor(() => expect(tool(name).getAttribute('aria-expanded')).toBe('true'));
}

beforeEach(async () => {
  cleanups = [];
  onDock = () => {};
  localStorage.removeItem(PREF_KEYS.stageHint);
  await page.viewport(1280, 800);
});

afterEach(() => {
  cleanup();
  cleanups.forEach((stop) => stop());
  localStorage.removeItem(PREF_KEYS.stageHint);
});

describe('the toolbar', () => {
  test('is a labelled toolbar of four tools with one Tab stop that the arrows walk, wrapping', async () => {
    await mount();
    const bar = page.getByRole('toolbar', { name: '3D viewer tools' }).element();
    const tools = [...bar.querySelectorAll<HTMLElement>('.stage-tool')];
    expect(tools.map((node) => node.textContent!.trim())).toEqual([
      'Section',
      'Lesion',
      'Coordinate',
      'Display',
    ]);
    expect(tools.map((node) => node.tabIndex)).toEqual([0, -1, -1, -1]);

    tool('Section').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(tool('Lesion'));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(tool('Coordinate'));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(active()).toBe(tool('Section'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(tool('Display'));
    await userEvent.keyboard('{Home}');
    expect(active()).toBe(tool('Section'));
    await userEvent.keyboard('{End}');
    expect(active()).toBe(tool('Display'));
  });

  test('Tab passes the whole toolbar in one stop, and comes back to its first tool', async () => {
    await mount();
    tool('Display').focus();
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(control('button', 'After'));
    // The Tab stop is the focused tool, else the first (ui/roving.js), as in the legacy dock.
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(active()).toBe(tool('Section'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(active()).toBe(canvas());
  });

  test('without published coordinate spaces there is no Coordinate tool, and the arrows pass it', async () => {
    await mount({ coordinates: false });
    expect(page.getByRole('button', { name: 'Coordinate' }).elements()).toHaveLength(0);
    tool('Lesion').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(tool('Display'));
    live.coordinates = true;
    flushSync();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(tool('Coordinate'));
  });

  test('over the tract reference no tool is left and the dock is not drawn; it comes back with them', async () => {
    await mount({ tractReference: true });
    for (const name of ['Section', 'Lesion', 'Coordinate', 'Display']) {
      expect(page.getByRole('button', { name }).elements(), name).toHaveLength(0);
    }
    expect(getComputedStyle(dock()).visibility).toBe('hidden');

    live.tractReference = false;
    flushSync();
    expect(getComputedStyle(dock()).visibility).toBe('visible');
    expect(page.getByRole('toolbar', { name: '3D viewer tools' }).elements()).toHaveLength(1);
  });

  test('is named in French, with the tools in French', async () => {
    await mount({ lang: 'fr' });
    expect(page.getByRole('toolbar', { name: 'Outils du visualiseur 3D' }).elements()).toHaveLength(
      1,
    );
    for (const name of ['Coupe', 'Lésion', 'Coordonnée', 'Affichage']) {
      expect(tool(name), name).toBeTruthy();
    }
  });

  test('the dock root marks its keys as its own (decision 7), and no control does', async () => {
    await mount();
    expect(dock().hasAttribute('data-own-keys')).toBe(true);
    expect(dock().querySelectorAll('[data-own-keys]')).toHaveLength(0);
  });

  test('is measured by the stage layout, so the camera keeps its fit', async () => {
    // The measurement arrives with the layout's ResizeObserver, which a loaded machine can hold
    // for more than a poll's second: wait for the refit it asks for instead.
    const refit = new Promise<void>((resolve) => (onDock = resolve));
    await mount();
    await refit;
    expect(stage.dock.height).toBeGreaterThan(0);
    expect(stage.dock.width).toBe(Math.round(dock().getBoundingClientRect().width));
  });
});

describe('a tool and its popover', () => {
  test('opens a named, non-modal dialog and Escape closes it, returns focus and is marked handled', async () => {
    await mount();
    const escapes: boolean[] = [];
    const record = (event: KeyboardEvent) =>
      event.key === 'Escape' && escapes.push(event.defaultPrevented);
    document.addEventListener('keydown', record);
    try {
      await open('Display');
      const dialog = page.getByRole('dialog', { name: 'Display' }).element();
      expect(dialog.hasAttribute('aria-modal')).toBe(false);
      expect(tool('Display').getAttribute('aria-haspopup')).toBe('dialog');
      expect(active()).toBe(control('radio', 'Both'));
      await userEvent.keyboard('{Escape}');
      await vi.waitFor(() => expect(tool('Display').getAttribute('aria-expanded')).toBe('false'));
      expect(active()).toBe(tool('Display'));
      expect(escapes).toEqual([true]);
    } finally {
      document.removeEventListener('keydown', record);
    }
  });

  test.each(['Section', 'Lesion', 'Coordinate', 'Display'])(
    'the %s popover is named by its tool',
    async (name) => {
      await mount();
      await open(name);
      expect(page.getByRole('dialog', { name, exact: true }).elements()).toHaveLength(1);
    },
  );

  test('another tool replaces the open one: never two at once', async () => {
    await mount();
    await open('Section');
    await open('Display');
    await vi.waitFor(() => expect(tool('Section').getAttribute('aria-expanded')).toBe('false'));
    expect(tool('Display').getAttribute('aria-expanded')).toBe('true');
    expect(tool('Lesion').getAttribute('aria-expanded')).toBe('false');
  });

  test.each(['Display', 'Section', 'Lesion', 'Coordinate'])(
    'Shift+Tab from the first control of %s returns to its own tool with the popover still open',
    async (name) => {
      await mount();
      await open(name);
      const body = page.getByRole('dialog', { name, exact: true });
      expect(body.element().contains(active())).toBe(true);
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(active()).toBe(tool(name));
      expect(tool(name).getAttribute('aria-expanded')).toBe('true');
      expect(body.elements()).toHaveLength(1);
    },
  );

  test('Tab from the last control of a popover leaves the dock', async () => {
    await mount();
    await open('Lesion');
    expect(active()).toBe(control('button', 'Place'));
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(control('button', 'After'));
    await vi.waitFor(() => expect(tool('Lesion').getAttribute('aria-expanded')).toBe('false'));
  });

  test('from the keyboard it is instant, from the pointer it grows from the dock', async () => {
    await mount();
    await open('Display');
    expect(popover().hasAttribute('data-instant')).toBe(true);
    await userEvent.keyboard('{Escape}');
    await press('button', 'Display');
    await vi.waitFor(() => expect(tool('Display').getAttribute('aria-expanded')).toBe('true'));
    expect(popover().hasAttribute('data-instant')).toBe(false);
  });
});

describe('the Display popover', () => {
  test('choosing the other side applies it; the side already shown does nothing; arrows move and select', async () => {
    await mount();
    await open('Display');
    expect(page.getByRole('radiogroup', { name: 'Hemisphere' }).elements()).toHaveLength(1);
    await press('radio', 'Both');
    expect(commands.setHemisphere).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowRight}');
    expect(commands.setHemisphere.mock.calls).toEqual([['left']]);
  });

  test('the checkboxes apply at once and the popover stays open', async () => {
    await mount();
    await open('Display');
    await press('checkbox', 'Show cortex');
    expect(commands.setCortexVisible.mock.calls).toEqual([[false]]);
    await press('checkbox', 'Show internal anatomy');
    expect(commands.setInternalVisible.mock.calls).toEqual([[false]]);
    await press('checkbox', 'Show spinal cord');
    expect(commands.setSpinalCordVisible.mock.calls).toEqual([[true]]);
    expect(tool('Display').getAttribute('aria-expanded')).toBe('true');
  });

  test('the checkboxes show the display they are given', async () => {
    await mount({
      view: { ...liveState({}).view, internalVisible: false, spinalCordVisible: true },
    });
    await open('Display');
    expect((control('checkbox', 'Show cortex') as HTMLInputElement).checked).toBe(true);
    expect((control('checkbox', 'Show internal anatomy') as HTMLInputElement).checked).toBe(false);
    expect((control('checkbox', 'Show spinal cord') as HTMLInputElement).checked).toBe(true);
  });

  test('the spinal cord is absent, not disabled, when the subject publishes none', async () => {
    await mount({ hasSpinalCord: false });
    await open('Display');
    expect(page.getByRole('checkbox', { name: 'Show spinal cord' }).elements()).toHaveLength(0);
    expect(page.getByRole('checkbox').elements()).toHaveLength(2);
  });

  test('the opacity slider speaks a percentage, steps by 5 % and goes while the cortex is hidden', async () => {
    await mount({ view: { ...liveState({}).view, cortexOpacity: 0.65 } });
    await open('Display');
    const slider = control('slider', 'Cortex opacity') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('65%');
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(commands.setCortexOpacity).toHaveBeenCalledOnce();
    expect(commands.setCortexOpacity.mock.calls[0]![0]).toBeCloseTo(0.7, 10);

    live.view.cortexVisible = false;
    flushSync();
    expect(page.getByRole('slider').elements()).toHaveLength(0);
  });

  test('the percentage follows the language: a narrow space before the sign in French', async () => {
    await mount({ lang: 'fr', view: { ...liveState({}).view, cortexOpacity: 0.65 } });
    await open('Affichage');
    expect(control('slider', 'Opacité du cortex').getAttribute('aria-valuetext')).toBe('65 %');
  });
});

describe('a tool that goes away', () => {
  test('over the tract reference closes its popover and hands focus to the model, not the page', async () => {
    await mount();
    await open('Display');
    expect(active()).toBe(control('radio', 'Both'));
    live.tractReference = true;
    flushSync();
    await vi.waitFor(() => expect(dialogs()).toHaveLength(0));
    expect(active()).toBe(canvas());
  });

  test('a focused tool that goes hands focus on too', async () => {
    await mount();
    tool('Section').focus();
    live.tractReference = true;
    flushSync();
    await vi.waitFor(() => expect(active()).toBe(canvas()));
  });

  test('the Coordinate tool goes with the coordinate spaces, handing focus to the first tool', async () => {
    await mount();
    await open('Coordinate');
    live.coordinates = false;
    flushSync();
    await vi.waitFor(() => expect(dialogs()).toHaveLength(0));
    expect(active()).toBe(tool('Section'));
  });

  test('a dock the sheet has covered closes whatever is open, and leaves focus where it was put', async () => {
    await mount();
    await open('Display');
    stage.sheetFull = true;
    flushSync();
    await vi.waitFor(() => expect(dialogs()).toHaveLength(0));
    expect(tool('Display').getAttribute('aria-expanded')).toBe('false');
    // Nothing under the sheet takes the focus (WCAG 2.4.11), not a tool and not anything in the dock.
    expect(dock().contains(active())).toBe(false);
  });

  test('is not drawn while the anatomy loads, and a popover open then closes', async () => {
    await mount();
    await open('Display');
    live.status = 'loading';
    flushSync();
    await vi.waitFor(() => expect(dialogs()).toHaveLength(0));
    expect(getComputedStyle(dock()).visibility).toBe('hidden');
    live.status = 'switching';
    flushSync();
    expect(getComputedStyle(dock()).visibility).toBe('visible');
  });
});

describe('placement', () => {
  const host = () => document.getElementById('viewport')!;

  test('opens above the whole dock on its start edge, whichever tool opened it', async () => {
    await mount();
    for (const name of ['Section', 'Display']) {
      await open(name);
      const box = popover().getBoundingClientRect();
      const plate = dock().getBoundingClientRect();
      expect(box.left, name).toBeCloseTo(plate.left, 0);
      // Layout width: the popover may still be growing in, scaled.
      expect(popover().offsetWidth, name).toBe(272);
      expect(box.bottom, name).toBeLessThan(plate.top);
      await userEvent.keyboard('{Escape}');
    }
  });

  test('on a phone it fills the stage between the gutters and leaves the top third in sight', async () => {
    await mount({ phone: true }, { width: 390, height: 700, bottomInset: 200 });
    // Text at 200 % makes the popover taller than the room.
    document.documentElement.style.fontSize = '200%';
    try {
      await open('Display');
      await vi.waitFor(() => expect(popover().offsetWidth).toBe(350));
      const box = popover().getBoundingClientRect();
      const stageTop = host().getBoundingClientRect().top;
      const dockTop = dock().getBoundingClientRect().top - stageTop;
      expect(box.top - stageTop).toBeGreaterThanOrEqual(dockTop / 3 - 1);
      expect(box.left).toBeCloseTo(20, 0);
      expect(popover().scrollHeight).toBeGreaterThan(popover().clientHeight);
      // The last control is reachable: focus scrolls it into the part of the popover that shows.
      const last = control('checkbox', 'Show spinal cord');
      last.focus();
      const reached = last.getBoundingClientRect();
      const shown = popover().getBoundingClientRect();
      expect(reached.top).toBeGreaterThanOrEqual(shown.top - 1);
      expect(reached.bottom).toBeLessThanOrEqual(shown.bottom + 1);
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });
});

describe('size, reflow and media', () => {
  const measure = (selector: string) =>
    [...document.querySelectorAll<HTMLElement>(selector)].map((node) => ({
      name: node.getAttribute('aria-label') ?? node.textContent!.trim(),
      // Layout sizes: a popover that is still growing in is scaled.
      box: { width: node.offsetWidth, height: node.offsetHeight },
    }));
  const targets = async () => {
    await open('Display');
    const measured = [
      ...measure('.stage-tool'),
      ...measure('.popover [role="radio"], .popover label.check'),
    ];
    await userEvent.keyboard('{Escape}');
    return measured;
  };

  test('every target is 24 px, and 44 px on a coarse pointer', async () => {
    await mount();
    for (const { name, box } of await targets()) {
      expect(box.height, name).toBeGreaterThanOrEqual(24);
      expect(box.width, name).toBeGreaterThanOrEqual(24);
    }
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const { name, box } of await targets()) {
        expect(box.height, name).toBeGreaterThanOrEqual(44);
        expect(box.width, name).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('hemisphere buttons and tick boxes have the legacy sizes', async () => {
    await mount();
    const sizes = async () => {
      await open('Display');
      const radios = [...document.querySelectorAll<HTMLElement>('.popover [role="radio"]')].map(
        (node) => node.offsetHeight,
      );
      await userEvent.keyboard('{Escape}');
      return radios;
    };
    // components.css:221.
    expect(await sizes()).toEqual(Array(3).fill(28));
    // stage.css:638: every choice in a phone popover is a full 44 px target.
    await page.viewport(390, 844);
    expect(await sizes()).toEqual(Array(3).fill(44));
    await page.viewport(1280, 800);

    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      await open('Display');
      const box = document.querySelector<HTMLInputElement>('.popover input[type="checkbox"]')!;
      // phone.css:329, 335.
      expect([box.offsetWidth, box.offsetHeight]).toEqual([20, 20]);
      const tick = getComputedStyle(box, '::before');
      expect([tick.width, tick.height]).toEqual(['11px', '6px']);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test.each(['en', 'fr'] as const)(
    '%s: text at 200 % and the WCAG 1.4.12 spacing clip nothing in the dock or its popovers',
    async (lang) => {
      await mount({ lang }, { width: 900, height: 700 });
      document.documentElement.style.fontSize = '200%';
      const spacing = document.head.appendChild(document.createElement('style'));
      spacing.textContent =
        '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
      try {
        const clipped = () =>
          [
            ...document.querySelectorAll<HTMLElement>(
              '.stage-tool, .popover button, .popover label, .popover p, .popover [role="radio"]',
            ),
          ]
            .filter(
              (node) =>
                node.scrollWidth > node.clientWidth + 0.5 ||
                node.scrollHeight > node.clientHeight + 0.5,
            )
            .map((node) => node.textContent!.trim());
        expect(clipped(), 'the dock').toEqual([]);
        for (const name of lang === 'en' ? ['Display'] : ['Affichage']) {
          await open(name);
          expect(clipped(), name).toEqual([]);
          expect(popover().scrollWidth, name).toBeLessThanOrEqual(popover().clientWidth);
          await userEvent.keyboard('{Escape}');
        }
      } finally {
        spacing.remove();
        document.documentElement.style.fontSize = '';
      }
    },
  );

  test('at 200 % text on a phone the tools wrap inside the dock, which stays inside the stage', async () => {
    await mount({ phone: true }, { width: 390, height: 700 });
    document.documentElement.style.fontSize = '200%';
    try {
      await vi.waitFor(() => expect(tool('Section').offsetHeight).toBeGreaterThan(0));
      const plate = dock().getBoundingClientRect();
      const stageBox = document.getElementById('viewport')!.getBoundingClientRect();
      expect(plate.right).toBeLessThanOrEqual(stageBox.right);
      for (const node of dock().querySelectorAll<HTMLElement>('.stage-tool')) {
        expect(node.getBoundingClientRect().right, node.textContent!.trim()).toBeLessThanOrEqual(
          plate.right,
        );
      }
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  test('forced colours give the open tool an edge of its own', async () => {
    await mount();
    await press('button', 'Display');
    await vi.waitFor(() => expect(tool('Display').getAttribute('aria-expanded')).toBe('true'));
    expect(getComputedStyle(tool('Display')).outlineStyle).toBe('none');
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const outline = getComputedStyle(tool('Display'));
      expect(outline.outlineStyle).toBe('solid');
      expect(outline.outlineWidth).toBe('2px');
    });
  });

  test('reduced motion turns the chevron at once', async () => {
    await mount();
    const chevron = tool('Display').querySelector('.stage-tool-chevron')!;
    expect(parseFloat(getComputedStyle(chevron).transitionDuration)).toBeGreaterThan(0);
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], () => {
      expect(parseFloat(getComputedStyle(chevron).transitionDuration)).toBe(0);
    });
  });
});

describe('accessibility (axe)', () => {
  test.each(['en', 'fr'] as const)('%s: clean with each popover open', async (lang) => {
    await mount({ lang });
    const names =
      lang === 'en'
        ? ['Section', 'Lesion', 'Coordinate', 'Display']
        : ['Coupe', 'Lésion', 'Coordonnée', 'Affichage'];
    await expectAxeClean();
    for (const name of names) {
      await open(name);
      await expectAxeClean();
      await userEvent.keyboard('{Escape}');
    }
  });
});

describe('placing a lesion from the Lesion popover', () => {
  test('places only once chosen there: a press on the stage then keeps it open, and closing ends it', async () => {
    await mount();
    await press('button', 'Lesion');
    expect(tool('Lesion').getAttribute('aria-expanded')).toBe('true');
    // Open, a click on the brain still selects until the reader chooses to place.
    expect(placing.at(-1)).toBe(false);
    await press('button', 'Place');
    await vi.waitFor(() => expect(placing.at(-1)).toBe(true));
    await userEvent.click(canvas()!);
    expect(tool('Lesion').getAttribute('aria-expanded')).toBe('true');
    expect(placing.at(-1)).toBe(true);
    await press('button', 'After');
    await vi.waitFor(() => expect(tool('Lesion').getAttribute('aria-expanded')).toBe('false'));
    expect(placing.at(-1)).toBe(false);
    // Opened again, the popover starts back on selecting.
    await press('button', 'Lesion');
    expect(control('button', 'Place').getAttribute('aria-pressed')).toBe('false');
    expect(placing.at(-1)).toBe(false);
  });

  test('another tool opened in its place ends placing', async () => {
    await mount();
    await press('button', 'Lesion');
    await press('button', 'Place');
    await vi.waitFor(() => expect(placing.at(-1)).toBe(true));
    await press('button', 'Section');
    await vi.waitFor(() => expect(placing.at(-1)).toBe(false));
  });

  test('a press on the stage closes the popover while a click selects', async () => {
    await mount();
    await press('button', 'Lesion');
    await userEvent.click(canvas()!);
    await vi.waitFor(() => expect(tool('Lesion').getAttribute('aria-expanded')).toBe('false'));
    expect(placing.every((on) => !on)).toBe(true);
  });

  test('a press on the stage closes the Section popover: only the Lesion popover holds it', async () => {
    await mount();
    await press('button', 'Section');
    await userEvent.click(canvas()!);
    await vi.waitFor(() => expect(tool('Section').getAttribute('aria-expanded')).toBe('false'));
  });

  test('is not offered over the tract reference, so nothing is placed there', async () => {
    await mount({ tractReference: true });
    expect(page.getByRole('button', { name: 'Lesion' }).elements()).toHaveLength(0);
    expect(placing.at(-1)).toBe(false);
  });
});
