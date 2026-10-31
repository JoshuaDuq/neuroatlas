import type { Box3, Matrix4, Object3D, Plane } from 'three';
import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import type { EngineEvents, EngineTracts, LesionSphere, TractCrossing, Vec3 } from '../api.ts';
import { streamlinesCrossing } from '../lesion/measure.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import { createNativeTractViewer } from './native-viewer.ts';
import { createMriNavigationViewer } from './navigation-viewer.ts';
import { createReferenceTransform } from './reference-space.ts';
import { createTractLoader, decodeTractAsset } from './tract-file.ts';

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
  /** The anatomy's own bundles and the lesion count over them; null when the tracts are another subject's. */
  readonly own: {
    readonly bundles: readonly { id: string }[];
    crossing(
      sphere: LesionSphere,
      ids: readonly string[],
      onBundle?: (counted: number, total: number) => void,
    ): Promise<TractCrossing[]>;
    /** One bundle's streamlines that `crossing` counts, shown over the brain whether or not the overlay is. */
    showCrossing(id: string, sphere: LesionSphere): Promise<void>;
    clearCrossing(): void;
  } | null;
  setClippingPlanes(planes: Plane[]): void;
  /** Whether the camera is moving, so the lines it draws are the coarser ones. */
  setMotion(moving: boolean): void;
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
  // The lesion's streamlines or a landmark's bundle, drawn alone whether or not the overlay is.
  let isolated: 'lesion' | 'landmark' | null = null;

  function showGroup(): void {
    engine.group.visible = matchingAnatomy ? overlayVisible || isolated !== null : active;
    scene.invalidate();
  }

  function bundleOf(id: string) {
    const bundle = catalog.bundles.find((bundle) => bundle.id === id);
    if (!bundle) throw new RangeError(`Unknown tract bundle: ${id}`);
    return bundle;
  }

  // Surface RAS to the scan's, where the streamlines are; read apart from the outline, which only the tab loads.
  let toScanner: Promise<Matrix4> | null = null;
  function scannerTransform(): Promise<Matrix4> {
    toScanner ??= readDiffusionAsset(catalog.reference_space).then(({ buffer }) => {
      const space = JSON.parse(new TextDecoder().decode(buffer)) as {
        anatomy: string;
        scanner_ras_to_surface_ras: number[][];
      };
      if (space.anatomy !== catalog.anatomy) {
        throw new Error('The tract reference space belongs to a different anatomy.');
      }
      return createReferenceTransform(space.scanner_ras_to_surface_ras).invert();
    });
    toScanner.catch(() => (toScanner = null));
    return toScanner;
  }

  /** Each bundle is downloaded, counted and let go: a lesion keeps no streamlines in memory. */
  async function crossing(
    sphere: LesionSphere,
    ids: readonly string[],
    onBundle?: (counted: number, total: number) => void,
  ): Promise<TractCrossing[]> {
    const centre = worldToRas(rasToWorld(sphere.centre).applyMatrix4(await scannerTransform()));
    const counted: TractCrossing[] = [];
    for (const id of ids) {
      const { buffer } = await readDiffusionAsset(bundleOf(id).file);
      const { pts, offsetPt0 } = await decodeTractAsset(buffer);
      counted.push({
        id,
        crossing: streamlinesCrossing(pts, offsetPt0, { centre, radius: sphere.radius }),
        total: offsetPt0.length - 1,
      });
      onBundle?.(counted.length, ids.length);
    }
    return counted;
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
    // A landmark's bundle can show before the Tracts tab ever loads the outline.
    get streamlinesVisible() {
      return engine.group.visible && engine.anyVisible;
    },
    get bounds() {
      return engine.bounds;
    },
    defaultOpacity: catalog.overlay_cortex_opacity,
    own: matchingAnatomy
      ? {
          bundles: catalog.bundles,
          crossing,
          async showCrossing(id, sphere) {
            isolated = 'lesion';
            showGroup();
            await engine.showLesionTract(bundleOf(id), sphere);
          },
          clearCrossing() {
            if (isolated !== 'lesion') return;
            isolated = null;
            engine.clearLesionTract();
            showGroup();
          },
        }
      : null,
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
    async showLandmarkTract(id) {
      if (!matchingAnatomy) throw new Error('A landmark draws only its own anatomy’s tracts.');
      const bundle = bundleOf(id);
      isolated = 'landmark';
      showGroup();
      await engine.showLandmarkTract(bundle);
      emit('tractsVisibility', undefined);
    },
    clearLandmarkTract() {
      if (isolated !== 'landmark') return;
      isolated = null;
      engine.clearLandmarkTract();
      showGroup();
      emit('tractsVisibility', undefined);
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
    setMotion: engine.setMotion,
    scannerToSurface: (point) => engine.scannerToSurface(point) as Vec3,
    surfaceToScanner: (point) => engine.surfaceToScanner(point) as Vec3,
    dispose: engine.dispose,
  };
}
