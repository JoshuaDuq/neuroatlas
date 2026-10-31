// The orientation gizmo over the fake engine in a real browser: where the six directions are drawn, what a
// letter, the centre, a chevron and Reset view do, and the APG Toolbar keys and WCAG 2.5.7 it answers to.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';
import { flushSync } from 'svelte';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { ORBIT_STEP } from '../../lib/engine/render/keyboard-orbit.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import { PREF_KEYS } from '../../lib/state/prefs.ts';
import type { Language, Manifest, ViewName } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import type { DockCommands } from './dock-commands.ts';
import Fixture from './orientation-gizmo-test-support.svelte';

let engine: FakeEngine;
let stage: StageLayout;
let live: { lang: Language; ready: boolean; view: string };
let commands: { chooseView: Mock<DockCommands['chooseView']>; reset: Mock<DockCommands['reset']> };
let stop: () => void;

function liveState(overrides: Partial<typeof live>) {
  const state = $state({ lang: 'en' as Language, ready: true, view: 'oblique', ...overrides });
  return state;
}

async function mount(
  overrides: Partial<typeof live> = {},
  insets = { top: 0, right: 0, keyTop: 0, keyRight: 0 },
) {
  engine = createFakeEngine({ manifest: manifest as unknown as Manifest });
  live = liveState(overrides);
  stop = $effect.root(() => {
    stage = createStageLayout({ media: { phone: false } });
  });
  // As the stage region wires it: the session names the view and the camera frames it.
  commands = {
    chooseView: vi.fn((name: ViewName) => {
      live.view = name;
      engine.camera.applyView(name);
    }),
    reset: vi.fn(),
  };
  await render(Fixture, { engine, stage, live, commands, insets });
  flushSync();
}

const gizmo = () => document.querySelector<HTMLElement>('.orientation-gizmo')!;
const button = (name: string) =>
  page.getByRole('button', { name, exact: true }).element() as HTMLElement;
const letter = (code: string) =>
  document.querySelector<HTMLElement>(`.gizmo-letter[data-letter="${code}"]`)!;
const centreOf = (node: Element) => {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};
/** Where a letter is drawn from the gizmo's centre, in pixels, x right and y down. */
const offset = (code: string) => {
  const disc = centreOf(document.querySelector('.gizmo-field')!);
  const at = centreOf(letter(code));
  return { x: at.x - disc.x, y: at.y - disc.y };
};
const depth = (code: string) => Number(letter(code).style.zIndex);
const pressed = () =>
  [...gizmo().querySelectorAll('[aria-pressed="true"]')].map((node) =>
    node.getAttribute('aria-label'),
  );
const active = () => document.activeElement;
/** Looking down a diagonal: no two directions, and none of them the centre, overlap. */
function diagonal() {
  const [a, b, c] = [1 / Math.sqrt(2), 1 / Math.sqrt(6), 1 / Math.sqrt(3)];
  engine.emit('camera', {
    ...engine.camera.view,
    basis: { right: [a, -a, 0], up: [b, b, -2 * b], back: [c, c, c] },
  });
}

beforeEach(async () => {
  localStorage.removeItem(PREF_KEYS.stageHint);
  await page.viewport(1280, 800);
});

afterEach(() => {
  cleanup();
  stop();
  localStorage.removeItem(PREF_KEYS.stageHint);
});

describe('the directions', () => {
  test('seen from the front, the subject’s left is on the right, superior above, and anterior in front', async () => {
    await mount();
    engine.camera.applyView('anterior', { immediate: true });
    expect(offset('L').x).toBeGreaterThan(20);
    expect(offset('R').x).toBeLessThan(-20);
    expect(offset('S').y).toBeLessThan(-20);
    expect(offset('I').y).toBeGreaterThan(20);
    expect(Math.abs(offset('S').x)).toBeLessThan(1);
    // A faces the viewer, at the centre and over everything; P is behind it.
    expect(Math.hypot(offset('A').x, offset('A').y)).toBeLessThan(1);
    expect(depth('A')).toBe(Math.max(...['R', 'L', 'S', 'I', 'P', 'A'].map(depth)));
    expect(depth('A')).toBeGreaterThan(depth('P'));
    expect(letter('P').dataset.facing).toBe('away');
    expect(letter('A').getBoundingClientRect().width).toBeGreaterThan(
      letter('P').getBoundingClientRect().width,
    );
  });

  test('follow every camera event, not only the views', async () => {
    await mount();
    engine.emit('camera', {
      ...engine.camera.view,
      basis: { right: [0, 1, 0], up: [-1, 0, 0], back: [0, 0, 1] },
    });
    // Superior now points to screen right, and the subject's right down the screen.
    expect(offset('S').x).toBeGreaterThan(20);
    expect(offset('R').y).toBeGreaterThan(20);
    expect(depth('P')).toBeGreaterThan(depth('A'));
  });

  test('the centre sits over the directions pointing away and under those pointing toward the viewer', async () => {
    await mount();
    const centre = Number(getComputedStyle(document.querySelector('.gizmo-centre')!).zIndex);
    for (const code of ['R', 'L', 'S', 'I', 'P', 'A']) {
      if (letter(code).dataset.facing === 'away') expect(depth(code), code).toBeLessThan(centre);
      else expect(depth(code), code).toBeGreaterThanOrEqual(centre);
    }
  });

  test('are lettered in French, and the buttons named there', async () => {
    await mount({ lang: 'fr' });
    expect(letter('R').textContent!.trim()).toBe('D');
    expect(letter('L').textContent!.trim()).toBe('G');
    expect(button('Vue gauche')).toBe(letter('L'));
    expect(page.getByRole('toolbar', { name: 'Vue anatomique' }).elements()).toHaveLength(1);
  });
});

describe('choosing a view', () => {
  test.each([
    ['Right view', 'right'],
    ['Left view', 'left'],
    ['Anterior view', 'anterior'],
    ['Posterior view', 'posterior'],
    ['Superior view', 'superior'],
    ['Inferior view', 'inferior'],
  ] as const)('%s frames %s and retires the hint', async (name, view) => {
    await mount();
    diagonal();
    await userEvent.click(button(name));
    expect(commands.chooseView.mock.calls).toEqual([[view]]);
    expect(stage.hintRetired).toBe(true);
  });

  test('the letter of each button is the direction it frames', async () => {
    await mount();
    const named = Object.fromEntries(
      [...gizmo().querySelectorAll<HTMLElement>('.gizmo-letter')].map((node) => [
        node.textContent!.trim(),
        node.getAttribute('aria-label'),
      ]),
    );
    expect(named).toEqual({
      R: 'Right view',
      L: 'Left view',
      S: 'Superior view',
      I: 'Inferior view',
      P: 'Posterior view',
      A: 'Anterior view',
    });
  });

  test('the centre frames the oblique view', async () => {
    await mount();
    diagonal();
    await userEvent.click(button('Oblique view'));
    expect(commands.chooseView.mock.calls).toEqual([['oblique']]);
    expect(stage.hintRetired).toBe(true);
  });

  test('a view reads as pressed only while the engine holds it', async () => {
    await mount();
    expect(pressed()).toEqual(['Oblique view']);
    diagonal();
    await userEvent.click(button('Left view'));
    expect(pressed()).toEqual(['Left view']);
    expect(getComputedStyle(letter('L')).backgroundColor).not.toBe(
      getComputedStyle(letter('R')).backgroundColor,
    );
    // A drag, a key or a chevron moves the camera off it; the session still names the view.
    engine.camera.orbitBy({ azimuth: 0.1 });
    flushSync();
    expect(pressed()).toEqual([]);
    expect(live.view).toBe('left');
  });

  test('Reset view resets through the controller', async () => {
    await mount();
    await userEvent.click(button('Reset view'));
    expect(commands.reset).toHaveBeenCalledOnce();
    expect(button('Reset view').dataset.tooltip).toBe('Reset view');
  });
});

describe('the chevrons (WCAG 2.5.7)', () => {
  test('are a named group of four, one arrow key of the canvas each, and leave the held view', async () => {
    await mount();
    const turn = vi.spyOn(engine.camera, 'orbitBy');
    expect(
      page.getByRole('group', { name: 'Turn the model' }).element().querySelectorAll('button'),
    ).toHaveLength(4);
    const expected = [
      ['Turn left', { azimuth: ORBIT_STEP }],
      ['Turn right', { azimuth: -ORBIT_STEP }],
      ['Turn up', { polar: ORBIT_STEP }],
      ['Turn down', { polar: -ORBIT_STEP }],
    ] as const;
    for (const [name, step] of expected) {
      turn.mockClear();
      await userEvent.click(button(name));
      expect(turn.mock.calls, name).toEqual([[step]]);
      expect(button(name).dataset.tooltip).toBe(name);
    }
    expect(pressed()).toEqual([]);
    expect(stage.hintRetired).toBe(true);
  });

  test('sit on the ring, each at its own side', async () => {
    await mount();
    const disc = centreOf(document.querySelector('.gizmo-field')!);
    const at = (name: string) => centreOf(button(name));
    expect(at('Turn left').x).toBeLessThan(disc.x - 30);
    expect(at('Turn right').x).toBeGreaterThan(disc.x + 30);
    expect(at('Turn up').y).toBeLessThan(disc.y - 30);
    expect(at('Turn down').y).toBeGreaterThan(disc.y + 30);
  });
});

describe('the toolbar', () => {
  test('is one Tab stop, on the held view, that the arrows walk', async () => {
    await mount();
    // The canvas comes first in the stage, as the engine puts it.
    document.getElementById('stage-canvas')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(button('Oblique view'));
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(button('Right view'));
    await userEvent.keyboard('{End}');
    expect(active()).toBe(button('Reset view'));
    await userEvent.keyboard('{Enter}');
    expect(commands.reset).toHaveBeenCalledOnce();
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(button('After'));
  });

  test('marks its keys as its own (decision 7)', async () => {
    await mount();
    expect(gizmo().hasAttribute('data-own-keys')).toBe(true);
  });

  test('is not drawn while the anatomy is not on screen', async () => {
    await mount({ ready: false });
    expect(gizmo().checkVisibility()).toBe(false);
    live.ready = true;
    flushSync();
    expect(gizmo().checkVisibility()).toBe(true);
  });
});

describe('size', () => {
  test('its targets are 24 px; on a coarse pointer the chevrons and Reset view grow to 44 px and the glyphs stay', async () => {
    await mount();
    const turns = () =>
      [...gizmo().querySelectorAll<HTMLElement>('.icon-button')].map((node) => [
        node.offsetWidth,
        node.offsetHeight,
      ]);
    const glyph = () => centreOf(button('Turn right').querySelector('svg')!).x;
    for (const node of gizmo().querySelectorAll<HTMLElement>('button')) {
      expect(node.offsetWidth).toBe(24);
      expect(node.offsetHeight).toBe(24);
    }
    const drawn = glyph();
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      expect(turns()).toEqual(Array(5).fill([44, 44]));
      expect(glyph()).toBeCloseTo(drawn, 0);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('draws no plate: only the letters, the axes and the glyphs are painted', async () => {
    await mount();
    for (const node of [gizmo(), document.querySelector('.gizmo-field')!]) {
      expect(getComputedStyle(node).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    }
    expect(gizmo().getBoundingClientRect().width).toBeLessThanOrEqual(120);
  });
});

describe('placement', () => {
  test('top right of the visible stage, inside the colour keys’ band', async () => {
    await mount({}, { top: 30, right: 40, keyTop: 0, keyRight: 120 });
    const host = document.getElementById('viewport')!.getBoundingClientRect();
    const box = gizmo().getBoundingClientRect();
    const gutter = parseFloat(getComputedStyle(gizmo()).getPropertyValue('--stage-gutter'));
    expect(box.top - host.top).toBeCloseTo(30 + gutter, 0);
    expect(host.right - box.right).toBeCloseTo(40 + 120 + gutter, 0);
  });
});

describe('accessibility (axe)', () => {
  test.each(['en', 'fr'] as const)('%s: clean', async (lang) => {
    await mount({ lang });
    await expectAxeClean();
  });
});
