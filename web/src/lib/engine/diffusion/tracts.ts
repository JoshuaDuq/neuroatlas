import type { Box3, Object3D, Plane } from 'three';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import type { EngineEvents, EngineTracts, Vec3 } from '../api.ts';
import { createNativeTractViewer } from './native-viewer.ts';
import { createMriNavigationViewer } from './navigation-viewer.ts';
import { createTractLoader } from './tract-file.ts';

type TractEvents = Pick<EngineEvents, 'tractsActive' | 'tractsReady' | 'tractsVisibility'>;

export interface TractsOptions {
  /** The anatomy on screen. */
  anatomy: string;
  scene: { add(object: Object3D): void; invalidate(): void };
  emit: <K extends keyof TractEvents>(type: K, event: TractEvents[K]) => void;
}

/** The tracts domain of the engine, with the parts the stage and the facade need beside it. */
export interface Tracts extends EngineTracts {
  readonly bounds: Box3;
  setClippingPlanes(planes: Plane[]): void;
  scannerToSurface(point: Vec3): Vec3;
  surfaceToScanner(point: Vec3): Vec3;
  dispose(): void;
}

/**
 * The engine half of the tract explorer (native-ui.js:78-294): the native viewer and the shared
 * decode behind the `tracts` domain. The tracts belong to one anatomy; on another, the outline and
 * the streamlines are an independent reference that shows only while the Tracts tab is open.
 */
export function createTracts({ anatomy, scene, emit }: TractsOptions): Tracts {
  const catalog = tractCatalog(anatomy);
  const loadTract = createTractLoader();
  const engine = createNativeTractViewer(catalog, scene.invalidate, loadTract);
  const matchingAnatomy = anatomy === catalog.anatomy;
  scene.add(engine.group);
  engine.setOutlineVisible(!matchingAnatomy);
  let active = false;
  let referenceActive = false;
  let ready = false;
  let loading: Promise<void> | null = null;
  let overlayVisible = false;

  function showGroup(): void {
    engine.group.visible = matchingAnatomy ? overlayVisible : active;
    scene.invalidate();
  }

  function bundleOf(id: string) {
    const bundle = catalog.bundles.find((bundle) => bundle.id === id);
    if (!bundle) throw new RangeError(`Unknown tract bundle: ${id}`);
    return bundle;
  }

  function load(): Promise<void> {
    loading ??= engine
      .load()
      .then(() => {
        ready = true;
        emit('tractsReady', undefined);
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  return {
    anatomy: catalog.anatomy,
    get ready() {
      return ready;
    },
    get streamlinesVisible() {
      return ready && engine.group.visible && engine.anyVisible;
    },
    get bounds() {
      return engine.bounds;
    },
    defaultOpacity: catalog.overlay_cortex_opacity,
    snapshot: engine.snapshot,
    hasBundle: engine.hasBundle,

    async setActive(next) {
      if (active !== next) {
        active = next;
        const nextReference = active && !matchingAnatomy;
        if (referenceActive !== nextReference) {
          referenceActive = nextReference;
          emit('tractsActive', { active: referenceActive });
        }
        showGroup();
      }
      if (active && !ready) await load();
    },
    async loadBundle(id) {
      await engine.loadBundle(bundleOf(id));
      emit('tractsVisibility', undefined);
    },
    setVisible(id, visible) {
      engine.setVisible(id, visible);
      emit('tractsVisibility', undefined);
    },
    setMinimum: engine.setMinimum,
    setOutlineOpacity: engine.setOpacity,
    setOverlay(visible) {
      if (visible && !matchingAnatomy)
        throw new Error('Tracts can only overlay their own anatomy.');
      overlayVisible = visible;
      showGroup();
      emit('tractsVisibility', undefined);
    },
    createMriNavigator: (canvas, onLocation) =>
      createMriNavigationViewer(catalog, canvas, onLocation, loadTract),
    setClippingPlanes: engine.setClippingPlanes,
    scannerToSurface: (point) => engine.scannerToSurface(point) as Vec3,
    surfaceToScanner: (point) => engine.surfaceToScanner(point) as Vec3,
    dispose: engine.dispose,
  };
}
