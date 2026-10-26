// The start, over the fake engine: boot order, the link, the keymap and the engine's events as the
// composition root wires them, and the failures it shows. The engine itself is E7's.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import manifestFile from '../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../lib/core/catalog/neuropsych-domains.ts';
import { loadClinicalCatalog } from '../lib/core/clinical/load.ts';
import { t } from '../lib/core/i18n/index.ts';
import { loadCircuitCatalog } from '../lib/core/learning/load.ts';
import { decodeState } from '../lib/core/state/url-state.ts';
import { ASSET_BASE } from '../../build/site.ts';
import type { CreateEngine, EngineOptions } from '../lib/engine/api.ts';
import { createFakeEngine } from '../lib/engine/fake.ts';
import type { FakeEngine } from '../lib/engine/fake.ts';
import type { Manifest } from '../lib/types/index.ts';
import { attachAnnouncer } from '../lib/ui/announcer.svelte.ts';
import { createApp } from './application.svelte.ts';
import type { App } from './application.svelte.ts';
import AppShell from './App.svelte';
import { shellOptions, startApp } from './boot.ts';
import type { UiPorts } from './ports.ts';

// The index of published brains is a file of the site, which the test page does not serve.
vi.mock('../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

// The prefetch only runs on a device the quality profile allows; this one decides it.
vi.mock('../lib/engine/render/quality.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/engine/render/quality.ts')>()),
  qualityProfile: () => ({ prefetchLayers: true }),
}));

const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);
const hiddenRegion = manifest.regions.find((region) => region.kind !== 'non-region')!.id;
const PICKED = 'destrieux:left:30';
const assetError = Object.assign(new Error('offline'), { code: 'asset-fetch' });

let apps: App[];
let engine: FakeEngine;
let region: HTMLElement;
let detach: () => void;
let stops: (() => void)[];

const createEngine = vi.fn<CreateEngine>(async () => engine);

/** What the regions provide once they mount: each command a recorder, each question no. */
function portStubs() {
  return {
    showDetail: vi.fn(),
    showList: vi.fn(),
    showMri: vi.fn(),
    openPreparedPlane: vi.fn(async () => {}),
    revealOnSelect: vi.fn(),
    back: vi.fn(),
    focusSearch: vi.fn(),
    walkTree: vi.fn(),
    openDiffusionMri: vi.fn(),
    openMpr: vi.fn(),
    closeMpr: vi.fn(),
    toggleShortcuts: vi.fn(),
    openFunction: vi.fn(),
    openDeficit: vi.fn(),
    openLessonMri: vi.fn(),
    focusInDetail: () => false,
    mprOpen: () => false,
    diffusionMriOpen: () => false,
    shortcutsOpen: () => false,
  } satisfies UiPorts;
}

/** Starts the app on a link, with regions that mount as soon as the world exists, as they will. */
async function boot(hash = '', create: CreateEngine = createEngine) {
  history.replaceState(null, '', `${location.pathname}${hash}`);
  const app = createApp();
  apps.push(app);
  const ports = portStubs();
  let framedBeforeMount = -1;
  stops.push(
    $effect.root(() => {
      $effect(() => {
        if (!app.world) return;
        framedBeforeMount = cameraCalls().length;
        return app.registerPorts(ports);
      });
    }),
  );
  await startApp(app, create);
  return { app, ports, framedBeforeMount };
}

const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

const cameraCalls = () =>
  engine.calls
    .filter((call) => call.domain === 'camera')
    .map((call) => [call.method, ...call.args]);

beforeEach(() => {
  apps = [];
  stops = [];
  engine = createFakeEngine({ manifest, domains: domains as never });
  createEngine.mockClear();
  createEngine.mockImplementation(async () => engine);
  document.body.append(Object.assign(document.createElement('main'), { id: 'viewport' }));
  region = document.body.appendChild(document.createElement('p'));
  detach = attachAnnouncer(region);
  localStorage.clear();
});
afterEach(() => {
  for (const app of apps) app.dispose();
  for (const stop of stops) stop();
  detach();
  region.remove();
  document.getElementById('viewport')?.remove();
  document.documentElement.lang = 'en';
  history.replaceState(null, '', location.pathname);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the start', () => {
  test('frames the opening view with the stage’s own framing, then applies the link, then is ready', async () => {
    // The status each view is framed under: the link's own is applied while loading.
    const statuses: string[] = [];
    const applyView = engine.camera.applyView;
    vi.spyOn(engine.camera, 'applyView').mockImplementation((name, options) => {
      statuses.push(`${name}:${apps[0]!.session.state.status}`);
      return applyView(name, options);
    });
    const { app } = await boot('#view=left');
    expect(statuses).toEqual(['oblique:loading', 'left:loading']);
    expect(app.session.state.status).toBe('ready');
    expect(cameraCalls()[0]).toEqual(['setFramingSource', app.stage.framing]);
    expect(app.session.state.view).toBe('left');
  });

  test('mounts the regions before it frames the camera, so the dock is there to clear', async () => {
    const { framedBeforeMount } = await boot();
    expect(framedBeforeMount).toBe(0);
  });

  test('mounts the regions before it applies the link, so the controllers find their ports', async () => {
    // A link that opens a function reaches the workspace and the panel's entry point.
    const { ports } = await boot(`#tab=functions&function=${domains.domains[0]!.id}`);
    expect(ports.showDetail).toHaveBeenCalled();
    expect(ports.openFunction).toHaveBeenCalledWith(domains.domains[0]!.id);
  });

  test('says what a link restored, because the announcer exists before the restore', async () => {
    await boot(`#hidden=${hiddenRegion}`);
    await vi.waitFor(() => expect(region.textContent).toBe('1 part hidden'));
  });

  test('hands the page the announcer’s part sentence, said with the count the next change makes', async () => {
    const { app } = await boot();
    app.world!.speech.part('Hidden: X, left.');
    app.world!.anatomy.hideRegions([hiddenRegion]);
    flushSync();
    expect(region.textContent).toBe('Hidden: X, left. 1 part hidden');
  });

  test('names an unpublished anatomy and opens the published one', async () => {
    const { app } = await boot('#anatomy=nobody');
    expect(createEngine.mock.calls[0]![0].manifestUrl).toMatch(/\/models\/cdmd\/manifest\.json$/);
    expect(app.session.state.notice!.text).toBe(
      t('en', 'link').notApplied(t('en', 'link').fields.anatomy),
    );
  });

  test('opens the defaults when the link names a layer the anatomy does not publish', async () => {
    createEngine.mockImplementation(async ({ atlas }: EngineOptions) => {
      if (atlas)
        throw Object.assign(new Error(`Unknown atlas: ${atlas}`), { code: 'unknown-layer' });
      return engine;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = await boot('#atlas=nonexistent&detail=learning');
    expect(createEngine.mock.calls.map(([options]) => [options.atlas, options.detail])).toEqual([
      ['nonexistent', 'learning'],
      [undefined, undefined],
    ]);
    expect(app.session.state.status).toBe('ready');
    expect(app.session.state.notice!.text).toBe(
      t('en', 'link').notApplied(t('en', 'link').fields.atlas),
    );
  });

  test('reports the download’s progress while it runs, and not after it failed', async () => {
    let fail: (error: Error) => void;
    let report: EngineOptions['onProgress'];
    const start = boot('', (options) => {
      report = options.onProgress;
      return new Promise((_resolve, reject) => (fail = reject));
    });
    await vi.waitFor(() => expect(report).toBeDefined());
    const [app] = apps;
    report!({ loaded: 1, total: 4 });
    expect(app!.session.state).toMatchObject({
      status: 'loading',
      progress: { loaded: 1, total: 4 },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fail!(assetError);
    await start;
    report!({ loaded: 2, total: 4 });
    expect(app!.session.state.status).toBe('error');
  });

  test('fetches the other atlas ahead, once the first is shown', async () => {
    vi.stubGlobal('requestIdleCallback', (run: () => void) => run());
    await boot();
    vi.unstubAllGlobals();
    expect(
      engine.calls.filter((call) => call.method === 'prefetchLayer').map((c) => c.args),
    ).toEqual([['hcp-mmp']]);
  });

  test('stays on the link’s address bar until a settled camera writes the scene', async () => {
    vi.useFakeTimers();
    const { app } = await boot();
    app.world!.anatomy.setHemisphere('left');
    flushSync();
    expect(location.hash).toBe('');
    await vi.advanceTimersByTimeAsync(250);
    expect(location.hash).toContain('hemi=left');
  });

  test('takes a link edited in place as scene commands, in the link’s language, and does not save it', async () => {
    await boot();
    history.replaceState(null, '', '#lang=fr&view=left');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(apps[0]!.session.state.view).toBe('left'));
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('planum-lang')).toBeNull();
  });

  test('disposes the engine when the page is finally left, and not when it is kept for Back', async () => {
    await boot();
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(engine.model.disposed).toBe(false);
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    expect(engine.model.disposed).toBe(true);
  });
});

describe('the controllers', () => {
  test('share one scene-command counter: a command overtakes a link restore', async () => {
    const { app } = await boot();
    const world = app.world!;
    const restoring = world.links.restore({ state: { view: 'right' }, rejected: [] }, {});
    world.commands.begin();
    expect(await restoring).toBeNull();
  });

  test('read the session through the adapter, so a failure is worded in the reader’s language', async () => {
    const { app } = await boot();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    app.chooseLanguage('fr');
    app.world!.commands.fail('landmark', new Error('no mesh'));
    expect(app.session.state.notice!.text).toBe(t('fr', 'errors').operations.landmark);
  });

  test('select the region a click on the model picked, and show its detail', async () => {
    const { ports } = await boot();
    engine.emit('pick', { id: PICKED });
    expect(engine.model.state.selectedRegion?.id).toBe(PICKED);
    expect(ports.showDetail).toHaveBeenCalled();
  });

  test('say a lost graphics context and its return', async () => {
    const { app } = await boot();
    engine.emit('contextLost', undefined);
    expect(app.session.state.status).toBe('context-lost');
    engine.emit('contextRestored', undefined);
    expect(app.session.state.status).toBe('ready');
  });

  test('tell the reader of a download the model started by itself that failed', async () => {
    const { app } = await boot();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    engine.emit('loadError', assetError);
    expect(app.session.state.notice!.text).toContain(t('en', 'errors').operations.whiteMatter);
  });

  test('paint the model from the open function', async () => {
    const id = domains.domains[0]!.id;
    await boot(`#tab=functions&function=${id}&atlas=${domains.atlas}`);
    await vi.waitFor(() => expect(engine.model.settings.paint).not.toBeNull());
  });
});

describe('the keymap', () => {
  test('acts once the model has loaded: C hides the cortex, a view key frames its view', async () => {
    await boot();
    press('c');
    expect(engine.model.state.cortexVisible).toBe(false);
    press('1');
    expect(cameraCalls().at(-1)).toEqual(['applyView', 'left', { immediate: true }]);
  });

  test('follows the reader’s single-key preference', async () => {
    const { app } = await boot();
    app.keyPreference.set(false);
    press('c');
    expect(engine.model.state.cortexVisible).toBe(true);
    app.keyPreference.set(true);
    press('c');
    expect(engine.model.state.cortexVisible).toBe(false);
  });

  test('turns and zooms the model from the canvas, whose own keys the engine remembers', async () => {
    await boot();
    document.body.append(engine.canvas);
    press('ArrowLeft', engine.canvas);
    press('=', engine.canvas);
    expect(
      cameraCalls()
        .slice(-2)
        .map(([method]) => method),
    ).toEqual(['orbitBy', 'dolly']);
  });

  test('is gone with the app', async () => {
    const { app } = await boot();
    app.dispose();
    press('c');
    expect(engine.model.state.cortexVisible).toBe(true);
  });
});

describe('a failed start', () => {
  test('without WebGL 2 says what is needed, offers no retry and never opens the engine', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { app } = await boot();
    expect(app.session.state.status).toBe('error');
    expect(app.failure).toEqual({ text: t('en', 'errors').webgl2 });
    expect(createEngine).not.toHaveBeenCalled();
  });

  test('a failed download says so with Retry, and leaves nothing running', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = vi.fn<CreateEngine>(async () => {
      throw assetError;
    });
    const { app } = await boot('', failing);
    // Only an unknown layer is retried with the defaults; any other error fails the start.
    expect(failing).toHaveBeenCalledOnce();
    expect(app.session.state).toMatchObject({ status: 'error', error: assetError });
    expect(app.failure).toEqual({
      text: `${t('en', 'errors').operations.start} ${t('en', 'errors').download}`,
      button: t('en', 'viewport').retry,
      dropLink: false,
    });
    expect(app.world).toBeNull();
  });

  test('from a link says the link failed, and Retry opens Planum without it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = await boot('#view=left', async () => {
      throw new Error('renderer');
    });
    expect(app.failure).toMatchObject({ dropLink: true });
    expect(app.failure!.text).toContain(t('en', 'errors').linkRetry);
  });

  test('after the engine opened releases it, with the page in the language it was in', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // A build that publishes no neuropsychological domains cannot compose the Functions tab.
    engine = createFakeEngine({ manifest });
    const { app } = await boot('#lang=fr');
    expect(engine.model.disposed).toBe(true);
    expect(app.world).toBeNull();
    expect(app.session.state.status).toBe('error');
    expect(app.failure!.button).toBe(t('fr', 'viewport').retry);
  });
});

describe('the start, the published files and the teardown', () => {
  test('reads the published files from the site root, wherever the page is served', async () => {
    await boot();
    expect(createEngine.mock.calls[0]![0].manifestUrl).toBe(
      `${ASSET_BASE}models/cdmd/manifest.json`,
    );
  });

  test('unmounts the regions before it disposes the engine', async () => {
    const app = createApp();
    apps.push(app);
    let disposedAtTeardown: boolean | undefined;
    stops.push(
      $effect.root(() => {
        $effect(() => {
          if (!app.world) return;
          const withdraw = app.registerPorts(portStubs());
          return () => {
            disposedAtTeardown = engine.model.disposed;
            withdraw();
          };
        });
      }),
    );
    await startApp(app, createEngine);
    app.dispose();
    expect(disposedAtTeardown).toBe(false);
    expect(engine.model.disposed).toBe(true);
  });

  test('unbinds the hashchange listener it bound', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { app } = await boot();
    const [, handler] = add.mock.calls.find(([type]) => type === 'hashchange')!;
    app.dispose();
    expect(remove).toHaveBeenCalledWith('hashchange', handler);
  });

  test('gives the engine the theme the reader chooses', async () => {
    const { app } = await boot();
    app.theme.choose('dark');
    expect(
      engine.calls.filter((call) => call.method === 'applyTheme').map((call) => call.args),
    ).toContainEqual(['dark']);
  });
});

describe('every controller shares the one scene-command counter', () => {
  const restoring = (world: NonNullable<App['world']>) =>
    world.links.restore({ state: { view: 'right' }, rejected: [] }, {});

  test('an excursion command overtakes a link restore', async () => {
    const { app } = await boot();
    const world = app.world!;
    const restore = restoring(world);
    void world.excursions.openCircuit(world.circuits.all[0]!.id);
    expect(await restore).toBeNull();
  });

  test('an anatomy command overtakes a link restore', async () => {
    const { app } = await boot();
    const restore = restoring(app.world!);
    void app.world!.anatomy.setSpinalCordVisible(false);
    expect(await restore).toBeNull();
  });
});

describe('the link hooks', () => {
  test('a view key retires the stage hint', async () => {
    const { app } = await boot();
    expect(app.stage.hintRetired).toBe(false);
    press('1');
    expect(app.stage.hintRetired).toBe(true);
  });

  test('a linked region opens the tree group that holds it', async () => {
    const { app } = await boot(`#region=${PICKED}`);
    const group = app.world!.catalog.groups.find((entry) =>
      entry.rows.some((row) => row.region.id === PICKED),
    )!;
    expect(app.session.state.expanded.has(group.key)).toBe(true);
  });

  test('leaving a lesson a link opened returns to the scene the link found', async () => {
    const circuit = loadCircuitCatalog(manifest, loadClinicalCatalog(manifest)).all[0]!.id;
    const { app } = await boot(`#tab=circuits&circuit=${circuit}`);
    expect(engine.model.state.selectedRegion).not.toBeNull();
    await app.world!.excursions.leaveLesson();
    expect(engine.model.state.selectedRegion).toBeNull();
  });

  test('a link forgets the scene an excursion would restore', async () => {
    const { app } = await boot();
    const world = app.world!;
    await world.excursions.openDeficit(world.clinical.search('', 'en')[0]!.id);
    expect(world.excursions.restorable).toBe(true);
    await world.links.restore({ state: {}, rejected: [] }, {});
    expect(world.excursions.restorable).toBe(false);
  });

  test('a link ends the Tracts excursion before it applies its own display', async () => {
    const { app } = await boot();
    const world = app.world!;
    world.excursions.chooseExplorer('diffusion');
    expect(world.excursions.tractsHeld).toBe(true);
    await world.links.restore(decodeState('opacity=0.5'), {});
    expect(engine.model.settings.cortexOpacity).toBe(0.5);
  });
});

describe('the mounted shell', () => {
  test('follows the session’s status and the reader’s language', () => {
    history.replaceState(null, '', location.pathname);
    const target = document.body.appendChild(document.createElement('div'));
    target.id = 'app';
    const app = createApp();
    apps.push(app);
    const shell = mount(AppShell, { target, ...shellOptions(app) });
    flushSync();
    expect(target.dataset.status).toBe('loading');
    app.session.setStatus('ready');
    app.chooseLanguage('fr');
    flushSync();
    expect(target.dataset.status).toBe('ready');
    expect(target.querySelector('aside')!.getAttribute('aria-label')).toBe(
      t('fr', 'workspace').panelAria,
    );
    unmount(shell);
    target.remove();
  });
});
