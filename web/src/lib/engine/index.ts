import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readComparisonGeometry } from '../core/assets/comparison-assets.ts';
import { t } from '../core/i18n/index.ts';
import type {
  CreateEngine,
  Emitter,
  Engine,
  EngineComparison,
  EngineEvents,
  EngineOptions,
  Presentation,
} from './api.ts';
import { createEngineModel, createEngineSections } from './adapters.ts';
import { createComparisonOverlay } from './comparison/overlay.ts';
import { createTracts } from './diffusion/tracts.ts';
import type { TractsOptions } from './diffusion/tracts.ts';
import { createFraming } from './framing.ts';
import type { Emit } from './framing.ts';
import { createHeldView } from './held-view.ts';
import { BrainAtlas } from './model/brain-atlas.ts';
import { createPresentation } from './presentation.ts';
import { createPicker } from './render/picking.ts';
import { stayOutside, zoomAboutSurface } from './render/orbit-controls.ts';
import { createScene } from './render/scene.ts';
import type { Appearance as SceneAppearance } from './render/scene.ts';
import { BrainSections } from './slices/sections.ts';

/** How long the camera must rest before its move counts as settled and the link follows it. */
const CAMERA_REST_MS = 250;

type Listener = (event: unknown) => void;

function createEvents(): Emitter<EngineEvents> & { emit: Emit } {
  const listeners = new Map<keyof EngineEvents, Set<Listener>>();
  return {
    on(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener as Listener);
      listeners.set(type, set);
      return () => set.delete(listener as Listener);
    },
    emit(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

/** The brain without the supplemental layers: the box the page opens on and framing falls back to. */
function brainBounds(atlas: BrainAtlas): Box3 {
  const box = new Box3();
  for (const [id, layer] of atlas.layers) {
    if (atlas.manifest.supplemental_layers?.some((layer) => layer.id === id)) continue;
    for (const mesh of layer.meshes) box.expandByObject(mesh);
  }
  return box.isEmpty() ? new Box3().setFromObject(atlas.group) : box;
}

/**
 * The real engine: the scene first, then the model, the cut, the tracts and the compiled outline
 * shaders (app.js:118-208, 2122). Everything the application reaches is the contract in `api.ts`; the
 * Three.js, GLTF and NiiVue sides stay behind it.
 */
export const createEngine: CreateEngine = async (options: EngineOptions): Promise<Engine> => {
  const { host, manifestUrl } = options;
  const events = createEvents();
  const cleanups: (() => void)[] = [];
  const dispose = () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };

  // Declared before the scene: its resize observer can fire during the model download, which is long.
  let framing: ReturnType<typeof createFraming> | null = null;
  const scene = createScene(host, {
    onContextLost: () => events.emit('contextLost', undefined),
    onContextRestored: () => events.emit('contextRestored', undefined),
    onResize: (change) => framing?.onResize(change),
  });
  cleanups.push(() => scene.dispose());

  try {
    const atlas = await BrainAtlas.load(manifestUrl, options.atlas, {
      ...(options.detail !== undefined && { detail: options.detail }),
      onProgress: (progress) => {
        if (progress.total) options.onProgress?.(progress);
      },
    });
    cleanups.push(() => atlas.dispose());
    const anatomy = atlas.manifest.anatomy.id;

    scene.applyTheme();
    scene.setSize();
    const { lighting } = atlas.manifest.appearance as { lighting?: SceneAppearance['lighting'] };
    if (!lighting) throw new Error('The manifest publishes no lighting.');
    scene.setAppearance({ lighting });
    const bounds = brainBounds(atlas);
    scene.scene.add(atlas.group);

    const absoluteManifestUrl = new URL(manifestUrl, globalThis.location.href);
    const sections = new BrainSections(atlas, new URL('volumes.json', absoluteManifestUrl));
    cleanups.push(() => sections.dispose());
    scene.scene.add(sections.group);

    const tracts = createTracts({
      anatomy,
      scene: { add: (object) => scene.scene.add(object), invalidate: scene.invalidate },
      emit: events.emit as TractsOptions['emit'],
    });
    cleanups.push(() => tracts.dispose());
    const reference = {
      active: false,
      get bounds() {
        return tracts.ready ? tracts.bounds : null;
      },
    };

    // Zoom stops short of what the reader is pointing at, and turning never goes beneath a surface;
    // the tract reference has no surface to meet. The zoom wraps the check, so it judges only the turn
    // or pan that follows: a zoom cannot cross.
    const surfaceHit: Parameters<typeof stayOutside>[1] = (raycaster) =>
      reference.active ? null : sections.intersect(raycaster);
    stayOutside(scene.controls, surfaceHit);
    // Framing is created below, before the reader can zoom.
    zoomAboutSurface(scene.controls, surfaceHit, (direction) => framing!.home(direction));

    const held = createHeldView({
      controls: scene.controls,
      host,
      onChange: (isHeld) => events.emit('viewHeld', { held: isHeld }),
    });
    cleanups.push(() => held.dispose());

    // The atlas comparison geometry is named by the call that first asks for it.
    let geometry: { file: string; sha256: string } | null = null;
    const overlay = createComparisonOverlay(async () => {
      const { file, sha256 } = geometry!;
      const buffer = await readComparisonGeometry(new URL(file, absoluteManifestUrl).href, sha256);
      const gltf = await new GLTFLoader().parseAsync(
        buffer,
        new URL('.', absoluteManifestUrl).href,
      );
      return gltf.scene;
    });
    cleanups.push(() => overlay.dispose());
    scene.scene.add(overlay.group);

    const presentation = createPresentation({
      scene,
      model: atlas,
      sections,
      overlay,
      referenceActive: () => reference.active,
      emit: events.emit,
    });
    framing = createFraming({
      scene,
      model: atlas,
      sections,
      held,
      bounds,
      reference,
      emit: events.emit,
    });
    const stage = framing;

    const picker = createPicker({
      domElement: scene.domElement,
      camera: scene.camera,
      controls: scene.controls,
      model: () =>
        reference.active
          ? { pick: () => null }
          : {
              pick: (ray) => sections.pick(ray) ?? null,
              intersect: (ray) => sections.intersect(ray),
            },
      onHover: presentation.hover,
      onSelect: (id) => events.emit('pick', { id }),
      onFocusPoint: stage.focusWorldPoint,
    });
    cleanups.push(() => picker.dispose());

    // What the last `present()` asked for; every change of the display reapplies it (app.js:1611-1639).
    let shown: Presentation = { lang: 'en', referenceOnly: false };
    function refresh() {
      const { referenceOnly } = shown;
      const { surfaceColor, paint } = atlas.settings;
      atlas.group.visible = !referenceOnly;
      sections.group.visible = !referenceOnly && sections.active;
      if (anatomy === tracts.anatomy) tracts.setClippingPlanes(atlas.clippingPlanes);
      scene.setMriAppearance(surfaceColor === 'mri' && !paint && !referenceOnly);
      presentation.outline();
    }

    const engineSections = createEngineSections(sections);
    const onChange = () => {
      stage.invalidate();
      refresh();
      events.emit('change', { model: atlas.state, sections: engineSections.state });
    };
    atlas.addEventListener('change', onChange);
    sections.addEventListener('change', onChange);
    cleanups.push(() => {
      atlas.removeEventListener('change', onChange);
      sections.removeEventListener('change', onChange);
    });
    const onLoadError = (event: Event) =>
      events.emit('loadError', (event as CustomEvent<Error>).detail);
    atlas.addEventListener('loaderror', onLoadError);
    cleanups.push(() => atlas.removeEventListener('loaderror', onLoadError));

    // The camera coasts on after the pointer lifts; it has settled once it has rested.
    let rest: ReturnType<typeof setTimeout> | undefined;
    const onCameraChange = () => {
      clearTimeout(rest);
      rest = setTimeout(() => events.emit('cameraSettled', undefined), CAMERA_REST_MS);
    };
    scene.controls.addEventListener('change', onCameraChange);
    cleanups.push(() => {
      clearTimeout(rest);
      scene.controls.removeEventListener('change', onCameraChange);
    });

    cleanups.push(
      events.on('tractsActive', ({ active }) => {
        reference.active = active;
        presentation.clearHover();
        presentation.outline();
        stage.onReference();
        scene.invalidate();
      }),
      events.on('tractsReady', () => {
        stage.onReferenceReady();
        refresh();
      }),
    );

    const comparison: EngineComparison = {
      async highlight(id, source) {
        geometry ??= source;
        const applied = await overlay.highlight(id);
        if (applied) presentation.outline();
        return applied;
      },
      clear() {
        overlay.clear();
        presentation.outline();
      },
      // Redraw the outline too: the overlap's mesh is what it draws while the overlay is shown.
      setVisible(visible) {
        overlay.setVisible(visible);
        presentation.outline();
      },
    };

    // The camera starts inside the brain; frame it before the first layer is asked for more.
    stage.camera.applyView('oblique', { immediate: true });
    scene.warmOutlines(atlas.group);
    stage.onResize({ canvasChanged: false });
    refresh();

    let disposed = false;
    return {
      on: events.on,
      canvas: scene.domElement,
      model: createEngineModel(atlas),
      sections: engineSections,
      camera: stage.camera,
      comparison,
      tracts,

      applyTheme() {
        scene.applyTheme();
        sections.applyTheme();
        refresh();
      },
      present(presentation) {
        shown = presentation;
        stage.invalidate();
        const viewport = t(presentation.lang, 'viewport');
        scene.domElement.setAttribute(
          'aria-label',
          presentation.referenceOnly
            ? t(presentation.lang, 'diffusion').nativeCanvas
            : viewport.canvasLabel,
        );
        scene.domElement.setAttribute('aria-roledescription', viewport.canvasRole);
        refresh();
      },
      invalidate: scene.invalidate,
      captureSnapshot: (crop) => scene.captureSnapshot(crop),
      dispose() {
        if (disposed) return;
        disposed = true;
        dispose();
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
};
