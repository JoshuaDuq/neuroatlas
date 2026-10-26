// The panel region as the app mounts it, over the fake engine: the ports it hands the controllers and
// the keymap, the workspace in the sheet, and the wiring between the explorers and the controllers.
import '../../styles/index.css'; // The page's styles: a hidden panel takes no focus, as in the app.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { createApp } from '../application.svelte.ts';
import type { App } from '../application.svelte.ts';
import AppShell from '../App.svelte';
import { shellOptions, startApp } from '../boot.ts';

// The index of published brains is a file of the site, which the test page does not serve.
vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);
const REGION = 'destrieux:left:30';

let engine: FakeEngine;
let app: App;
let shell: Record<string, unknown> | null;
let target: HTMLElement;
let announcer: HTMLElement;
let detach: () => void;

/** Mounts the shell and starts the app on a link, as main.ts does. */
async function boot(hash = '') {
  history.replaceState(null, '', `${location.pathname}${hash}`);
  app = createApp();
  shell = mount(AppShell, { target, ...shellOptions(app) });
  await startApp(app, async () => engine);
  flushSync();
  return app.world!;
}

const press = (key: string, at: Element = document.body) =>
  at.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const list = () => document.getElementById('navigator')!;
const detail = () => document.getElementById('inspector')!;
const sheet = () => document.getElementById('sheet')!;
const detailOrList = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const cameraCalls = (method: string) =>
  engine.calls.filter((call) => call.domain === 'camera' && call.method === method);
const nameOf = (id: string) => app.world!.catalog.label(id).name;

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
  if (shell) unmount(shell);
  shell = null;
  detach();
  announcer.remove();
  target.remove();
  history.replaceState(null, '', location.pathname);
  vi.restoreAllMocks();
});

describe('before the engine', () => {
  test('the landmark holds only the list’s skeleton, hidden from assistive technology', async () => {
    app = createApp();
    shell = mount(AppShell, { target, ...shellOptions(app) });
    flushSync();
    const aside = target.querySelector('aside')!;
    expect(aside.getAttribute('aria-label')).toBe(t('en', 'workspace').panelAria);
    expect(aside.children).toHaveLength(1);
    expect(aside.querySelector('#tree')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('selection', () => {
  test('a region picked on the model opens its detail, named in the strip of another mode', async () => {
    await boot();
    engine.emit('pick', { id: REGION });
    flushSync();
    expect(list().hidden).toBe(true);
    await expect
      .element(page.getByRole('heading', { level: 2, name: nameOf(REGION) }))
      .toBeVisible();

    await userEvent.click(page.getByRole('tab', { name: 'Functions' }));
    await expect
      .element(page.getByRole('button', { name: `Inspect ${nameOf(REGION)}, left` }))
      .toBeVisible();
  });

  test('the inspector’s Hide hands focus to the dissection’s Undo in the list', async () => {
    await boot();
    engine.emit('pick', { id: REGION });
    flushSync();
    await userEvent.click(page.getByRole('button', { name: 'Hide', exact: true }));
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(page.getByRole('button', { name: 'Undo' }).element()),
    );
    expect(list().hidden).toBe(false);
    expect(engine.model.state.hiddenRegions.has(REGION)).toBe(true);
  });

  test('an eye in the tree says the part it hid with the count it changed', async () => {
    const world = await boot();
    engine.emit('pick', { id: REGION });
    flushSync();
    app.ports.back();
    flushSync();
    // A neighbour in the selected region's open group: hiding the selection would also clear it.
    const rows = world.catalog.groups.find((group) =>
      group.rows.some((row) => row.region.id === REGION),
    )!.rows;
    const other = rows.find((row) => row.region.id !== REGION && row.region.hemisphere === 'left')!;
    const name = nameOf(other.region.id);
    await userEvent.click(page.getByRole('button', { name: `Hide ${name}, left`, exact: true }));
    await vi.waitFor(() =>
      expect(announcer.textContent).toBe(`Hidden: ${name}, left. 1 part hidden`),
    );
    expect(engine.model.state.hiddenRegions.has(other.region.id)).toBe(true);
  });
});

describe('accessibility', () => {
  test('the composed panel passes axe on a region’s detail and on the list', async () => {
    await boot();
    engine.emit('pick', { id: REGION });
    flushSync();
    await expectAxeClean();
    app.ports.back();
    flushSync();
    await expectAxeClean();
  });
});

describe('the keymap’s ports', () => {
  test('/ from the detail shows the list and focuses the search in front', async () => {
    await boot();
    engine.emit('pick', { id: REGION });
    flushSync();
    expect(detail().hidden).toBe(false);
    press('/');
    expect(document.activeElement).toBe(
      page.getByRole('combobox', { name: 'Search regions' }).element(),
    );
  });

  test('Escape inside the detail is Back to the list', async () => {
    await boot();
    engine.emit('pick', { id: REGION });
    flushSync();
    const focus = page.getByRole('button', { name: 'Focus', exact: true }).element() as HTMLElement;
    focus.focus();
    press('Escape', focus);
    flushSync();
    expect(detail().hidden).toBe(true);
    expect(engine.model.state.selectedRegion?.id).toBe(REGION);
  });
});

describe('the anatomy search', () => {
  test('a cut-label switch that fails is said in the notice, not swallowed', async () => {
    // No cut has chosen its labels yet, so a NextBrain region is found under another cut atlas.
    const cutOnly = 'nextbrain:left:7';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const setCutAtlas = vi
      .spyOn(engine.sections, 'setCutAtlas')
      .mockRejectedValue(new Error('offline'));
    await boot();
    await userEvent.fill(page.getByRole('combobox', { name: 'Search regions' }), nameOf(cutOnly));
    await userEvent.click(page.getByRole('button', { name: 'Switch cut labels' }));
    expect(setCutAtlas).toHaveBeenCalledWith('nextbrain');
    await vi.waitFor(() =>
      expect(app.session.state.notice?.text).toBe(t('en', 'errors').operations.layer('NextBrain')),
    );
  });
});

describe('the explorers’ entry points', () => {
  test('a link to a function opens its profile through the Functions panel, which focuses its name', async () => {
    const id = domains.domains[0]!.id;
    await boot(`#tab=functions&function=${id}`);
    const title = detail().querySelector<HTMLElement>('[data-function-title]')!;
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
    expect(detail().hidden).toBe(false);
  });

  test('a lesson opened from the Circuits list puts its stepper and its circuit in the location bar', async () => {
    const world = await boot();
    const circuit = world.circuits.all[0]!;
    await userEvent.click(page.getByRole('tab', { name: 'Circuits' }));
    await userEvent.click(detailOrList('[data-circuit]'));
    await expect.element(page.getByRole('group', { name: 'Landmarks' })).toBeVisible();
    await expect
      .element(page.getByRole('navigation', { name: 'Breadcrumb' }))
      .toHaveTextContent(`Circuits ${circuit.name.en}`);
    expect(detail().querySelector('.region-detail')!.getAttribute('data-landmark-selected')).toBe(
      'true',
    );
  });

  test('a deficit’s profile sits above the selected region, which reads as a second subject', async () => {
    const world = await boot();
    const deficit = world.clinical.grouped('', 'en')[0]!.deficits[0]!;
    await app.ports.openDeficit(deficit.id);
    engine.emit('pick', { id: REGION });
    flushSync();
    const profile = detail().querySelector('.clinical-profile')!;
    const region = detail().querySelector('.region-detail')!;
    expect(profile.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region.hasAttribute('data-under-profile')).toBe(true);
  });
});

describe('the phone sheet', () => {
  beforeEach(() => page.viewport(390, 844));

  test('showing the list or the detail raises the sheet from peek, and the stage is told the room it has', async () => {
    const world = await boot();
    expect(sheet().dataset.detent).toBe('peek');
    app.ports.showList();
    expect(sheet().dataset.detent).toBe('half');
    const { visibleRect, hostSize } = app.stage;
    expect(visibleRect!.height).toBeLessThan(hostSize!.height);
    expect(visibleRect).toEqual(world.engine.camera.visibleRect);
  });

  test('a held view is reframed where the sheet comes to rest', async () => {
    await boot();
    expect(app.world!.engine.camera.viewHeld).toBe(true);
    const before = cameraCalls('frameCurrent').length;
    await userEvent.click(page.getByRole('button', { name: t('en', 'sheet').expand }));
    expect(cameraCalls('frameCurrent')).toHaveLength(before + 1);
  });

  test('the sheet’s first report, before the start has framed the camera, keeps no framing', async () => {
    // The real camera starts released, which the fake's held opening view stands in for here.
    engine.camera.orbitBy({ azimuth: 0.1 });
    await boot();
    expect(cameraCalls('setChromeInsets').length).toBeGreaterThan(0);
    expect(cameraCalls('keepFraming')).toEqual([]);
  });

  test('a framing of the reader’s own keeps its size in the room the sheet leaves', async () => {
    const world = await boot();
    world.engine.camera.orbitBy({ azimuth: 0.1 });
    app.ports.showDetail();
    expect(cameraCalls('keepFraming').map(({ args }) => args[0])).toEqual([
      world.engine.camera.fittedDistance(),
    ]);
  });
});
