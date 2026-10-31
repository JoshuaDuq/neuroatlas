import {
  Box3,
  GreaterDepth,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { BufferGeometry, Object3D, Plane } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import type { TractBundle, TractCatalog } from '../../core/diffusion/catalogs.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import type { LesionSphere } from '../api.ts';
import { streamlineMembership } from '../lesion/measure.ts';
import type { Ras } from '../slices/coordinates.ts';
import {
  MOTION_STRIDE,
  RAS_MM_TO_WORLD,
  createMotionGeometry,
  createTractGeometry,
  filterTractGeometry,
} from './native-geometry.ts';
import { createReferenceTransform } from './reference-space.ts';
import { summarizeLengths } from './streamlines.ts';
import type { LengthSummary } from './streamlines.ts';
import type { TractLoader } from './tract-file.ts';

/** One loaded bundle, with its length summary at the current minimum. */
export type TractSnapshot = LengthSummary & {
  id: string;
  catalogId: string;
  name: string;
  label: TractBundle['name'];
  file: string;
  visible: boolean;
};

/** How strongly a landmark's bundle shows where the anatomy in front of it hides it. */
const HIDDEN_OPACITY = 0.3;

type TractLines = LineSegments<
  ReturnType<typeof createTractGeometry>['geometry'],
  LineBasicMaterial
>;

interface LoadedBundle {
  bundle: TractBundle;
  lines: TractLines;
  /** The same lines, drawn faint only where a surface in front hides them. */
  hidden: TractLines;
  /** Every point, drawn at rest, and the coarser lines drawn while the camera moves. */
  still: BufferGeometry;
  moving: BufferGeometry;
  lengths: Float64Array;
  offsets: Uint32Array;
  /** Ordinary tract visibility, retained while the lesion or a landmark isolates a bundle. */
  visible: boolean;
}

/**
 * The one bundle drawn alone: the lesion's streamlines through its sphere, or a landmark's whole
 * bundle with its hidden stretches faint. It shows once `ready`.
 */
interface Isolated {
  id: string;
  ready: boolean;
  membership?: Uint8Array;
  whole: boolean;
}

interface ReferenceSpace {
  anatomy: string;
  scanner_ras_to_surface_ras: number[][];
}

function requireMinimum(value: number): void {
  if (!Number.isFinite(value) || value < 1) {
    throw new RangeError('Minimum streamline length must be at least 1 mm.');
  }
}

/** `loadTract` is the decode this viewer shares with the MRI navigator. */
export function createNativeTractViewer(
  catalog: TractCatalog,
  invalidate: () => void,
  loadTract: TractLoader,
) {
  const group = new Group();
  group.name = catalog.id;
  group.visible = false;
  const bundles = new Map<string, LoadedBundle>();
  const loading = new Map<string, Promise<void>>();
  let outline: Object3D | null = null;
  let minimum = 1;
  let inMotion = false;
  let disposed = false;
  let outlineVisible = true;
  let outlineOpacity = catalog.brain_outline.opacity;
  let clippingPlanes: Plane[] = [];
  let reference: Promise<void> | null = null;
  let isolateRequest = 0;
  let selected: Isolated | null = null;

  function loadReference(): Promise<void> {
    reference ??= readDiffusionAsset(catalog.reference_space).then(({ buffer }) => {
      const space = JSON.parse(new TextDecoder().decode(buffer)) as ReferenceSpace;
      if (space.anatomy !== catalog.anatomy) {
        throw new Error('The tract reference space belongs to a different anatomy.');
      }
      group.matrixAutoUpdate = false;
      group.matrix.copy(createReferenceTransform(space.scanner_ras_to_surface_ras));
      group.updateWorldMatrix(true, true, true);
    });
    reference.catch(() => (reference = null));
    return reference;
  }

  function refresh(entry: LoadedBundle): void {
    const mine = selected?.id === entry.bundle.id ? selected : null;
    const membership = mine?.membership;
    filterTractGeometry(entry.still, entry.offsets, entry.lengths, minimum, 1, membership);
    filterTractGeometry(
      entry.moving,
      entry.offsets,
      entry.lengths,
      minimum,
      MOTION_STRIDE,
      membership,
    );
    entry.lines.visible = selected ? Boolean(mine?.ready) : entry.visible;
    entry.hidden.visible = entry.lines.visible && Boolean(mine?.whole);
  }

  async function loadOutline(): Promise<void> {
    if (outline) return;
    const [asset] = await Promise.all([
      readDiffusionAsset(catalog.brain_outline.file),
      loadReference(),
    ]);
    const result = await new GLTFLoader().parseAsync(asset.buffer, '');
    if (disposed) throw new Error('Tract viewer disposed during outline loading.');
    outline = result.scene;
    outline.visible = outlineVisible;
    outline.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      mesh.geometry.computeVertexNormals();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.material = new MeshStandardMaterial({
        color: 0xb3babf,
        roughness: 0.8,
        transparent: true,
        opacity: outlineOpacity,
        depthWrite: false,
      });
    });
    group.add(outline);
    group.updateWorldMatrix(true, true, true);
    invalidate();
  }

  async function addBundle(bundle: TractBundle): Promise<void> {
    const tract = await loadTract(bundle);
    if (disposed) throw new Error('Tract viewer disposed during bundle loading.');
    const { geometry, lengths } = createTractGeometry(tract.pts, tract.offsetPt0, tract.lengths);
    filterTractGeometry(geometry, tract.offsetPt0, lengths, minimum);
    const moving = createMotionGeometry(geometry, tract.offsetPt0, lengths, minimum);
    const lines = new LineSegments(
      inMotion ? moving : geometry,
      new LineBasicMaterial({ vertexColors: true, toneMapped: false, clippingPlanes }),
    );
    lines.name = bundle.id;
    lines.matrixAutoUpdate = false;
    lines.matrix.copy(RAS_MM_TO_WORLD);
    lines.matrixWorldNeedsUpdate = true;
    lines.visible = false;
    // Transparent, so it draws after every opaque surface it is tested against.
    const hidden = new LineSegments(
      lines.geometry,
      new LineBasicMaterial({
        vertexColors: true,
        toneMapped: false,
        clippingPlanes,
        transparent: true,
        opacity: HIDDEN_OPACITY,
        depthFunc: GreaterDepth,
        depthWrite: false,
      }),
    );
    hidden.name = `${bundle.id}-hidden`;
    hidden.matrixAutoUpdate = false;
    hidden.matrix.copy(RAS_MM_TO_WORLD);
    hidden.matrixWorldNeedsUpdate = true;
    hidden.visible = false;
    group.add(lines, hidden);
    bundles.set(bundle.id, {
      bundle,
      lines,
      hidden,
      still: geometry,
      moving,
      lengths,
      offsets: tract.offsetPt0,
      visible: false,
    });
    invalidate();
  }

  /** A bundle requested again while it downloads shares the one load, so it is added once. */
  function ensureBundle(bundle: TractBundle): Promise<void> {
    if (bundles.has(bundle.id)) return Promise.resolve();
    let pending = loading.get(bundle.id);
    if (!pending) {
      pending = addBundle(bundle).finally(() => loading.delete(bundle.id));
      loading.set(bundle.id, pending);
    }
    return pending;
  }

  async function loadBundle(bundle: TractBundle): Promise<void> {
    await ensureBundle(bundle);
    setVisible(bundle.id, true);
  }

  /** Hide every bundle but the one asked for, until it is downloaded and placed. */
  async function isolate(bundle: TractBundle, whole: boolean): Promise<LoadedBundle | null> {
    const ask = ++isolateRequest;
    selected = { id: bundle.id, ready: false, whole };
    for (const entry of bundles.values()) refresh(entry);
    invalidate();
    await Promise.all([loadReference(), ensureBundle(bundle)]);
    return ask === isolateRequest && !disposed ? bundles.get(bundle.id)! : null;
  }

  function clearIsolated(): void {
    isolateRequest++;
    selected = null;
    for (const entry of bundles.values()) refresh(entry);
    invalidate();
  }

  function setVisible(id: string, visible: boolean): void {
    const entry = bundles.get(id);
    if (!entry) throw new RangeError(`Unknown tract bundle: ${id}`);
    entry.visible = visible;
    refresh(entry);
    invalidate();
  }

  return {
    group,
    scannerToSurface(point: Ras) {
      return worldToRas(rasToWorld(point).applyMatrix4(group.matrix));
    },
    surfaceToScanner(point: Ras) {
      return worldToRas(rasToWorld(point).applyMatrix4(group.matrix.clone().invert()));
    },
    get ready() {
      return Boolean(outline);
    },
    get anyVisible() {
      return [...bundles.values()].some((entry) => entry.lines.visible);
    },
    get bounds() {
      return new Box3().setFromObject(outline ?? group);
    },
    async load() {
      await loadOutline();
      for (const bundle of catalog.bundles.filter((bundle) => bundle.initial)) {
        await loadBundle(bundle);
      }
    },
    loadBundle,
    async showLesionTract(bundle: TractBundle, sphere: LesionSphere): Promise<void> {
      const entry = await isolate(bundle, false);
      if (!entry) return;
      const centre = worldToRas(
        rasToWorld(sphere.centre).applyMatrix4(group.matrix.clone().invert()),
      );
      selected = {
        id: bundle.id,
        ready: true,
        membership: streamlineMembership(
          entry.still.getAttribute('position').array as Float32Array,
          entry.offsets,
          { centre, radius: sphere.radius },
        ),
        whole: false,
      };
      refresh(entry);
      invalidate();
    },
    clearLesionTract: clearIsolated,
    /** A landmark's bundle, every streamline of it at the current minimum. */
    async showLandmarkTract(bundle: TractBundle): Promise<void> {
      const entry = await isolate(bundle, true);
      if (!entry) return;
      selected = { id: bundle.id, ready: true, whole: true };
      refresh(entry);
      invalidate();
    },
    /** Only a landmark's bundle is taken away; the lesion's stays. */
    clearLandmarkTract(): void {
      if (selected?.whole) clearIsolated();
    },
    hasBundle(id: string) {
      return bundles.has(id);
    },
    setVisible,
    setOutlineVisible(value: boolean) {
      outlineVisible = value;
      if (outline) outline.visible = value;
      invalidate();
    },
    setClippingPlanes(planes: Plane[]) {
      if (planes === clippingPlanes) return;
      clippingPlanes = planes;
      for (const { lines, hidden } of bundles.values()) {
        for (const { material } of [lines, hidden]) {
          material.clippingPlanes = planes;
          material.needsUpdate = true;
        }
      }
      invalidate();
    },
    setOpacity(value: number) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError('Brain opacity must be between 0 and 1.');
      }
      outlineOpacity = value;
      outline?.traverse((mesh) => {
        if (mesh instanceof Mesh) (mesh.material as MeshStandardMaterial).opacity = value;
      });
      invalidate();
    },
    setMinimum(value: number) {
      // Checked up front, so an empty or part-filtered set never keeps a value that loading rejects.
      requireMinimum(value);
      minimum = value;
      for (const entry of bundles.values()) refresh(entry);
      invalidate();
    },
    /** Draw the coarser lines while the camera moves; the scene redraws at rest with every point. */
    setMotion(moving: boolean) {
      inMotion = moving;
      for (const entry of bundles.values()) {
        entry.lines.geometry = entry.hidden.geometry = moving ? entry.moving : entry.still;
      }
    },
    snapshot(): TractSnapshot[] {
      return [...bundles.values()].map(({ bundle, visible, lengths }) => ({
        id: bundle.id,
        catalogId: bundle.id,
        name: bundle.name.en!,
        label: bundle.name,
        file: bundle.file.split('/').at(-1)!,
        visible,
        ...summarizeLengths(lengths, minimum),
      }));
    },
    dispose() {
      disposed = true;
      isolateRequest++;
      group.traverse((object) => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          object.geometry.dispose();
          (object.material as { dispose(): void }).dispose();
        }
      });
      for (const { lines, still, moving } of bundles.values()) {
        (lines.geometry === still ? moving : still).dispose();
      }
      group.removeFromParent();
      bundles.clear();
    },
  };
}

export type NativeTractViewer = ReturnType<typeof createNativeTractViewer>;
