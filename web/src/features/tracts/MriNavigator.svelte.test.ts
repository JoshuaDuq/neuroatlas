// The diffusion MRI navigator against the fake engine (F2): engine lifetime, keyboard paths, focus
// hand-offs, status and alert, the crosshair both ways. Ported from the behaviour of
// viewer/diffusion/navigation-ui.js (it had no unit test); each fix cites its deviation record.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
import type { MriLocation, MriNavigator } from '../../lib/engine/api.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import '../../app/layout.css';
import Fixture from './mri-navigator-test-support.svelte';

const catalog = tractCatalog('cdmd');

type Call = [name: string, args: unknown[]];

interface Instrument {
  /** Holds the navigator back until released. */
  gate?: Promise<void>;
  /** The first attempts fail with these. */
  failures?: unknown[];
  /** The navigator reports one value fewer than the catalog has maps. */
  dropValue?: boolean;
}

/** The fake engine whose navigators log every call they receive; behaviour is the fake's own. */
function instrument(options: Instrument = {}) {
  const base: FakeEngine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    tractBundles: catalog.bundles.map(({ id, name, initial }) => ({ id, name, initial })),
  });
  const calls: Call[] = [];
  const canvases: HTMLCanvasElement[] = [];
  const failures = [...(options.failures ?? [])];
  const tracts = Object.create(base.tracts, {
    createMriNavigator: {
      enumerable: true,
      value: async (canvas: HTMLCanvasElement, onLocation: (location: MriLocation) => void) => {
        await options.gate;
        if (failures.length > 0) throw failures.shift();
        canvases.push(canvas);
        const real = await base.tracts.createMriNavigator(
          canvas,
          options.dropValue
            ? (location) => onLocation({ ...location, values: location.values.slice(0, 1) })
            : onLocation,
        );
        return new Proxy(real, {
          get(target, name) {
            const member = Reflect.get(target, name);
            if (typeof member !== 'function') return member;
            return (...args: unknown[]) => {
              calls.push([String(name), args]);
              return member.apply(target, args);
            };
          },
        }) as MriNavigator;
      },
    },
  });
  const engine = Object.assign(Object.create(base), { tracts }) as FakeEngine;
  return { engine, base, calls, canvases };
}

/** A promise the test settles when it wants the navigator to arrive. */
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}

let region: HTMLElement;
let release: () => void;
beforeEach(async () => {
  await page.viewport(1280, 800);
  region = document.body.appendChild(document.createElement('div'));
  release = attachAnnouncer(region);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  release();
  region.remove();
});

const opener = () => page.getByRole('button', { name: /MRI with tracts|IRM avec faisceaux/ });
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
const canvas = () => dialog().querySelector('canvas') as HTMLCanvasElement;
const planeSelect = () => page.getByRole('combobox', { name: /^(View|Vue)$/ });
const voxelInput = (axis: string) =>
  page.getByRole('spinbutton', { name: new RegExp(`^Voxel ${axis}$`) });
const voxels = () =>
  ['i', 'j', 'k'].map((axis) => Number((voxelInput(axis).element() as HTMLInputElement).value));
const slider = (name: string) => page.getByRole('slider', { name });
const notes = () => dialog().querySelector('.notes') as HTMLElement;
const alertText = () => notes().querySelector('[role="alert"]')!.textContent!.trim();
const statusNode = () => notes().querySelector('[role="status"]') as HTMLElement;
const names = (calls: Call[], name: string) => calls.filter(([call]) => call === name);

/** Runs `action` and waits for the dialog's `close` event, after which Dialog has returned focus. */
async function closing(action: () => Promise<unknown>) {
  const closed = new Promise((resolve) =>
    dialog().addEventListener('close', resolve, { once: true }),
  );
  await action();
  await closed;
}

async function show(extra: Record<string, unknown> = {}, instrumented = instrument()) {
  await instrumented.engine.tracts.setActive(true);
  const view = await render(Fixture, { engine: instrumented.engine, lang: 'en', ...extra });
  return { ...instrumented, view };
}

async function openFromKeyboard() {
  (opener().element() as HTMLElement).focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => dialog().open).toBe(true);
}

/** Opens the dialog and waits for the navigator: the controls are enabled when it is loaded. */
async function opened(extra: Record<string, unknown> = {}, instrumented = instrument()) {
  const shown = await show(extra, instrumented);
  await openFromKeyboard();
  await expect.element(planeSelect()).toBeEnabled();
  return shown;
}

describe('opening', () => {
  test('a titled modal whose first stop is Close; the engine gets the saved state and the visible tracts', async () => {
    const { calls, base } = await opened();
    await expect
      .element(page.getByRole('dialog', { name: 'MRI with tracts · MGH CDMD sub_013' }))
      .toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(base.tracts.navigators).toHaveLength(1);
    // The centre of the 8 × 9 × 10 fake scan; the T1 window is its whole range, the level its middle.
    expect(voxels()).toEqual([4, 4, 5]);
    expect(names(calls, 'setWindow')).toEqual([['setWindow', [263, 525]]]);
    expect(names(calls, 'setFaOpacity')).toEqual([['setFaOpacity', [0]]]);
    expect(names(calls, 'setPlane')).toEqual([['setPlane', ['MULTIPLANAR']]]);
    const visible = base.tracts
      .snapshot()
      .filter((bundle) => bundle.visible)
      .map((bundle) => bundle.id);
    expect(visible.length).toBeGreaterThan(0);
    expect(names(calls, 'syncTracts')).toEqual([['syncTracts', [visible, 40]]]);
    expect(names(calls, 'resize')).toHaveLength(1);
    expect(statusNode().textContent).toBe('Reference MRI ready.');
    // Said, not shown: nothing is left on screen once the scan is up.
    expect(statusNode().getBoundingClientRect().width).toBeLessThanOrEqual(1);
  });

  test('a phone-sized window starts on the axial view', async () => {
    await page.viewport(390, 844);
    const { calls } = await opened();
    expect(names(calls, 'setPlane')).toEqual([['setPlane', ['AXIAL']]]);
    expect((planeSelect().element() as HTMLSelectElement).value).toBe('AXIAL');
  });

  test('the controls and the canvas are off until the scan has loaded, and keys are ignored', async () => {
    const held = gate();
    const { calls, base } = await show({}, instrument({ gate: held.promise }));
    await openFromKeyboard();
    await expect
      .element(page.getByText('Loading the reference MRI and selected tracts…'))
      .toBeVisible();
    expect((planeSelect().element() as HTMLSelectElement).disabled).toBe(true);
    expect((voxelInput('i').element() as HTMLInputElement).disabled).toBe(true);
    expect(canvas().tabIndex).toBe(-1);
    canvas().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    held.release();
    await expect.element(planeSelect()).toBeEnabled();
    expect(canvas().tabIndex).toBe(0);
    expect(names(calls, 'moveVoxel')).toEqual([]);
    // A key pressed with no engine yet must not become a failure.
    expect(alertText()).toBe('');
    expect(base.tracts.navigators).toHaveLength(1);
  });

  test('the atlas crosshair places the MRI crosshair once, without moving the atlas', async () => {
    const onPoint = vi.fn();
    // The fake scan has 2 mm voxels: (6, 8, 10) mm is voxel (3, 4, 5).
    await opened({ getPoint: () => [6, 8, 10], onPoint });
    expect(voxels()).toEqual([3, 4, 5]);
    expect(statusNode().textContent).toBe('Reference MRI ready.');
    // The load's own crosshair moves are not the reader's.
    expect(onPoint).not.toHaveBeenCalled();
  });

  test('an atlas crosshair outside the scan is said and the MRI keeps its position', async () => {
    const { calls } = await opened({ getPoint: () => [1000, 0, 0] });
    expect(voxels()).toEqual([4, 4, 5]);
    expect(names(calls, 'setScannerPoint')).toEqual([['setScannerPoint', [[1000, 0, 0]]]]);
    expect(statusNode().textContent).toContain('outside this scan’s field of view');
    expect(statusNode().getBoundingClientRect().width).toBeGreaterThan(100);
  });
});

describe('lifetime', () => {
  test('closing frees the engine and the canvas; reopening resumes on a fresh one', async () => {
    const { calls, canvases, base } = await opened();
    canvas().focus();
    await userEvent.keyboard('{ArrowRight}');
    slider('Level').element().focus();
    await userEvent.keyboard('{ArrowRight}');

    await closing(() => userEvent.keyboard('{Escape}'));
    expect(base.tracts.navigators[0]!.disposed).toBe(true);
    expect(canvases[0]!.isConnected).toBe(false);
    await expect.element(opener()).toHaveFocus();

    const before = calls.length;
    await openFromKeyboard();
    await expect.element(planeSelect()).toBeEnabled();
    expect(base.tracts.navigators).toHaveLength(2);
    expect(canvases[1]).toBe(canvas());
    const again = calls.slice(before);
    expect(names(again, 'setWindow')).toEqual([['setWindow', [264, 525]]]);
    expect(names(again, 'setVoxel')).toEqual([['setVoxel', [[5, 4, 5]]]]);
    expect(voxels()).toEqual([5, 4, 5]);
  });

  test('an engine that arrives after the dialog closed is disposed, not used', async () => {
    const held = gate();
    const { calls, base } = await show({}, instrument({ gate: held.promise }));
    await openFromKeyboard();
    await closing(() => userEvent.keyboard('{Escape}'));
    held.release();
    await expect.poll(() => base.tracts.navigators[0]?.disposed).toBe(true);
    expect(names(calls, 'setWindow')).toEqual([]);
    expect(names(calls, 'syncTracts')).toEqual([]);
  });

  test('a reopening during a load starts its own engine and the late one is disposed', async () => {
    const held = gate();
    const fast = instrument({ gate: held.promise });
    const { base } = await show({}, fast);
    await openFromKeyboard();
    await closing(() => userEvent.keyboard('{Escape}'));
    await openFromKeyboard();
    held.release();
    await expect.element(planeSelect()).toBeEnabled();
    await expect
      .poll(() => base.tracts.navigators.map((navigator) => navigator.disposed))
      .toEqual([true, false]);
  });
});

describe('the canvas', () => {
  test('it is a focusable application with a name, a role description and the hint', async () => {
    await opened();
    const view = page.getByRole('application', { name: /^Linked MGH CDMD MRI slices and tracts/ });
    await expect.element(view).toHaveAttribute('aria-roledescription', 'MRI viewer');
    const hint = document.getElementById(canvas().getAttribute('aria-describedby')!)!;
    expect(hint.textContent).toContain('Click a slice to position the crosshair');
    expect(hint.textContent).toContain('Page Up and Page Down');
    expect(hint.textContent).toContain('M closes this view.');
  });

  test.each([
    ['ArrowRight', [5, 4, 5]],
    ['ArrowLeft', [3, 4, 5]],
    ['ArrowUp', [4, 5, 5]],
    ['ArrowDown', [4, 3, 5]],
    ['PageUp', [4, 4, 6]],
    ['PageDown', [4, 4, 4]],
  ])('%s moves one voxel along its axis', async (key, expected) => {
    const { calls } = await opened();
    canvas().focus();
    await userEvent.keyboard(`{${key}}`);
    expect(voxels()).toEqual(expected);
    expect(names(calls, 'moveVoxel')).toHaveLength(1);
  });

  test('a modified arrow is left to the browser (Alt+Left is Back); the plain key is taken', async () => {
    const { calls } = await opened();
    canvas().focus();
    const press = (init: KeyboardEventInit) =>
      canvas().dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      );
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
      // `dispatchEvent` is false when a handler cancelled the event.
      expect(press({ [modifier]: true }), modifier).toBe(true);
    }
    expect(names(calls, 'moveVoxel')).toEqual([]);
    expect(press({})).toBe(false);
    expect(names(calls, 'moveVoxel')).toHaveLength(1);
  });

  test('Tab leaves the canvas and walks the sliders; no stop is skipped or trapped', async () => {
    await opened();
    (page.getByRole('button', { name: 'Close' }).element() as HTMLElement).focus();
    const stops: string[] = [];
    for (let step = 0; step < 10; step++) {
      await userEvent.tab();
      const active = document.activeElement as HTMLInputElement;
      stops.push(`${active.tagName.toLowerCase()}${active.type ? `:${active.type}` : ''}`);
    }
    expect(stops).toEqual([
      'select:select-one',
      'input:number',
      'input:number',
      'input:number',
      'button:submit',
      'canvas',
      'input:range',
      'input:range',
      'input:range',
      // Past the last control the native dialog hands focus to the browser's own controls.
      'body',
    ]);
  });
});

describe('what the reader hears', () => {
  test('a key move says the readout once the moving stops; a pointer move says nothing', async () => {
    const { base } = await opened();
    canvas().focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect
      .poll(() => region.textContent)
      .toBe('RAS:\u00a0+10.0, +8.0, +10.0\u202fmm · T1:\u00a014 · FA:\u00a00.63');

    region.textContent = '';
    vi.useFakeTimers();
    // What NiiVue reports for a click or a drag: no key was pressed.
    base.tracts.navigators[0]!.setVoxel([1, 2, 3]);
    vi.advanceTimersByTime(2000);
    expect(region.textContent).toBe('');
    vi.useRealTimers();
  });

  test('the readout is plain text, not a live region', async () => {
    await opened();
    const readout = dialog().querySelector('.readout')!;
    expect(readout.textContent).toBe(
      'RAS:\u00a0+8.0, +8.0, +10.0\u202fmm · T1:\u00a013 · FA:\u00a00.50',
    );
    expect(readout.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  });

  test('the voxel form moves the crosshair and says where it went', async () => {
    const onPoint = vi.fn();
    const { calls } = await opened({ onPoint });
    await voxelInput('i').fill('1');
    await voxelInput('j').fill('2');
    await voxelInput('k').fill('3');
    await page.getByRole('button', { name: 'Go to voxel' }).click();
    expect(names(calls, 'setVoxel').at(-1)).toEqual(['setVoxel', [[1, 2, 3]]]);
    expect(region.textContent).toBe('Crosshair moved to voxel 1, 2, 3.');
    expect(onPoint).toHaveBeenLastCalledWith([2, 4, 6]);
  });

  test('a voxel outside the grid is stopped by the form and named by its range', async () => {
    const { calls } = await opened();
    const before = names(calls, 'setVoxel').length;
    await voxelInput('i').fill('99');
    await page.getByRole('button', { name: 'Go to voxel' }).click();
    expect((voxelInput('i').element() as HTMLInputElement).validity.rangeOverflow).toBe(true);
    expect(names(calls, 'setVoxel')).toHaveLength(before);
    expect(region.textContent).toBe('');
    await expect.element(voxelInput('i')).toHaveAccessibleDescription('0 to 7');
    await expect.element(voxelInput('k')).toHaveAccessibleDescription('0 to 9');
    await expect.element(page.getByRole('group', { name: 'Source voxel (0-based)' })).toBeVisible();
  });

  test('a language switch rewrites no live text: the status line is a new element', async () => {
    const { view } = await opened();
    const before = statusNode();
    await view.rerender({ lang: 'fr' });
    expect(before.isConnected).toBe(false);
    expect(statusNode().textContent).toBe('IRM de référence prête.');
  });
});

describe('contrast, window, level and FA', () => {
  test('dragging only previews the number; letting go applies it', async () => {
    const { calls } = await opened();
    const before = names(calls, 'setWindow').length;
    const level = slider('Level').element() as HTMLInputElement;
    level.value = '300';
    level.dispatchEvent(new Event('input', { bubbles: true }));
    expect(names(calls, 'setWindow')).toHaveLength(before);
    level.dispatchEvent(new Event('change', { bubbles: true }));
    expect(names(calls, 'setWindow').at(-1)).toEqual(['setWindow', [300, 525]]);
  });

  test('a key on the window slider applies at once; FA takes its own call', async () => {
    const { calls } = await opened();
    slider('Window').element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(names(calls, 'setWindow').at(-1)).toEqual(['setWindow', [263, 524]]);
    slider('FA opacity').element().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(names(calls, 'setFaOpacity').at(-1)).toEqual(['setFaOpacity', [0.05]]);
  });

  test('the plane select applies on change and survives a reopening', async () => {
    const { calls } = await opened();
    await planeSelect().selectOptions('CORONAL');
    expect(names(calls, 'setPlane').at(-1)).toEqual(['setPlane', ['CORONAL']]);
    await closing(() => userEvent.keyboard('{Escape}'));
    await openFromKeyboard();
    await expect.element(planeSelect()).toBeEnabled();
    expect(names(calls, 'setPlane').at(-1)).toEqual(['setPlane', ['CORONAL']]);
  });
});

describe('the crosshair reaches the atlas', () => {
  test('a key move and a click move the atlas crosshair; nothing does while it loads', async () => {
    const onPoint = vi.fn();
    const { base } = await opened({ onPoint });
    expect(onPoint).not.toHaveBeenCalled();
    canvas().focus();
    await userEvent.keyboard('{PageUp}');
    expect(onPoint).toHaveBeenLastCalledWith([8, 8, 12]);
    base.tracts.navigators[0]!.setVoxel([1, 1, 1]);
    expect(onPoint).toHaveBeenLastCalledWith([2, 2, 2]);
  });

  test('a location with the wrong number of values fails loudly instead of being dropped', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await show({}, instrument({ dropValue: true }));
    await openFromKeyboard();
    await expect.poll(alertText).toBe('The reference data could not be displayed.');
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ name: 'RangeError' }));
  });
});

describe('failure', () => {
  const download = () => Object.assign(new Error('offline'), { code: 'asset-fetch' });

  test('an alert says why; Retry keeps focus on the page, loads again and clears the alert', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await show({}, instrument({ failures: [download()] }));
    await openFromKeyboard();
    await expect
      .poll(alertText)
      .toBe('The reference data could not be downloaded. Check the connection, then try again.');
    expect((planeSelect().element() as HTMLSelectElement).disabled).toBe(true);
    const retry = page.getByRole('button', { name: 'Reload MRI' });
    (retry.element() as HTMLElement).focus();
    await retry.click();
    await expect.element(planeSelect()).toBeEnabled();
    expect(alertText()).toBe('');
    // Retry unmounted while it loaded: focus must not have fallen to the page.
    expect(document.activeElement).toBe(notes());
    expect(page.getByRole('button', { name: 'Reload MRI' }).elements()).toHaveLength(0);
  });

  test('a page that was updated offers Reload, not a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await show(
      {},
      instrument({ failures: [Object.assign(new Error('stale'), { code: 'asset-updated' })] }),
    );
    await openFromKeyboard();
    await expect.poll(alertText).toContain('Planum was updated');
    await expect.element(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
    expect(page.getByRole('button', { name: 'Reload MRI' }).elements()).toHaveLength(0);
  });

  /** The browser's own loss of the context: a real `webglcontextlost` event on the live canvas. */
  const loseContext = (target: HTMLCanvasElement) =>
    target.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();

  test('a lost WebGL context is shown, and Retry rebuilds the engine on a fresh canvas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { base, canvases } = await opened();
    loseContext(canvas());
    await expect.poll(alertText).toBe('The reference data could not be displayed.');
    expect((planeSelect().element() as HTMLSelectElement).disabled).toBe(true);
    await page.getByRole('button', { name: 'Reload MRI' }).click();
    await expect.element(planeSelect()).toBeEnabled();
    expect(base.tracts.navigators.map((navigator) => navigator.disposed)).toEqual([true, false]);
    expect(canvases[1]).not.toBe(canvases[0]);
    expect(alertText()).toBe('');
  });

  test('a context lost during the first load is shown when the load ends, with Retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const held = gate();
    await show({}, instrument({ gate: held.promise }));
    await openFromKeyboard();
    loseContext(canvas());
    await expect.poll(alertText).toBe('The reference data could not be displayed.');
    held.release();
    await expect.element(page.getByRole('button', { name: 'Reload MRI' })).toBeVisible();
    expect((planeSelect().element() as HTMLSelectElement).disabled).toBe(true);
    expect(alertText()).toBe('The reference data could not be displayed.');
    // The scan came up on a dead context: no "ready" is said.
    expect(statusNode().textContent).toBe('');
  });

  test('closing a dialog frees its context without that being reported as a failure', async () => {
    const { canvases } = await opened();
    const old = canvases[0]!;
    old.getContext('webgl2');
    await closing(() => userEvent.keyboard('{Escape}'));
    // Disposing an engine loses its context on the old canvas, a task later.
    const lost = new Promise((resolve) =>
      old.addEventListener('webglcontextlost', resolve, { once: true }),
    );
    loseContext(old);
    await lost;
    expect(alertText()).toBe('');
  });
});

describe('M', () => {
  test('closes the dialog from the canvas, at once, and returns focus to the opener', async () => {
    // Opened with the pointer, which animates: the key's close is what sets `data-instant`.
    await show();
    await opener().click();
    await expect.poll(() => dialog().open).toBe(true);
    await expect.element(planeSelect()).toBeEnabled();
    expect(dialog().hasAttribute('data-instant')).toBe(false);
    canvas().focus();
    await closing(() => userEvent.keyboard('m'));
    await expect.element(opener()).toHaveFocus();
    expect(dialog().hasAttribute('data-instant')).toBe(true);
  });

  test('does nothing when single-key shortcuts are off (WCAG 2.1.4)', async () => {
    await opened({ singleKeys: false });
    canvas().focus();
    await userEvent.keyboard('m');
    expect(dialog().open).toBe(true);
    // The hint does not offer a key that is off.
    expect(hintText()).not.toContain('M closes');
  });

  test('does nothing while typing in a field or with a modifier held', async () => {
    await opened();
    voxelInput('i').element().focus();
    await userEvent.keyboard('m');
    expect(dialog().open).toBe(true);
    canvas().focus();
    await userEvent.keyboard('{Control>}m{/Control}');
    expect(dialog().open).toBe(true);
  });

  test('Escape closes it too, with focus back on the opener', async () => {
    await opened();
    await closing(() => userEvent.keyboard('{Escape}'));
    await expect.element(opener()).toHaveFocus();
  });
});

describe('French', () => {
  test('every name and the canvas role are in French', async () => {
    await opened({ lang: 'fr' });
    await expect
      .element(page.getByRole('dialog', { name: 'IRM avec faisceaux · MGH CDMD sub_013' }))
      .toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Fermer' })).toBeVisible();
    await expect.element(planeSelect()).toBeVisible();
    await expect
      .element(page.getByRole('group', { name: 'Voxel source (indices à partir de 0)' }))
      .toBeVisible();
    await expect
      .element(page.getByRole('application', { name: /^Coupes IRM MGH CDMD liées/ }))
      .toHaveAttribute('aria-roledescription', 'Visionneuse IRM');
    await expect.element(voxelInput('i')).toHaveAccessibleDescription('de 0 à 7');
    await expect.element(slider('Fenêtre')).toBeVisible();
    await expect.element(slider('Opacité FA')).toBeVisible();
    expect(statusNode().textContent).toBe('IRM de référence prête.');
  });
});

describe('accessibility', () => {
  test('axe is clean in both themes, at desktop and phone width, in English and French', async () => {
    const { view } = await opened();
    await expectAxeClean();
    await view.rerender({ lang: 'fr' });
    await expectAxeClean();
  });

  test('targets are 24 px, and 44 px for a finger', async () => {
    await opened();
    const controls = () =>
      [
        page.getByRole('button', { name: 'Close' }),
        planeSelect(),
        voxelInput('i'),
        voxelInput('j'),
        voxelInput('k'),
        page.getByRole('button', { name: 'Go to voxel' }),
        slider('Window'),
        slider('Level'),
        slider('FA opacity'),
      ].map((locator) => (locator.element() as HTMLElement).getBoundingClientRect());
    // A range's own box is 20 px: its thumb is U4's target and is measured on a touch screen below.
    for (const box of controls().slice(0, 6)) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const box of controls()) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await expect.poll(hintText).toContain('Tap a slice');
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('200 % text with the WCAG 1.4.12 spacing reflows at 320 px without a sideways scroll', async () => {
    const { view } = await opened();
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      for (const lang of ['en', 'fr'] as const) {
        await view.rerender({ lang });
        await page.viewport(320, 640);
        expect(dialog().scrollWidth, lang).toBeLessThanOrEqual(dialog().clientWidth);
        for (const node of dialog().querySelectorAll<HTMLElement>('.hint, .footnotes p, .notes')) {
          expect(node.scrollWidth, `${lang} ${node.className}`).toBeLessThanOrEqual(
            node.clientWidth + 1,
          );
        }
      }
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test.each([
    [320, 256, '100%'],
    [320, 640, '200%'],
    [390, 844, '200%'],
  ])(
    'a focused control is never left under the sticky header at %ix%i, text %s',
    async (width, height, size) => {
      await page.viewport(width, height);
      document.documentElement.style.fontSize = size;
      try {
        await opened();
        const headerBox = () => dialog().querySelector('.dialog-header')!.getBoundingClientRect();
        // The margin follows the header as it wraps its title.
        await expect
          .poll(() =>
            (dialog().querySelector('.navigator') as HTMLElement).style.getPropertyValue(
              '--header-clearance',
            ),
          )
          .toBe(`${headerBox().height}px`);
        // Scrolled until the select is half out of view above the dialog's edge: the browser then
        // scrolls it back just enough to reveal it, and that stop must clear the sticky header.
        const select = planeSelect().element() as HTMLElement;
        dialog().scrollTop +=
          select.getBoundingClientRect().top - dialog().getBoundingClientRect().top + 10;
        select.focus();
        expect(select.getBoundingClientRect().top).toBeGreaterThanOrEqual(headerBox().bottom);
      } finally {
        document.documentElement.style.fontSize = '';
      }
    },
  );

  test('the focused canvas draws its ring inside the clipping box', async () => {
    await opened();
    canvas().focus({ focusVisible: true });
    expect(canvas().matches(':focus-visible')).toBe(true);
    const ring = getComputedStyle(canvas());
    expect(ring.outlineStyle).toBe('solid');
    // The box clips what is outside it: the ring must lie wholly within the canvas.
    expect(parseFloat(ring.outlineOffset)).toBeLessThanOrEqual(-parseFloat(ring.outlineWidth));
  });

  test('the failure region is in the page before any failure', async () => {
    await opened();
    const alert = notes().querySelector('[role="alert"]')!;
    expect(alert.textContent!.trim()).toBe('');
    expect(getComputedStyle(alert).display).not.toBe('none');
  });

  /** What a property resolves to for a system colour or a token, measured on a probe in the dialog. */
  const resolved = (property: 'color' | 'backgroundColor', value: string) => {
    const probe = dialog().querySelector('.navigator')!.appendChild(document.createElement('i'));
    probe.style.setProperty(property === 'color' ? 'color' : 'background-color', value);
    const out = getComputedStyle(probe)[property];
    probe.remove();
    return out;
  };

  test('forced colours keep system colours and a ring inside the canvas box', async () => {
    await opened();
    const go = () => getComputedStyle(page.getByRole('button', { name: 'Go to voxel' }).element());
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(matchMedia('(forced-colors: active)').matches).toBe(true);
      // The browser forces these; the test holds the component to leaving them alone.
      expect(go().borderTopColor).toBe(resolved('color', 'CanvasText'));
      // Text and fill too: `forced-color-adjust: none` on the buttons would keep the theme's own.
      expect(go().color).toBe(resolved('color', 'ButtonText'));
      expect(go().backgroundColor).toBe(resolved('backgroundColor', 'ButtonFace'));
      canvas().focus({ focusVisible: true });
      const ring = getComputedStyle(canvas());
      expect(ring.outlineColor).toBe(resolved('color', 'Highlight'));
      expect(parseFloat(ring.outlineOffset)).toBeLessThanOrEqual(-parseFloat(ring.outlineWidth));
    });
    expect(matchMedia('(forced-colors: active)').matches).toBe(false);
  });

  test('more contrast outlines the buttons in the control border colour', async () => {
    await opened();
    const go = () => getComputedStyle(page.getByRole('button', { name: 'Go to voxel' }).element());
    expect(go().borderTopColor).toBe('rgba(0, 0, 0, 0)');
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      expect(go().borderTopColor).toBe(resolved('color', 'var(--border-control)'));
    });
  });
});

function hintText() {
  return dialog().querySelector('.hint')!.textContent!;
}
