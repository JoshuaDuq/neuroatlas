// The stage region as the app mounts it, over the fake engine: what it holds, the ports it hands the
// controllers and the keymap, the two MRI dialogs, and the stage layout following the panel and window.
import '../../styles/index.css';
import '../layout.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import axe from 'axe-core';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { createApp, APP } from '../application.svelte.ts';
import type { App } from '../application.svelte.ts';
import { composeWorld } from '../world.ts';
import StageRegion from './StageRegion.svelte';
import StageRegionFixture from './stage-region-test-support.svelte';

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
  flushSync();
}

const dialogs = () => [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const dialogNamed = (name: string) =>
  dialogs().find((dialog) => dialog.querySelector('h2')?.textContent === name)!;
const press = (key: string) =>
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

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
    expect(dialogs().map((dialog) => dialog.querySelector('h2')?.textContent).sort()).toEqual([
      'MRI with tracts · MGH CDMD sub_013',
      'Linked MRI sections',
    ].sort());
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
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      // The scale bar is G1's: axe reads its text stroke, not its ink, as the text colour.
      const results = await axe.run(
        { include: [[document.body as unknown as string]], exclude: [['#scale-bar']] },
        {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
          rules: { region: { enabled: false } },
        },
      );
      expect(results.violations.map((violation) => violation.id), theme).toEqual([]);
    }
    delete document.documentElement.dataset.theme;
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
    app.ports.openDiffusionMri();
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
    app.ports.openDiffusionMri();
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
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe(`planum-${app.world!.view.current.atlas}.png`);
      });
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    expect(click).toHaveBeenCalledOnce();
    expect(announcer.textContent).toBe(
      `Image saved as planum-${app.world!.view.current.atlas}.png.`,
    );
  });
});
