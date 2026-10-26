import { flushSync } from 'svelte';
import { ASSET_BASE } from '../../build/site.ts';
import { keepAnatomyCached } from '../boot/keep-cached.ts';
import { loadAnatomies, resolveAnatomy } from '../lib/core/assets/published-anatomy.ts';
import { t } from '../lib/core/i18n/index.ts';
import { startFailure } from '../lib/core/i18n/errors.ts';
import { prefetchAtlas } from '../lib/core/state/boot.ts';
import type { ConnectionHints } from '../lib/core/state/boot.ts';
import { decodeState } from '../lib/core/state/url-state.ts';
import type { CreateEngine, Engine, EngineError, EngineModel } from '../lib/engine/api.ts';
import { createEngine as createRealEngine } from '../lib/engine/index.ts';
import { qualityProfile } from '../lib/engine/render/quality.ts';
import { APP } from './application.svelte.ts';
import type { App } from './application.svelte.ts';
import { bindAppLifecycle } from './lifecycle.ts';
import { missingWebgl } from './webgl-check.ts';
import { composeWorld } from './world.ts';

/** What `mount` is given for `App.svelte`: its status and language follow the app, and every region can read the app from the context. */
export function shellOptions(app: App) {
  return {
    props: {
      get status() {
        return app.session.state.status;
      },
      get lang() {
        return app.language.current;
      },
    },
    context: new Map([[APP, app]]),
  };
}

/** How long the idle callback may wait before the other atlas is fetched anyway. */
const PREFETCH_FALLBACK_MS = 1500;

/** Once the first atlas is on screen, pull the other cortical atlas in while the reader is looking (app.js:73-82). */
function prefetchOtherAtlas(model: EngineModel): void {
  const atlas = prefetchAtlas(model.manifest.atlases, model.settings.atlas, {
    prefetchLayers: qualityProfile().prefetchLayers,
    connection: (globalThis.navigator as { connection?: ConnectionHints } | undefined)?.connection,
  });
  if (!atlas) return;
  const idle =
    globalThis.requestIdleCallback ?? ((run: () => void) => setTimeout(run, PREFETCH_FALLBACK_MS));
  idle(() => {
    model.prefetchLayer(atlas.id).catch((error) => console.warn('Prefetch failed:', error));
  });
}

/**
 * Opens the engine on the stage, for the atlas and detail level a link names. A layer this anatomy
 * does not publish opens the defaults instead: the link's check then names it (app.js:176-190).
 */
async function openEngine(
  app: App,
  createEngine: CreateEngine,
  manifestUrl: string,
  wanted: { atlas?: string | undefined; detail?: string | undefined },
): Promise<Engine> {
  const host = document.getElementById('viewport');
  if (!host) throw new Error('The stage element #viewport is not on the page.');
  // The layers download in parallel. Once the start has failed, the other's progress must not
  // paint "Loading" back over the error.
  let failed = false;
  const open = (atlas?: string, detail?: string) =>
    createEngine({
      host,
      manifestUrl,
      ...(atlas !== undefined && { atlas }),
      ...(detail !== undefined && { detail }),
      theme: app.theme.current,
      onProgress: ({ loaded, total }) => {
        if (!failed) app.session.setProgress({ loaded, total });
      },
    });
  try {
    try {
      return await open(wanted.atlas, wanted.detail);
    } catch (error) {
      if ((error as EngineError).code !== 'unknown-layer') throw error;
      console.error(error);
      return await open();
    }
  } catch (error) {
    failed = true;
    throw error;
  }
}

/**
 * Loads the anatomy and opens the app on it (app.js:93-212, 2079-2156; main.js:76-97). The page
 * is mounted already, so its stage says the load's progress and a failure; the reader is told
 * of those by the stage itself, not here. Resolves once the start is over, on a failure screen
 * or a ready stage.
 *
 * `createEngine` is a parameter so the whole start can be exercised without a GPU.
 */
export async function startApp(
  app: App,
  createEngine: CreateEngine = createRealEngine,
): Promise<void> {
  const missing = missingWebgl();
  if (missing) {
    app.fail(new Error(missing), { text: t(app.language.current, 'errors')[missing] });
    return;
  }
  try {
    // A link is applied field by field: what this anatomy cannot apply is named, not fatal.
    const link = decodeState(location.hash);
    const wanted = link.state;
    const modelsUrl = `${ASSET_BASE}models`;
    const published = await loadAnatomies(`${modelsUrl}/anatomies.json`);
    const requested = wanted.anatomy ?? undefined;
    const unpublished =
      requested !== undefined && !published.anatomies.some(({ id }) => id === requested);
    if (unpublished) link.rejected.push('anatomy');
    // Resolve the requested subject before constructing a scene for it.
    const anatomy = resolveAnatomy(published, unpublished ? undefined : requested);
    const engine = await openEngine(
      app,
      createEngine,
      `${modelsUrl}/${anatomy}/manifest.json`,
      wanted,
    );

    const world = composeWorld(app, engine, published.default);
    // The regions that draw from the engine mount here, and hand over the ports the controllers reach.
    app.attach(world);
    flushSync();
    // The camera opened inside the brain with no dock to clear: frame it with the dock in place.
    engine.camera.setFramingSource(app.stage.framing);
    engine.camera.applyView('oblique', { immediate: true });
    const notApplied = await world.links.restore(link, { immediate: true });
    app.session.setStatus('ready');
    world.links.report(notApplied);
    prefetchOtherAtlas(engine.model);
    globalThis.addEventListener('hashchange', world.links.onHashChange);
    app.defer(() => globalThis.removeEventListener('hashchange', world.links.onHashChange));
    bindAppLifecycle(app);
    keepAnatomyCached();
  } catch (error) {
    console.error(error);
    app.dispose();
    const failure = startFailure(
      error,
      app.language.current,
      location.hash.replace(/^#/, '') !== '',
    );
    app.fail(error instanceof Error ? error : new Error(String(error), { cause: error }), failure);
  }
}
