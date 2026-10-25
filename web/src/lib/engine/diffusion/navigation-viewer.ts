import type { NVMesh } from '@niivue/niivue';
import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import type { TractCatalog } from '../../core/diffusion/catalogs.ts';
import type { DiffusionVolume } from '../../core/diffusion/validation.ts';
import { validateVolume } from '../../core/diffusion/validation.ts';
import type { MriLocation, MriNavigator, MriPlaneChoice, Vec3 } from '../api.ts';
import { configureNavigationTract, scannerVoxel, sourceVoxelPoint } from './navigation-data.ts';
import type { TractLoader } from './tract-file.ts';

/** `loadTract` is the decode the 3D lines already hold; the navigator builds its fibers from it. */
export async function createMriNavigationViewer(
  catalog: TractCatalog,
  canvas: HTMLCanvasElement,
  onLocation: (location: MriLocation) => void,
  loadTract: TractLoader,
): Promise<MriNavigator> {
  const { Niivue, NVImage, NVMesh, SHOW_RENDER, SLICE_TYPE, MULTIPLANAR_TYPE } =
    await import('@niivue/niivue');
  const viewer = new Niivue({
    backColor: [0.035, 0.045, 0.06, 1],
    crosshairColor: [0.47, 0.8, 0.92, 1],
    crosshairWidth: 1,
    show3Dcrosshair: true,
    isRadiologicalConvention: false,
    isCornerOrientationText: false,
    showAllOrientationMarkers: true,
    isForceMouseClickToVoxelCenters: true,
    isSliceMM: true,
    multiplanarShowRender: SHOW_RENDER.ALWAYS,
    multiplanarLayout: MULTIPLANAR_TYPE.GRID,
    multiplanarPadPixels: 16,
    meshXRay: 0.8,
    meshThicknessOn2D: 2,
    dragAndDropEnabled: false,
    logLevel: 'error',
  });
  const meshes = new Map<string, NVMesh>();
  let disposed = false;
  viewer.onLocationChange = (location) => onLocation(location as MriLocation);
  try {
    await viewer.attachToCanvas(canvas);
    for (const map of catalog.maps) {
      const { url, buffer } = await readDiffusionAsset(map.file);
      const volume = await NVImage.loadFromUrl({
        url,
        buffer,
        name: map.file.split('/').at(-1)!,
        colormap: map.colormap,
        opacity: map.opacity,
        cal_min: map.range[0],
        cal_max: map.range[1],
        trustCalMinMax: true,
      });
      // A missing header is what validateVolume reports.
      validateVolume(volume as DiffusionVolume);
      const reference = viewer.volumes[0];
      if (
        reference &&
        (volume
          .hdr!.dims.slice(1, 4)
          .some((size, axis) => size !== reference.hdr!.dims[axis + 1]) ||
          volume.hdr!.affine.some((row, axis) =>
            row.some(
              (value, column) => Math.abs(value - reference.hdr!.affine[axis]![column]!) > 1e-5,
            ),
          ))
      ) {
        throw new Error(
          'The reference MRI maps must share the same source grid and RAS transform.',
        );
      }
      viewer.addVolume(volume);
    }
  } catch (error) {
    viewer.cleanup();
    throw error;
  }

  const header = () => viewer.volumes[0]!.hdr!;

  function setVoxel(voxel: Vec3): void {
    const mm = sourceVoxelPoint(voxel, header()) as unknown as Vec3;
    viewer.scene.crosshairPos = viewer.mm2frac(mm as unknown as [number, number, number], 0, true);
    viewer.drawScene();
    onLocation({
      mm,
      vox: voxel,
      values: viewer.volumes.map((volume) => ({
        name: volume.name,
        value: volume.getValue(...voxel),
      })),
    });
  }

  /** Calls run one after another, so overlapping ones never add a tract twice and the last one wins. */
  let queue: Promise<void> = Promise.resolve();
  async function sync(enabled: readonly string[], minimum: number): Promise<void> {
    // Before any mesh is added, so a rejected minimum leaves nothing half-configured.
    if (!Number.isFinite(minimum) || minimum < 1) {
      throw new RangeError('Minimum tract length must be at least 1 mm.');
    }
    const visible = new Set(enabled);
    for (const [id, mesh] of meshes) mesh.visible = visible.has(id);
    for (const id of enabled) {
      let mesh = meshes.get(id);
      if (!mesh) {
        const bundle = catalog.bundles.find((bundle) => bundle.id === id);
        if (!bundle) throw new RangeError(`Unknown MRI tract bundle: ${id}`);
        const tract = await loadTract(bundle);
        if (disposed) return;
        // As NiiVue's own TRK reader builds it: fibers carry a transparent base colour.
        mesh = new NVMesh(
          tract.pts,
          tract.offsetPt0,
          bundle.file.split('/').at(-1)!,
          new Uint8Array([255, 255, 255, 0]),
          1,
          true,
          viewer.gl,
          'inferno',
          null,
          tract.dps || null,
          tract.dpv || null,
        );
        viewer.addMesh(mesh);
        configureNavigationTract(mesh, minimum, tract.lengths);
        mesh.updateMesh(viewer.gl);
        meshes.set(id, mesh);
      } else if (mesh.fiberLength !== minimum) {
        mesh.fiberLength = minimum;
        mesh.updateMesh(viewer.gl);
      }
      mesh.visible = true;
    }
    viewer.drawScene();
  }

  return {
    get header() {
      return header();
    },
    setPlane(plane: MriPlaneChoice) {
      if (!Object.hasOwn(SLICE_TYPE, plane)) throw new RangeError(`Unknown MRI plane: ${plane}`);
      viewer.setSliceType(SLICE_TYPE[plane]);
    },
    setVoxel,
    moveVoxel(delta) {
      viewer.moveCrosshairInVox(...delta);
    },
    setScannerPoint(point) {
      const voxel = scannerVoxel(point, header());
      if (voxel) setVoxel(voxel as unknown as Vec3);
      return Boolean(voxel);
    },
    setWindow(center, width) {
      if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
        throw new RangeError('MRI contrast requires a finite center and positive width.');
      }
      viewer.volumes[0]!.cal_min = center - width / 2;
      viewer.volumes[0]!.cal_max = center + width / 2;
      viewer.updateGLVolume();
    },
    setFaOpacity(value) {
      viewer.setOpacity(1, value);
    },
    syncTracts(enabled, minimum) {
      const run = queue.then(() => sync(enabled, minimum));
      queue = run.catch(() => undefined);
      return run;
    },
    resize() {
      viewer.resizeListener();
    },
    /** Frees the GPU context and the volumes; a canvas whose context was lost cannot be drawn on again. */
    dispose() {
      disposed = true;
      for (const mesh of meshes.values()) mesh.unloadMesh(viewer.gl);
      meshes.clear();
      viewer.cleanup();
      viewer.volumes = [];
      viewer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
