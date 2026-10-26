// The phone sheet in a real browser: the legacy sheet.test.js cases as behaviour (a hand-made DOM stub
// there), the Material 3 standard-sheet and WCAG 2.2 criteria of the H6 decision record on #45, and the
// desktop to phone transition after load that G1's review asked H6 to cover (#4, issuecomment-6405672591).
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { expectAxeClean, expectAxeCleanHere, withMedia } from '../../lib/ui/a11y-test-support.ts';
import '../../app/layout.css';
import { newWorld, type World } from '../workspace/workspace-test-world.ts';
import Fixture from './sheet-test-support.svelte';
import { newRecorded, type Recorded } from './sheet-test-support.ts';

const PHONE: [number, number] = [390, 844];
const SIDEWAYS: [number, number] = [844, 390];
const DESKTOP: [number, number] = [1280, 800];

const el = (id: string) => document.getElementById(id) as HTMLElement;
const sheet = () => el('sheet');
const handle = () => document.querySelector('.sheet-handle') as HTMLButtonElement;
const strip = () => document.querySelector('.sheet-selection') as HTMLButtonElement;
const clearButton = () => document.querySelector('.sheet-selection-clear') as HTMLButtonElement;
const tab = (name: string) => page.getByRole('tab', { name, exact: true });
const tablist = () => document.querySelector('[role=tablist]') as HTMLElement;
const announced = () => document.querySelector('[role=status]')!.textContent;
const focused = () => document.activeElement;
const box = (element: Element) => element.getBoundingClientRect();
const stageBox = () => box(el('viewport'));
/** The sheet's written size along its axis. */
const span = () => parseFloat(sideways() ? sheet().style.width : sheet().style.height);
const sideways = () => innerWidth > innerHeight && innerHeight <= 480;
/** Animations still playing; a finished one that holds its end state stays listed, so it is skipped. */
const playing = (target: Element | Document) =>
  target.getAnimations().filter((animation) => animation.playState !== 'finished');
/**
 * The sheet has glided to where it was told to be. A transition that a newer one replaces rejects
 * its `finished` with an AbortError, so every one is waited on and the sheet is looked at again.
 */
const rested = async () => {
  for (let running = playing(sheet()); running.length > 0; running = playing(sheet()))
    await Promise.allSettled(running.map((animation) => animation.finished));
};
const contrast = (a: string, b: string) => {
  const luminance = (colour: string) => {
    const [r, g, bl] = colour
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map((c) => {
        const v = Number(c) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
/**
 * The window size last asked for. A case that needs the size it already has does not ask again, so a
 * run of phone cases resizes once, not three times each.
 */
let requested: readonly [number, number] | null = null;
async function resize(width: number, height: number) {
  if (requested?.[0] === width && requested[1] === height) return;
  requested = [width, height];
  await page.viewport(width, height);
  // The new size reaches the frame in a later rendering step.
  await expect.poll(() => [innerWidth, innerHeight]).toEqual([width, height]);
}
/** The sheet's 240 ms glide is zeroed for every case but the ones that test motion. */
const glide = () => document.documentElement.style.removeProperty('--camera-transition');
const lastInsets = (recorded: Recorded) => recorded.insets.at(-1)!;

interface Mounted {
  world: World;
  stage: { sheetFull: boolean };
  recorded: Recorded;
}

async function mount(size = PHONE, fields: Partial<World> = {}, rows = 3): Promise<Mounted> {
  await resize(...size);
  const world = $state(newWorld(fields));
  const stage = { sheetFull: false };
  const recorded = newRecorded();
  render(Fixture, { world, stage, recorded, rows });
  await expect.element(tab(world.lang === 'fr' ? 'Anatomie' : 'Anatomy')).toBeVisible();
  return { world, stage, recorded };
}

/** A pointer event with a controlled time: the release velocity is read from `timeStamp`. */
function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  target: EventTarget,
  { x = 30, y = 0, at = 0, id = 1, primary = true, button = 0 } = {},
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: id,
    isPrimary: primary,
    button,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'timeStamp', { value: at });
  target.dispatchEvent(event);
}

/**
 * Presses on `target` (the handle) and returns the finger. `grow` is how far the sheet has been pulled
 * open, whichever axis it is on: upward upright, rightward sideways. `time` is the event's time in ms.
 */
function grip(target: Element = handle(), id = 1) {
  const rect = box(target);
  const x = rect.left + rect.width / 2;
  const y = rect.top + 4;
  const at = (grow: number) => (sideways() ? { x: x + grow, y } : { x, y: y - grow });
  pointer('pointerdown', target, { ...at(0), at: 0, id });
  return {
    move: (grow: number, time: number, from = id) =>
      pointer('pointermove', window, { ...at(grow), at: time, id: from }),
    release: (grow: number, time: number) =>
      pointer('pointerup', window, { ...at(grow), at: time, id }),
    cancel: (grow: number, time: number, from = id) =>
      pointer('pointercancel', window, { ...at(grow), at: time, id: from }),
  };
}

const halfSpan = () => Math.round((sideways() ? innerWidth : stageBox().height) * 0.5);
const fullSpan = () => (sideways() ? Math.round(innerWidth * 0.62) : stageBox().height - 128);
const dragging = () => sheet().dataset.dragging;

beforeEach(() => {
  // Every change of rest would otherwise wait out the glide, and a click waits for the handle to stop.
  document.documentElement.style.setProperty('--camera-transition', '0s');
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
  document.head.querySelectorAll('style[data-test]').forEach((style) => style.remove());
});
afterAll(() => page.viewport(...DESKTOP));

describe('the shell', () => {
  test('on a phone the sheet is a fixed bottom sheet at peek, hugging its tabs, with its panels hidden', async () => {
    const { recorded } = await mount();
    await rested();
    const rect = box(sheet());
    expect(getComputedStyle(sheet()).position).toBe('fixed');
    expect(rect.bottom).toBe(innerHeight);
    expect(sheet().dataset.detent).toBe('peek');
    expect(sheet().hasAttribute('data-own-keys')).toBe(true);
    // Peek ends where the tabs do: nothing of the grip is cut off, and no slack is left under it.
    expect(box(tablist()).bottom).toBeLessThanOrEqual(rect.bottom);
    expect(rect.bottom - box(tablist()).bottom).toBeLessThan(3);
    expect(getComputedStyle(el('navigator')).visibility).toBe('hidden');
    expect(getComputedStyle(el('inspector')).visibility).toBe('hidden');
    // The span reported is the one drawn.
    expect(lastInsets(recorded)).toEqual({
      insets: { top: 0, right: 0, bottom: rect.height, left: 0 },
      settle: true,
    });
  });

  test('on a desktop the sheet is not a box and the grip is gone', async () => {
    const { recorded, stage } = await mount(DESKTOP);
    expect(getComputedStyle(sheet()).display).toBe('contents');
    expect(handle().checkVisibility()).toBe(false);
    expect(sheet().dataset.detent).toBeUndefined();
    expect(sheet().style.height).toBe('');
    expect(lastInsets(recorded).insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(stage.sheetFull).toBe(false);
    expect(getComputedStyle(el('navigator')).visibility).toBe('visible');
  });

  test('a desktop window narrowed to a phone after load sets the sheet up and reports its cover', async () => {
    const { recorded } = await mount(DESKTOP);
    await resize(...PHONE);
    await vi.waitFor(() => expect(sheet().dataset.detent).toBe('peek'));
    // The report that matters is the last one, from a laid-out grip: legacy's first one could stay at 0.
    await vi.waitFor(() => {
      const bottom = lastInsets(recorded).insets.bottom!;
      expect(bottom).toBeGreaterThan(60);
      expect(bottom).toBe(Math.round(box(sheet()).height));
    });
    await resize(...DESKTOP);
    await vi.waitFor(() => expect(sheet().dataset.detent).toBeUndefined());
    expect(lastInsets(recorded).insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(sheet().style.height).toBe('');
  });

  test('a phone held sideways is a side sheet from the stage top, and rotating swaps the axis', async () => {
    const { recorded } = await mount(PHONE);
    await resize(...SIDEWAYS);
    await vi.waitFor(() => expect(sheet().style.width).not.toBe(''));
    await rested();
    expect(sheet().style.height).toBe('');
    expect(sheet().style.top).toBe(`${Math.round(stageBox().top)}px`);
    expect(box(sheet()).left).toBe(0);
    // Peek is as wide as the one row of tabs, and the cover is reported on the left edge.
    expect(box(tablist()).right).toBeLessThanOrEqual(box(sheet()).right);
    expect(box(sheet()).right - box(tablist().lastElementChild!).right).toBeLessThan(40);
    expect(lastInsets(recorded).insets).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: span(),
    });
    await resize(...PHONE);
    await vi.waitFor(() => expect(sheet().style.height).not.toBe(''));
    expect(sheet().style.width).toBe('');
    expect(sheet().style.top).toBe('');
  });

  test('a narrow landscape window taller than 480 px keeps the bottom sheet', async () => {
    await mount([780, 700]);
    expect(sheet().style.height).not.toBe('');
    expect(sheet().style.width).toBe('');
    expect(getComputedStyle(sheet()).bottom).toBe('0px');
  });
});

describe('the handle', () => {
  test('steps peek, half, full, peek: names, announces, reports and tells the stage about a full sheet', async () => {
    const { recorded, stage } = await mount();
    const vh = stageBox().height;
    const rests: [number, string, string, boolean][] = [
      [Math.round(vh * 0.5), 'Expand panel', 'Panel half open', false],
      [vh - 128, 'Collapse panel', 'Panel fully open', true],
    ];
    const peek = span();
    for (const [expected, name, message, full] of rests) {
      await userEvent.click(handle());
      expect(span()).toBe(expected);
      expect(handle().getAttribute('aria-label')).toBe(name);
      expect(announced()).toBe(message);
      expect(stage.sheetFull).toBe(full);
      expect(lastInsets(recorded).insets.bottom).toBe(expected);
    }
    await userEvent.click(handle());
    expect(span()).toBe(peek);
    expect(handle().getAttribute('aria-label')).toBe('Expand panel');
    expect(announced()).toBe('Panel collapsed');
    expect(stage.sheetFull).toBe(false);
    expect(recorded.detents).toEqual(['half', 'full', 'peek']);
  });

  test('a keyboard activation moves the sheet without a glide, a pointer one restores motion', async () => {
    await mount();
    handle().focus();
    await userEvent.keyboard('{Enter}');
    expect(sheet().dataset.detent).toBe('half');
    expect(sheet().hasAttribute('data-instant')).toBe(true);
    await userEvent.click(handle());
    expect(sheet().dataset.detent).toBe('full');
    expect(sheet().hasAttribute('data-instant')).toBe(false);
    handle().focus();
    await userEvent.keyboard(' ');
    expect(sheet().dataset.detent).toBe('peek');
    expect(sheet().hasAttribute('data-instant')).toBe(true);
  });

  test('it is a named native button, the name is French in French, and Escape leaves the sheet alone', async () => {
    await mount(PHONE, { lang: 'fr' });
    expect(handle().tagName).toBe('BUTTON');
    expect(handle().getAttribute('aria-label')).toBe('Déplier le panneau');
    expect(handle().getAttribute('aria-controls')).toBe('workspace-panel');
    expect(el('workspace-panel')).not.toBeNull();
    expect(handle().hasAttribute('aria-expanded')).toBe(false);
    handle().focus();
    await userEvent.keyboard('{Enter}');
    expect(announced()).toBe('Panneau à moitié ouvert');
    await userEvent.keyboard('{Escape}');
    expect(sheet().dataset.detent).toBe('half');
    expect(document.body.textContent).toContain('Pas une anatomie clinique');
  });
});

describe('dragging the grip', () => {
  test('a slow drag moves only past 8 px, follows the finger unsettled, and settles on the nearest rest', async () => {
    const { recorded } = await mount();
    await rested();
    const peek = span();
    const finger = grip();
    finger.move(7, 10);
    expect(dragging()).toBe('false');
    expect(span()).toBe(peek);
    finger.move(halfSpan() - peek - 30, 50);
    expect(dragging()).toBe('true');
    expect(span()).toBe(halfSpan() - 30);
    expect(lastInsets(recorded)).toMatchObject({ settle: false });
    // Released long after its last move: there is no throw, so position alone decides.
    finger.release(halfSpan() - peek - 30, 400);
    expect(dragging()).toBe('false');
    expect(span()).toBe(halfSpan());
    expect(lastInsets(recorded)).toMatchObject({ settle: true });
    expect(recorded.detents).toEqual(['half']);
    expect(announced()).toBe('Panel half open');
  });

  test('a flick moves one rest in its direction however little it travelled, and stops at the ends', async () => {
    const { stage } = await mount();
    await rested();
    const peek = span();
    // 30 px in 10 ms is 3 px/ms, though 30 px is nearer peek than half.
    let finger = grip();
    finger.move(30, 10);
    finger.release(30, 20);
    expect(span()).toBe(halfSpan());
    finger = grip();
    finger.move(-30, 10);
    finger.release(-30, 20);
    expect(span()).toBe(peek);
    await userEvent.click(handle());
    await userEvent.click(handle());
    expect(stage.sheetFull).toBe(true);
    finger = grip();
    finger.move(40, 10);
    finger.release(40, 20);
    expect(span()).toBe(fullSpan());
    expect(stage.sheetFull).toBe(true);
  });

  test('a throw that stopped before the finger lifted is not a flick', async () => {
    await mount();
    await rested();
    const peek = span();
    const finger = grip();
    finger.move(30, 10);
    finger.release(30, 170);
    expect(span()).toBe(peek);
  });

  test('past the ends the sheet resists: it follows less than the finger and never beyond 72 px', async () => {
    await mount();
    await rested();
    const peek = span();
    let finger = grip();
    finger.move(-500, 10);
    expect(span()).toBeLessThan(peek);
    expect(span()).toBeGreaterThanOrEqual(peek - 72);
    finger.release(-500, 400);
    await userEvent.click(handle());
    await userEvent.click(handle());
    await rested();
    finger = grip();
    finger.move(20, 10);
    expect(span() - fullSpan()).toBeGreaterThan(8);
    expect(span() - fullSpan()).toBeLessThan(20);
    finger.move(5000, 20);
    expect(span() - fullSpan()).toBeLessThanOrEqual(72);
    finger.release(5000, 400);
    expect(span()).toBe(fullSpan());
  });

  test('the click that ends a drag on a button is swallowed, a tap that never dragged is not', async () => {
    const { recorded } = await mount();
    await rested();
    let finger = grip();
    finger.move(60, 10);
    finger.release(60, 400);
    handle().click();
    expect(recorded.detents).toEqual(['peek']);
    // Once the release's own click is past, the handle works again.
    await new Promise((resolve) => setTimeout(resolve, 0));
    handle().click();
    expect(span()).toBe(halfSpan());
    finger = grip();
    finger.release(0, 5);
    handle().click();
    expect(span()).toBe(fullSpan());
  });

  test('a press that starts on a tab drags the sheet and does not choose the tab', async () => {
    const { recorded } = await mount();
    await rested();
    const functions = tab('Functions').element() as HTMLElement;
    const finger = grip(functions);
    finger.move(60, 10);
    expect(dragging()).toBe('true');
    finger.release(60, 400);
    functions.click();
    expect(recorded.calls).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    functions.click();
    expect(recorded.calls).toEqual(['mode:functions']);
  });

  test('a press in the panel, a secondary pointer and a second finger do not drag', async () => {
    await mount();
    await userEvent.click(handle());
    await rested();
    const rest = span();
    // In the panel, which scrolls instead.
    let finger = grip(document.querySelector('[data-row]')!);
    finger.move(100, 10);
    expect(dragging()).toBe('false');
    finger.release(100, 20);
    // A mouse's secondary button or a pen's barrel is not isPrimary: only the first contact drags.
    pointer('pointerdown', handle(), { id: 5, primary: false, y: box(handle()).top + 4 });
    pointer('pointermove', window, { id: 5, y: 100, at: 10 });
    expect(dragging()).toBe('false');
    // A second finger mid-drag would make the sheet jump to it.
    finger = grip();
    finger.move(60, 10);
    const dragged = span();
    expect(dragged).toBe(rest + 60);
    pointer('pointerdown', handle(), { id: 2, y: box(handle()).top + 4, at: 20 });
    pointer('pointermove', window, { id: 2, y: 100, at: 30 });
    expect(span()).toBe(dragged);
    finger.cancel(60, 40);
    expect(span()).toBe(rest);
  });

  test('a cancelled pointer settles on the prior rest; one that is not the finger changes nothing', async () => {
    const { recorded } = await mount();
    await userEvent.click(handle());
    await rested();
    const rest = span();
    const finger = grip();
    finger.move(100, 10);
    finger.cancel(100, 20, 2);
    expect(dragging()).toBe('true');
    expect(span()).toBe(rest + 100);
    finger.cancel(100, 30);
    expect(dragging()).toBe('false');
    expect(span()).toBe(rest);
    expect(sheet().dataset.detent).toBe('half');
    expect(lastInsets(recorded)).toMatchObject({ settle: true });
    // The press is over: a fresh drag starts.
    grip().move(100, 10);
    expect(dragging()).toBe('true');
  });

  test('losing the window cancels a drag, and a press that never became one', async () => {
    await mount();
    await userEvent.click(handle());
    await rested();
    const rest = span();
    grip().move(100, 10);
    window.dispatchEvent(new Event('blur'));
    expect(dragging()).toBe('false');
    expect(span()).toBe(rest);
    // A press before the threshold, then the window goes: the next press is the one that counts.
    grip();
    window.dispatchEvent(new Event('blur'));
    grip().move(100, 10);
    expect(dragging()).toBe('true');
  });

  test('a resize or a rotation cancels a drag, and the next one drags along the new axis', async () => {
    await mount();
    await rested();
    grip().move(100, 10);
    expect(dragging()).toBe('true');
    await resize(390, 800);
    await vi.waitFor(() => expect(dragging()).toBe('false'));
    await rested();
    const first = grip();
    first.move(60, 10);
    expect(dragging()).toBe('true');
    await resize(...SIDEWAYS);
    await vi.waitFor(() => expect(sheet().style.width).not.toBe(''));
    expect(dragging()).toBe('false');
    await rested();
    const peek = span();
    const side = grip();
    side.move(10, 10);
    expect(dragging()).toBe('true');
    expect(span()).toBe(peek + 10);
    side.release(10, 400);
    expect(sheet().dataset.detent).toBe('peek');
    expect(span()).toBe(peek);
  });

  test('a side sheet grows with a rightward drag to its own half and full rests', async () => {
    const { stage } = await mount(SIDEWAYS);
    await rested();
    expect(sideways()).toBe(true);
    const peek = span();
    let finger = grip();
    finger.move(halfSpan() - peek, 50);
    finger.release(halfSpan() - peek, 400);
    expect(span()).toBe(halfSpan());
    await rested();
    finger = grip();
    finger.move(fullSpan() - halfSpan(), 50);
    finger.release(fullSpan() - halfSpan(), 400);
    expect(span()).toBe(fullSpan());
    expect(stage.sheetFull).toBe(true);
  });
});

const SELECTION = {
  kind: 'region',
  label: 'Insula',
  side: 'L',
  sideWord: 'left',
  clearable: true,
} as const;

describe('the selection in the grip', () => {
  test('it is named at peek, the side said as a word, with its clear beside it', async () => {
    await mount(PHONE, { selection: SELECTION });
    await expect.element(page.getByRole('button', { name: 'Inspect Insula, left' })).toBeVisible();
    expect(strip().textContent).toContain('Insula');
    expect(strip().textContent).toContain('L');
    await expect.element(page.getByRole('button', { name: 'Clear selection' })).toBeVisible();
  });

  test('the peek follows the name as it arrives and goes', async () => {
    const { world } = await mount();
    await rested();
    const bare = span();
    world.selection = SELECTION;
    await vi.waitFor(() => expect(span()).toBeGreaterThan(bare));
    await rested();
    expect(innerHeight - box(tablist()).bottom).toBeLessThan(3);
    world.selection = {};
    await vi.waitFor(() => expect(span()).toBe(bare));
  });

  test('Enter on the strip raises peek to half, opens the detail and moves focus to Back, silently', async () => {
    const { recorded } = await mount(PHONE, { selection: SELECTION });
    strip().focus();
    await userEvent.keyboard('{Enter}');
    expect(span()).toBe(halfSpan());
    expect(sheet().hasAttribute('data-instant')).toBe(true);
    expect(recorded.calls).toContain('selection');
    await vi.waitFor(() => expect(focused()).toBe(document.querySelector('.detail-back')));
    expect(sheet().dataset.view).toBe('detail');
    expect(announced()).toBe('');
    // The detail names itself, so the grip stops naming it; its clear stays.
    expect(strip().checkVisibility()).toBe(false);
    expect(clearButton().checkVisibility()).toBe(true);
  });

  test('a pointer activation that left focus where it was does not take it, and a raised sheet is not lowered', async () => {
    const { recorded } = await mount(PHONE, { selection: SELECTION });
    const anatomy = tab('Anatomy').element() as HTMLElement;
    anatomy.focus();
    strip().click();
    expect(span()).toBe(halfSpan());
    await vi.waitFor(() => expect(sheet().dataset.view).toBe('detail'));
    expect(focused()).toBe(anatomy);
    await userEvent.click(handle());
    expect(span()).toBe(fullSpan());
    recorded.calls.length = 0;
    document.querySelector<HTMLElement>('.detail-back')!.click();
    await vi.waitFor(() => expect(sheet().dataset.view).toBe('list'));
    // The list has no selection strip now that the region is chosen elsewhere; the sheet stays at full.
    expect(span()).toBe(fullSpan());
  });

  test('the clear clears, and focus goes to the tab in front', async () => {
    const { recorded } = await mount(PHONE, { selection: SELECTION });
    await userEvent.click(clearButton());
    expect(recorded.calls).toEqual(['clear']);
    await vi.waitFor(() => expect(focused()).toBe(tab('Anatomy').element()));
    expect(strip()).toBeNull();
  });

  test('French names the strip and its clear, and says the sheet in French', async () => {
    await mount(PHONE, { lang: 'fr', selection: SELECTION });
    await expect.element(page.getByRole('button', { name: 'Examiner Insula, left' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Effacer la sélection' })).toBeVisible();
  });
});

describe('the tabs and the panels in the sheet', () => {
  test('choosing a tab raises a resting sheet, silently, and never lowers a raised one', async () => {
    const { recorded } = await mount();
    await userEvent.click(tab('Functions'));
    expect(span()).toBe(halfSpan());
    expect(recorded.calls).toEqual(['mode:functions']);
    expect(announced()).toBe('');
    await userEvent.click(handle());
    await userEvent.click(tab('Deficits'));
    expect(span()).toBe(fullSpan());
  });

  test('even the tab already chosen raises a resting sheet', async () => {
    await mount();
    await userEvent.click(tab('Anatomy'));
    expect(span()).toBe(halfSpan());
  });

  test('Tab walks the handle, the name, its clear, the tabs as one stop, then the panel only when it is shown', async () => {
    await mount(PHONE, { selection: SELECTION });
    handle().focus();
    await userEvent.tab();
    expect(focused()).toBe(strip());
    await userEvent.tab();
    expect(focused()).toBe(clearButton());
    await userEvent.tab();
    expect(focused()).toBe(tab('Anatomy').element());
    // At peek the panel is hidden, so nothing in it can take focus.
    await userEvent.tab();
    expect(el('navigator').contains(focused())).toBe(false);
    handle().focus();
    await userEvent.keyboard('{Enter}');
    tab('Anatomy').element().focus();
    await userEvent.tab();
    expect(focused()).toBe(page.getByRole('textbox', { name: 'Search regions' }).element());
  });

  test('settling on peek with focus in a panel moves focus to the handle instead of losing it', async () => {
    await mount();
    await userEvent.click(handle());
    await rested();
    const row = document.querySelector<HTMLElement>('[data-row]')!;
    row.focus();
    const finger = grip();
    finger.move(-30, 10);
    finger.release(-30, 20);
    expect(sheet().dataset.detent).toBe('peek');
    expect(focused()).toBe(handle());
  });

  test('settling on peek leaves focus on a tab, which stays on screen', async () => {
    await mount();
    await userEvent.click(handle());
    const anatomy = tab('Anatomy').element() as HTMLElement;
    anatomy.focus();
    await userEvent.click(handle());
    await userEvent.click(handle());
    anatomy.focus();
    expect(sheet().dataset.detent).toBe('peek');
    expect(focused()).toBe(anatomy);
  });
});

describe('entering and leaving the shell', () => {
  test('with focus in a panel, a resting sheet is lifted to half at once, so the control stays, silently', async () => {
    const { recorded } = await mount(DESKTOP);
    const row = document.querySelector<HTMLElement>('[data-row]')!;
    row.focus();
    await resize(...PHONE);
    await vi.waitFor(() => expect(sheet().dataset.detent).toBe('half'));
    expect(sheet().hasAttribute('data-instant')).toBe(true);
    expect(focused()).toBe(row);
    expect(getComputedStyle(row).visibility).toBe('visible');
    expect(recorded.detents).toEqual([]);
    expect(announced()).toBe('');
  });

  test('with focus elsewhere it rests at peek', async () => {
    await mount(DESKTOP);
    tab('Anatomy').element().focus();
    await resize(...PHONE);
    await vi.waitFor(() => expect(sheet().dataset.detent).toBe('peek'));
    expect(sheet().hasAttribute('data-instant')).toBe(false);
  });

  test('a resize on the phone re-measures the rest and says nothing', async () => {
    const { recorded } = await mount();
    await userEvent.click(handle());
    const spoken = announced();
    await resize(390, 700);
    await vi.waitFor(() => expect(span()).toBe(halfSpan()));
    expect(lastInsets(recorded).insets.bottom).toBe(halfSpan());
    expect(announced()).toBe(spoken);
  });

  test('leaving the shell from a full sheet lets the stage have its dock back', async () => {
    const { stage } = await mount();
    await userEvent.click(handle());
    await userEvent.click(handle());
    expect(stage.sheetFull).toBe(true);
    await resize(...DESKTOP);
    await vi.waitFor(() => expect(stage.sheetFull).toBe(false));
  });
});

describe('text size and motion', () => {
  test('peek follows the text: 200 % text and loosened spacing grow it so the tabs are never cut off', async () => {
    await mount();
    await rested();
    const before = span();
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.dataset.test = '';
    // WCAG 1.4.12 Text Spacing: line height 1.5, letter 0.12, word 0.16, paragraph 2 times the size.
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important }' +
      'p { margin-bottom: 2em !important }';
    await vi.waitFor(() => expect(span()).toBeGreaterThan(before));
    await rested();
    expect(box(tablist()).bottom).toBeLessThanOrEqual(innerHeight);
    expect(innerHeight - box(tablist()).bottom).toBeLessThan(3);
    // Nothing of the grip hides under the tabs.
    expect(box(document.querySelector('.sheet-grip-row')!).bottom).toBeLessThanOrEqual(
      box(tablist()).top + 1,
    );
  });

  test('a settled sheet glides, a keyboard activation does not, and reduced motion leaves a fade', async () => {
    glide();
    await mount();
    expect(getComputedStyle(sheet()).transitionProperty).toBe('height');
    await userEvent.click(handle());
    expect(getComputedStyle(sheet()).transitionDuration).toBe('0.24s');
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], () => {
      expect(getComputedStyle(sheet()).transitionProperty).toBe('opacity');
    });
    handle().focus();
    await userEvent.keyboard('{Enter}');
    expect(getComputedStyle(sheet()).transitionDuration).toBe('0s');
  });

  test('a dragged sheet follows the finger with no transition', async () => {
    glide();
    await mount();
    await rested();
    grip().move(100, 10);
    expect(getComputedStyle(sheet()).transitionDuration).toBe('0s');
  });
});

describe('targets and contrast', () => {
  test.each([[PHONE], [SIDEWAYS]] as const)(
    'every control is at least 44 px at %j',
    async (size) => {
      await mount([...size], { selection: SELECTION });
      await rested();
      const controls: [string, Element][] = [
        ['handle', handle()],
        ['name', strip()],
        ['clear', clearButton()],
        ...[...tablist().children].map((tabElement): [string, Element] => [
          tabElement.id,
          tabElement,
        ]),
      ];
      for (const [name, control] of controls) {
        const rect = box(control);
        expect(rect.height, `${name} height`).toBeGreaterThanOrEqual(44);
        expect(rect.width, `${name} width`).toBeGreaterThanOrEqual(44);
      }
    },
  );

  test('the handle bar holds 3:1 against the sheet, and under forced colours it is the system ButtonText', async () => {
    await mount();
    const bar = document.querySelector('.sheet-handle-bar')!;
    expect(
      contrast(getComputedStyle(bar).backgroundColor, getComputedStyle(sheet()).backgroundColor),
    ).toBeGreaterThanOrEqual(3);
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const probe = document.body.appendChild(document.createElement('span'));
      probe.style.color = 'ButtonText';
      const buttonText = getComputedStyle(probe).color;
      probe.remove();
      expect(getComputedStyle(bar).backgroundColor).toBe(buttonText);
      expect(
        contrast(getComputedStyle(bar).backgroundColor, getComputedStyle(sheet()).backgroundColor),
      ).toBeGreaterThanOrEqual(3);
    });
  });

  test('with a name over it, the handle still has a 24 px line a pointer reaches (WCAG 2.5.8)', async () => {
    await mount(PHONE, { selection: SELECTION });
    await rested();
    const rect = box(handle());
    const x = rect.left + rect.width / 2;
    let line = 0;
    // A quarter pixel at a time, since the line starts on a fractional edge.
    for (let y = rect.top + 0.125; y < rect.bottom; y += 0.25) {
      if (document.elementFromPoint(x, y)?.closest('.sheet-handle') !== handle()) break;
      line += 0.25;
    }
    // The 24 px line, less the pixel hit-testing snaps off a fractional edge; legacy measures 20.
    expect(line).toBeGreaterThanOrEqual(23);
  });

  test('axe finds nothing in either theme, on a phone and a desktop, with a selection and the sheet raised', async () => {
    await mount(PHONE, { selection: SELECTION });
    handle().click();
    await expectAxeClean();
    // expectAxeClean leaves the window at 1280 px.
    requested = null;
  });

  test('axe finds nothing in French', async () => {
    await mount(PHONE, { lang: 'fr', selection: SELECTION });
    await expectAxeCleanHere();
  });
});

describe('legacy cases ported, and the notice', () => {
  test('returning to the phone shell keeps the detent it left with (sheet.test.js:103-133)', async () => {
    await mount();
    await userEvent.click(handle());
    await userEvent.click(handle());
    await resize(...DESKTOP);
    await vi.waitFor(() => expect(sheet().dataset.detent).toBeUndefined());
    await resize(...PHONE);
    await vi.waitFor(() => expect(sheet().dataset.detent).toBe('full'));
    await rested();
    expect(span()).toBe(fullSpan());
  });

  test('a keyboard activation of a tab raises a resting sheet without a glide (sheet.test.js:215-222)', async () => {
    await mount();
    tab('Functions').element().focus();
    await userEvent.keyboard('{Enter}');
    expect(sheet().dataset.detent).toBe('half');
    expect(sheet().hasAttribute('data-instant')).toBe(true);
  });

  test('a notice in the grip grows the peek, is on screen, drags the sheet, and shrinks it again', async () => {
    const { world } = await mount();
    await rested();
    const bare = span();
    world.notice = { text: 'The view was restored' };
    await vi.waitFor(() => expect(span()).toBeGreaterThan(bare));
    await rested();
    const notice = document.querySelector('.notice') as HTMLElement;
    expect(box(notice).bottom).toBeLessThanOrEqual(innerHeight);
    expect(innerHeight - box(notice).bottom).toBeLessThan(3);
    const finger = grip(notice);
    finger.move(30, 10);
    expect(dragging()).toBe('true');
    finger.cancel(30, 20);
    await userEvent.click(page.getByRole('button', { name: 'Dismiss' }));
    await vi.waitFor(() => expect(span()).toBe(bare));
  });

  test('only the primary button presses the grip', async () => {
    await mount();
    await rested();
    const rect = box(handle());
    pointer('pointerdown', handle(), { x: rect.left + 30, y: rect.top + 4, button: 1 });
    pointer('pointermove', window, { x: rect.left + 30, y: rect.top - 100, at: 10 });
    expect(dragging()).toBe('false');
  });

  test('a drag that springs back to its rest announces nothing', async () => {
    await mount();
    await rested();
    const finger = grip();
    finger.move(30, 400);
    finger.release(30, 800);
    expect(sheet().dataset.detent).toBe('peek');
    expect(announced()).toBe('');
  });
});

describe('the tab row matches the legacy sheet tabs', () => {
  test('ground, label column, underline and wrapping, measured at 390 px', async () => {
    await mount();
    await rested();
    const tabs = [...tablist().children] as HTMLElement[];
    expect(getComputedStyle(tablist()).backgroundColor).toBe(
      getComputedStyle(sheet()).backgroundColor,
    );
    // The first label stands at the panel inset, under the words above it, as the last ends at 16 px from the edge.
    expect(box(tabs[0]!).left + 4).toBe(16);
    expect(box(tabs.at(-1)!).right).toBe(innerWidth - 12);
    const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true')!;
    const underline = getComputedStyle(selected, '::before');
    expect([underline.left, underline.right]).toEqual(['0px', '0px']);
    expect(getComputedStyle(selected).whiteSpace).toBe('normal');
  });

  test('held sideways the one row of tabs is 368 px, and a label never wraps', async () => {
    await mount(SIDEWAYS);
    await rested();
    // The row is as wide as its labels, which each platform's text shaping measures a little
    // differently (369 px on Linux): the sheet hugs the row it has, to the next whole pixel.
    const row =
      box(tablist().lastElementChild!).right +
      parseFloat(getComputedStyle(tablist()).paddingRight) -
      box(sheet()).left +
      parseFloat(getComputedStyle(sheet()).borderRightWidth);
    expect(span()).toBe(Math.ceil(row));
    expect(Math.abs(span() - 368)).toBeLessThanOrEqual(1);
    expect(getComputedStyle(tablist().children[0]!).whiteSpace).toBe('nowrap');
  });
});

describe('WCAG 2.4.11 Focus Not Obscured, inside the sheet', () => {
  /** Every Tab stop from the handle until focus leaves the sheet. */
  async function stops() {
    // Each box is read as focus arrives: the list scrolls under the next stop.
    const seen = (element: HTMLElement) => ({ element, rect: box(element) });
    handle().focus();
    const found = [seen(handle())];
    for (let step = 0; step < 50; step += 1) {
      await userEvent.tab();
      const active = focused() as HTMLElement;
      if (!sheet().contains(active)) break;
      found.push(seen(active));
    }
    return found;
  }

  test.each(['half', 'full'])(
    'at %s every stop is fully on screen and below the grip',
    async (rest) => {
      await mount(PHONE, { selection: SELECTION, notice: { text: 'A notice' } }, 30);
      handle().click();
      if (rest === 'full') handle().click();
      await rested();
      const grip = [
        document.querySelector('.sheet-grip-row')!,
        tablist(),
        document.querySelector('.notice')!,
      ];
      const floor = Math.max(...grip.map((part) => box(part).bottom));
      const inPanel = (await stops()).filter(({ element }) => el('navigator').contains(element));
      // The search field and every row: the list scrolled, so most began out of view.
      expect(inPanel.length).toBeGreaterThanOrEqual(31);
      for (const { element, rect } of inPanel) {
        const name = element.textContent || element.tagName;
        expect(rect.top, name).toBeGreaterThanOrEqual(floor - 0.5);
        expect(rect.bottom, name).toBeLessThanOrEqual(innerHeight + 0.5);
      }
    },
  );

  test('at peek every stop is in the grip', async () => {
    await mount(PHONE, { selection: SELECTION }, 30);
    await rested();
    const found = await stops();
    expect(found.length).toBeGreaterThanOrEqual(4);
    for (const { element, rect } of found) {
      expect(el('navigator').contains(element)).toBe(false);
      expect(rect.bottom).toBeLessThanOrEqual(innerHeight);
      expect(rect.top).toBeGreaterThanOrEqual(box(sheet()).top);
    }
  });
});

describe('the notice in the grip, once shown', () => {
  test('a notice that grows taller grows the peek with it', async () => {
    const { world } = await mount(PHONE, { notice: { text: 'Short' } });
    await rested();
    const short = span();
    world.notice = {
      text: 'A much longer message that has to wrap over several lines here. '.repeat(4),
    };
    await vi.waitFor(() => expect(span()).toBeGreaterThan(short));
    await rested();
    expect(innerHeight - box(document.querySelector('.notice')!).bottom).toBeLessThan(3);
  });
});
