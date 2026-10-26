// The stage region as the app mounts it, over the fake engine: what it holds, the ports it hands the
// controllers and the keymap, the two MRI dialogs, and the stage layout following the panel and window.
import '../../styles/index.css';
import '../layout.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import functionalFile from '../../../../public/models/cdmd/functional-regions.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { ALL_DOMAINS } from '../../lib/core/catalog/neuropsych-domains.ts';
import { createApp, APP } from '../application.svelte.ts';
import type { App } from '../application.svelte.ts';
import { composeWorld } from '../world.ts';
import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
import * as snapshot from '../../features/snapshot/snapshot.ts';
import StageRegion from './StageRegion.svelte';
import StageRegionFixture from './stage-region-test-support.svelte';

// The real saver, watched: what the region hands it is the rule under test.
vi.mock('../../features/snapshot/snapshot.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/snapshot/snapshot.ts')>();
  return { ...actual, saveSnapshot: vi.fn(actual.saveSnapshot) };
});

const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);

let engine: FakeEngine;
let app: App;
let target: HTMLElement;
let region: Record<string, () => unknown> | null;
let announcer: HTMLElement;
let detach: () => void;

/** Composes the world over the fake engine and mounts only the stage region, as the shell does. */
function boot(status: 'ready' | 'loading' = 'ready') {
  app = createApp();
  app.attach(composeWorld(app, engine, 'cdmd'));
  if (status === 'ready') app.session.setStatus('ready');
  region = mount(StageRegion, { target, context: new Map([[APP, app]]) }) as never;
  // In the page the grid sizes the stage.
  document.getElementById('viewport')!.style.cssText = 'width: 900px; height: 600px';
  // As the real engine does: its canvas is the stage's first child, which axe reads as an image.
  document.getElementById('viewport')!.prepend(engine.canvas);
  flushSync();
}

const dialogs = () => [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const dialogNamed = (name: string) =>
  dialogs().find((dialog) => dialog.querySelector('h2')?.textContent === name)!;
const press = (key: string) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );

beforeEach(async () => {
  await page.viewport(1280, 800);
  engine = createFakeEngine({ manifest, domains: domains as never });
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  announcer = document.body.appendChild(document.createElement('p'));
  detach = attachAnnouncer(announcer);
  localStorage.clear();
});
afterEach(() => {
  app.dispose();
  if (region) unmount(region as never);
  region = null;
  detach();
  announcer.remove();
  target.remove();
  vi.restoreAllMocks();
});

describe('what the stage region holds', () => {
  test('one main landmark holds the overlay, the dock, the keys and the snippet it is given; no stage control is outside it', async () => {
    app = createApp();
    app.attach(composeWorld(app, engine, 'cdmd'));
    app.session.setStatus('ready');
    region = mount(StageRegionFixture, { target, context: new Map([[APP, app]]) }) as never;
    flushSync();
    const mains = document.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    const main = mains[0]!;
    expect(main.id).toBe('viewport');
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(main.querySelector('.stage-overlay')).not.toBeNull();
    expect(main.querySelector('.stage-dock')).not.toBeNull();
    expect(main.querySelector('.stage-keys')).not.toBeNull();
    expect(main.querySelector('#stage-status-slot')).not.toBeNull();
    for (const control of document.querySelectorAll('.stage-tool, .stage-keys')) {
      expect(main.contains(control)).toBe(true);
    }
  });

  test('before the engine the main still holds the snippet', async () => {
    app = createApp();
    region = mount(StageRegionFixture, { target, context: new Map([[APP, app]]) }) as never;
    flushSync();
    const main = document.querySelector('main#viewport')!;
    expect(main.querySelector('#stage-status-slot')).not.toBeNull();
    expect(main.querySelector('.stage-dock')).toBeNull();
    expect(dialogs()).toHaveLength(0);
  });

  test('the two MRI dialogs are children of the app root, outside the landmark, and the Tracts MRI draws no canvas while closed', async () => {
    boot();
    expect(dialogs()).toHaveLength(2);
    for (const dialog of dialogs()) {
      expect(dialog.parentElement).toBe(target);
      expect(dialog.open).toBe(false);
    }
    // No navigator, so no GPU context or volume, exists while the dialog is closed.
    expect(engine.tracts.navigators).toHaveLength(0);
    expect(
      dialogs()
        .map((dialog) => dialog.querySelector('h2')?.textContent)
        .sort(),
    ).toEqual(['MRI with tracts · MGH CDMD sub_013', 'Linked MRI sections'].sort());
  });

  test('the exit control is kept mounted and hidden outside full screen, named by its visible text', async () => {
    boot();
    const exit = document.querySelector<HTMLButtonElement>('.exit-fullscreen')!;
    expect(exit.hidden).toBe(true);
    expect(exit.textContent!.trim()).toBe('Exit full screen');
    expect((region as never as { isFullscreen(): boolean }).isFullscreen()).toBe(false);
  });

  test('the stage passes axe with the dock and the keys', async () => {
    boot();
    await expectAxeClean();
  });
});

describe('the MRI dialogs', () => {
  test('openMpr opens the Linked MRI dialog, mprOpen answers, closeMpr closes it', async () => {
    boot();
    expect(app.ports.mprOpen()).toBe(false);
    app.ports.openMpr({ instant: true });
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
    const dialog = dialogNamed('Linked MRI sections');
    expect(dialog.matches(':modal')).toBe(true);
    app.ports.closeMpr();
    flushSync();
    expect(app.ports.mprOpen()).toBe(false);
    expect(dialog.open).toBe(false);
  });

  test('showMri opens it from the controllers, and the M key toggles it', async () => {
    boot();
    // The controllers show the dialog once the scan has loaded.
    await engine.sections.load();
    app.ports.showMri({ instant: true });
    flushSync();
    expect(app.ports.mprOpen()).toBe(true);
    press('m');
    flushSync();
    expect(app.ports.mprOpen()).toBe(false);
    press('m');
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
  });

  test('the section row’s opener opens the same dialog', async () => {
    boot();
    await userEvent.click(page.getByRole('button', { name: 'Section', exact: true }));
    // A cut is needed before the section row offers the opener.
    await userEvent.click(page.getByRole('button', { name: 'Sagittal', exact: true }));
    await userEvent.click(page.getByRole('button', { name: /Linked MRI/ }));
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
  });

  test('openDiffusionMri opens the Tracts MRI, diffusionMriOpen answers, and Escape closes it', async () => {
    boot();
    expect(app.ports.diffusionMriOpen()).toBe(false);
    app.ports.openDiffusionMri({ instant: true });
    flushSync();
    expect(app.ports.diffusionMriOpen()).toBe(true);
    const dialog = dialogNamed('MRI with tracts · MGH CDMD sub_013');
    expect(dialog.matches(':modal')).toBe(true);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(app.ports.diffusionMriOpen()).toBe(false));
  });

  test('the Tracts MRI holds a navigator only while open', async () => {
    boot();
    expect(engine.tracts.navigators).toHaveLength(0);
    app.ports.openDiffusionMri({ instant: true });
    flushSync();
    await vi.waitFor(() => expect(engine.tracts.navigators).toHaveLength(1));
    expect(engine.tracts.navigators[0]!.disposed).toBe(false);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(engine.tracts.navigators[0]!.disposed).toBe(true));
  });
});

describe('the stage layout', () => {
  test('a desktop resize reaches the stage store through the engine’s viewport event', async () => {
    boot();
    engine.emit('viewport', {
      visibleRect: { x: 0, y: 0, width: 1000, height: 700 },
      hostSize: { width: 1000, height: 700 },
    });
    flushSync();
    expect(app.stage.visibleRect?.width).toBe(1000);
    engine.emit('viewport', {
      visibleRect: { x: 0, y: 0, width: 800, height: 700 },
      hostSize: { width: 800, height: 700 },
    });
    flushSync();
    expect(app.stage.visibleRect?.width).toBe(800);
    expect(document.getElementById('viewport')!.style.getPropertyValue('--vis-right')).toBe('0px');
  });

  test('a full phone sheet hides the dock, the scale bar and the letters', async () => {
    boot();
    const dock = document.querySelector<HTMLElement>('.stage-dock')!;
    expect(getComputedStyle(dock).visibility).toBe('visible');
    app.stage.sheetFull = true;
    flushSync();
    expect(document.getElementById('viewport')!.dataset.sheetFull).toBe('true');
    expect(getComputedStyle(dock).visibility).toBe('hidden');
    expect(getComputedStyle(document.getElementById('orientation')!).visibility).toBe('hidden');
    app.stage.sheetFull = false;
    flushSync();
    expect(getComputedStyle(dock).visibility).toBe('visible');
  });
});

describe('save image', () => {
  test('saves the visible stage as planum-<atlas>.png and says so', async () => {
    boot();
    engine.emit('viewport', {
      visibleRect: { x: 0, y: 0, width: 1000, height: 700 },
      hostSize: { width: 1000, height: 700 },
    });
    flushSync();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe(`planum-${app.world!.view.current.atlas}.png`);
    });
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    expect(click).toHaveBeenCalledOnce();
    expect(announcer.textContent).toBe(
      `Image saved as planum-${app.world!.view.current.atlas}.png.`,
    );
  });
});

const call = (domain: string, method: string) =>
  engine.calls.filter((entry) => entry.domain === domain && entry.method === method);

describe('the controllers’ entry points', () => {
  test('openPreparedPlane opens the dialog only while the step still wants it', async () => {
    boot();
    await app.ports.openPreparedPlane('coronal', () => false);
    flushSync();
    expect(app.ports.mprOpen()).toBe(false);
    await app.ports.openPreparedPlane('coronal', () => true);
    flushSync();
    expect(app.ports.mprOpen()).toBe(true);
  });

  test('M twice while the scan loads runs one load, and the opener says it is busy', async () => {
    boot();
    await userEvent.click(page.getByRole('button', { name: 'Section', exact: true }));
    await userEvent.click(page.getByRole('button', { name: 'Sagittal', exact: true }));
    await userEvent.keyboard('{Escape}');
    let finish!: () => void;
    const real = engine.sections.load.bind(engine.sections);
    const load = vi
      .spyOn(engine.sections, 'load')
      .mockImplementation(
        () => new Promise<void>((resolve) => (finish = () => void real().then(resolve))),
      );
    press('m');
    press('m');
    flushSync();
    expect(load).toHaveBeenCalledOnce();
    expect(
      page
        .getByRole('button', { name: /Linked MRI/ })
        .element()
        .getAttribute('aria-disabled'),
    ).toBe('true');
    finish();
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
  });

  test('the Linked MRI animates a pointer opening and closes at once from the M key', async () => {
    boot();
    await engine.sections.load();
    const dialog = dialogNamed('Linked MRI sections');
    app.ports.showMri({ instant: false });
    flushSync();
    expect(dialog.open).toBe(true);
    expect(dialog.hasAttribute('data-instant')).toBe(false);
    app.ports.closeMpr();
    flushSync();
    expect(dialog.hasAttribute('data-instant')).toBe(true);
    app.ports.showMri({ instant: true });
    flushSync();
    expect(dialog.hasAttribute('data-instant')).toBe(true);
  });

  test('the Tracts MRI opens with its entry animation unless the opening was a key', async () => {
    boot();
    const dialog = dialogNamed('MRI with tracts · MGH CDMD sub_013');
    app.ports.openDiffusionMri({ instant: false });
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(false);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog.open).toBe(false));
    app.ports.openDiffusionMri({ instant: true });
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(true);
  });

  test('the Tracts MRI draws with the length the panel set', async () => {
    boot();
    const syncs: ReturnType<typeof vi.fn>[] = [];
    const create = engine.tracts.createMriNavigator.bind(engine.tracts);
    vi.spyOn(engine.tracts, 'createMriNavigator').mockImplementation(async (...args) => {
      const navigator = await create(...args);
      syncs.push(vi.spyOn(navigator, 'syncTracts') as never);
      return navigator;
    });
    app.tractsMinimum = 40;
    app.ports.openDiffusionMri({ instant: true });
    await vi.waitFor(() => expect(syncs[0]).toHaveBeenCalledWith(expect.any(Array), 40));
  });

  test('a slider frame queued when the region goes is not run afterwards', async () => {
    boot();
    await engine.sections.load();
    app.ports.showMri({ instant: true });
    flushSync();
    const slider =
      dialogNamed('Linked MRI sections').querySelector<HTMLInputElement>('input[type="range"]')!;
    const before = call('sections', 'setCrosshair').length;
    slider.value = String(Number(slider.value) + 5);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    app.dispose();
    unmount(region as never);
    region = null;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(call('sections', 'setCrosshair')).toHaveLength(before);
  });
});

describe('focus and the crosshair', () => {
  test('a Linked MRI opened from a port returns focus to the Section tool, else to the model', async () => {
    boot();
    await engine.sections.load();
    (document.activeElement as HTMLElement | null)?.blur();
    app.ports.showMri({ instant: true });
    flushSync();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        page.getByRole('button', { name: 'Section', exact: true }).element(),
      ),
    );
  });

  test('over the tract reference, where no Section tool is drawn, focus returns to the model', async () => {
    engine = createFakeEngine({ manifest, domains: domains as never, tractAnatomy: 'another' });
    boot();
    await engine.sections.load();
    engine.canvas.tabIndex = 0;
    app.session.setExplorer('diffusion');
    flushSync();
    (document.activeElement as HTMLElement | null)?.blur();
    app.ports.showMri({ instant: true });
    flushSync();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(document.activeElement).toBe(engine.canvas));
  });

  test('the Tracts MRI starts at the atlas crosshair and moves it back', async () => {
    boot();
    engine.sections.setCrosshair([10, 20, 30]);
    await engine.tracts.setActive(true);
    const create = engine.tracts.createMriNavigator.bind(engine.tracts);
    const points: ReturnType<typeof vi.fn>[] = [];
    vi.spyOn(engine.tracts, 'createMriNavigator').mockImplementation(async (...args) => {
      const navigator = await create(...args);
      points.push(vi.spyOn(navigator, 'setScannerPoint') as never);
      return navigator;
    });
    app.ports.openDiffusionMri({ instant: true });
    // The fake's surface sits one, two and three millimetres off the scanner.
    await vi.waitFor(() => expect(points[0]).toHaveBeenCalledWith([9, 22, 27]));
    engine.tracts.navigators[0]!.setVoxel([1, 2, 3]);
    expect(engine.sections.state.crosshair).toEqual([3, 2, 9]);
  });
});

describe('the dock and the keys', () => {
  test('a view preset sets the session’s view and frames it; Reset view resets the model', async () => {
    boot();
    await userEvent.click(page.getByRole('button', { name: /^Anatomical view/ }));
    await userEvent.click(page.getByRole('button', { name: 'Left', exact: true }));
    expect(app.world!.view.current.view).toBe('left');
    expect(call('camera', 'applyView').at(-1)?.args[0]).toBe('left');
    await userEvent.click(page.getByRole('button', { name: /^Anatomical view/ }));
    await userEvent.click(page.getByRole('button', { name: 'Reset view' }));
    expect(call('model', 'reset')).toHaveLength(1);
  });

  async function functionsPainted() {
    await engine.model.setAtlas(app.world!.engine.model.domains!.atlas);
    app.session.setExplorer('functions');
    app.session.setFunction(ALL_DOMAINS);
    flushSync();
  }

  test('a functions paint draws its key, and a row press opens that function', async () => {
    boot();
    const openFunction = vi.fn();
    app.registerPorts({ openFunction });
    await functionsPainted();
    const key = document.getElementById('paint-key')!;
    expect(key.hidden).toBe(false);
    const row = key.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    row.click();
    expect(openFunction).toHaveBeenCalledOnce();
    expect(typeof openFunction.mock.calls[0]![0]).toBe('string');
  });

  test('the functional key’s level is set on the model', async () => {
    engine = createFakeEngine({
      manifest,
      domains: domains as never,
      functionalRegions: functionalFile as never,
    });
    boot();
    await engine.model.setAtlas('hcp-mmp');
    (engine.model as unknown as { loadGlassSolids(): void }).loadGlassSolids();
    engine.model.setSurfaceColor('functional');
    flushSync();
    await userEvent.click(page.getByRole('radio', { name: 'Sections' }));
    expect(call('model', 'setFunctionalLevel').at(-1)?.args).toEqual(['sections']);
  });

  test('streamlines drawn show the direction key', async () => {
    boot();
    expect(document.getElementById('direction-key')).toBeNull();
    await engine.tracts.setActive(true);
    engine.tracts.setOverlay(true);
    engine.emit('tractsVisibility', undefined);
    flushSync();
    expect(engine.tracts.streamlinesVisible).toBe(true);
    await vi.waitFor(() => expect(document.getElementById('direction-key')).not.toBeNull());
  });
});

describe('the tract reference', () => {
  test('the keys read in tissue colour and the snapshot is captioned with the reference', async () => {
    engine = createFakeEngine({
      manifest,
      domains: domains as never,
      tractAnatomy: 'reference-brain',
    });
    boot();
    engine.model.setSurfaceColor('network');
    flushSync();
    expect(document.getElementById('network-key')).not.toBeNull();
    app.session.setExplorer('diffusion');
    flushSync();
    expect(isIndependentTractReference(app.world!.view.current)).toBe(true);
    expect(document.getElementById('network-key')).toBeNull();
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    const subject = vi.mocked(snapshot.saveSnapshot).mock.calls.at(-1)![1];
    expect(subject.reference).toBe('MGH CDMD · sub_013');
    expect(subject.surfaceColor).toBe('tissue');
  });

  test('an open cut reaches the snapshot subject', async () => {
    boot();
    await userEvent.click(page.getByRole('button', { name: 'Section', exact: true }));
    await userEvent.click(page.getByRole('button', { name: 'Sagittal', exact: true }));
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    const subject = vi.mocked(snapshot.saveSnapshot).mock.calls.at(-1)![1];
    expect(subject.section).toEqual({ plane: 'sagittal', offset: 0, tilt: 30, azimuth: 30 });
    expect(subject.reference).toBeNull();
  });
});

describe('the phone', () => {
  test('under a full sheet the scale bar is hidden as well', async () => {
    boot();
    app.stage.sheetFull = true;
    flushSync();
    expect(getComputedStyle(document.getElementById('scale-bar')!).visibility).toBe('hidden');
  });

  test('an open popover hides the scale bar and the letters, and closing shows them', async () => {
    await page.viewport(390, 844);
    boot();
    const bar = document.getElementById('scale-bar')!;
    const letters = document.getElementById('orientation')!;
    expect(getComputedStyle(bar).visibility).toBe('visible');
    await userEvent.click(page.getByRole('button', { name: 'Display', exact: true }));
    await vi.waitFor(() => expect(getComputedStyle(bar).visibility).toBe('hidden'));
    expect(getComputedStyle(letters).visibility).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(getComputedStyle(bar).visibility).toBe('visible'));
  });

  test('in French at 390 px the exit control starts below the top letter', async () => {
    await page.viewport(390, 844);
    boot();
    app.chooseLanguage('fr');
    flushSync();
    const exit = document.querySelector<HTMLElement>('.exit-fullscreen')!;
    exit.hidden = false;
    const control = exit.getBoundingClientRect();
    const letter = document
      .querySelector('#orientation [data-edge="top"]')!
      .getBoundingClientRect();
    expect(exit.textContent!.trim()).toBe('Quitter le plein écran');
    expect(control.top).toBeGreaterThanOrEqual(letter.bottom);
  });
});
