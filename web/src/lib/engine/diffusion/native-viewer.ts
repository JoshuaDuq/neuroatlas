import { Box3, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry, Object3D, Plane } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import type { TractBundle, TractCatalog } from '../../core/diffusion/catalogs.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
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

interface LoadedBundle {
  bundle: TractBundle;
  lines: LineSegments<ReturnType<typeof createTractGeometry>['geometry'], LineBasicMaterial>;
  /** Every point, drawn at rest, and the coarser lines drawn while the camera moves. */
  still: BufferGeometry;
  moving: BufferGeometry;
  lengths: Float64Array;
  offsets: Uint32Array;
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

  async function loadOutline(): Promise<void> {
    if (outline) return;
    const [asset, spaceAsset] = await Promise.all([
      readDiffusionAsset(catalog.brain_outline.file),
      readDiffusionAsset(catalog.reference_space),
    ]);
    const space = JSON.parse(new TextDecoder().decode(spaceAsset.buffer)) as ReferenceSpace;
    if (space.anatomy !== catalog.anatomy) {
      throw new Error('The tract reference space belongs to a different anatomy.');
    }
    const transform = createReferenceTransform(space.scanner_ras_to_surface_ras);
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
    group.matrixAutoUpdate = false;
    group.matrix.copy(transform);
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
    group.add(lines);
    bundles.set(bundle.id, { bundle, lines, still: geometry, moving, lengths, offsets: tract.offsetPt0 });
    invalidate();
  }

  /** A bundle requested again while it downloads shares the one load, so it is added once. */
  function loadBundle(bundle: TractBundle): Promise<void> {
    if (bundles.has(bundle.id)) {
      setVisible(bundle.id, true);
      return Promise.resolve();
    }
    let pending = loading.get(bundle.id);
    if (!pending) {
      pending = addBundle(bundle).finally(() => loading.delete(bundle.id));
      loading.set(bundle.id, pending);
    }
    return pending;
  }

  function setVisible(id: string, visible: boolean): void {
    const entry = bundles.get(id);
    if (!entry) throw new RangeError(`Unknown tract bundle: ${id}`);
    entry.lines.visible = visible;
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
      for (const { lines } of bundles.values()) {
        lines.material.clippingPlanes = planes;
        lines.material.needsUpdate = true;
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
      for (const entry of bundles.values()) {
        filterTractGeometry(entry.still, entry.offsets, entry.lengths, value);
        filterTractGeometry(entry.moving, entry.offsets, entry.lengths, value, MOTION_STRIDE);
      }
      minimum = value;
      invalidate();
    },
    /** Draw the coarser lines while the camera moves; the scene redraws at rest with every point. */
    setMotion(moving: boolean) {
      inMotion = moving;
      for (const entry of bundles.values()) entry.lines.geometry = moving ? entry.moving : entry.still;
    },
    snapshot(): TractSnapshot[] {
      return [...bundles.values()].map(({ bundle, lines, lengths }) => ({
        id: bundle.id,
        catalogId: bundle.id,
        name: bundle.name.en!,
        label: bundle.name,
        file: bundle.file.split('/').at(-1)!,
        visible: lines.visible,
        ...summarizeLengths(lengths, minimum),
      }));
    },
    dispose() {
      disposed = true;
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
