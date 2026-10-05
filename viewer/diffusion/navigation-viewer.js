import { readDiffusionAsset } from './assets.js';
import { validateVolume } from './validation.js';
import { configureNavigationTract, sourceVoxelPoint } from './navigation-data.js';

export async function createMriNavigationViewer(catalog, canvas, onLocation) {
  const { Niivue, NVImage, SHOW_RENDER, SLICE_TYPE, MULTIPLANAR_TYPE } = await import('@niivue/niivue');
  const viewer = new Niivue({ backColor: [0.035, 0.045, 0.06, 1],
    crosshairColor: [0.47, 0.8, 0.92, 1], crosshairWidth: 1,
    show3Dcrosshair: true, isRadiologicalConvention: false,
    isCornerOrientationText: false, showAllOrientationMarkers: true,
    isForceMouseClickToVoxelCenters: true,
    isSliceMM: true, multiplanarShowRender: SHOW_RENDER.ALWAYS,
    multiplanarLayout: MULTIPLANAR_TYPE.GRID, multiplanarPadPixels: 16, meshXRay: 0.8,
    meshThicknessOn2D: 2, dragAndDropEnabled: false, logLevel: 'error' });
  const meshes = new Map();
  viewer.onLocationChange = onLocation;
  try {
    await viewer.attachToCanvas(canvas);
    for (const map of catalog.maps) {
      const { url, buffer } = await readDiffusionAsset(map.file);
      const volume = await NVImage.loadFromUrl({ url, buffer, name: map.file.split('/').at(-1),
        colormap: map.colormap, opacity: map.opacity,
        cal_min: map.range[0], cal_max: map.range[1], trustCalMinMax: true });
      validateVolume(volume);
      const reference = viewer.volumes[0];
      if (reference && (volume.hdr.dims.slice(1, 4).some((size, axis) => size !== reference.hdr.dims[axis + 1])
        || volume.hdr.affine.some((row, axis) => row.some((value, column) =>
          Math.abs(value - reference.hdr.affine[axis][column]) > 1e-5)))) {
        throw new Error('The reference MRI maps must share the same source grid and RAS transform.');
      }
      viewer.addVolume(volume);
    }
  } catch (error) {
    viewer.cleanup();
    throw error;
  }

  function setVoxel(voxel) {
    const mm = sourceVoxelPoint(voxel, viewer.volumes[0].hdr);
    viewer.scene.crosshairPos = viewer.mm2frac(mm, 0, true);
    viewer.drawScene();
    onLocation({ mm, vox: voxel, values: viewer.volumes.map(volume => ({
      name: volume.name, value: volume.getValue(...voxel),
    })) });
  }

  return {
    get header() { return viewer.volumes[0].hdr; },
    setPlane(plane) {
      if (!Object.hasOwn(SLICE_TYPE, plane)) throw new RangeError(`Unknown MRI plane: ${plane}`);
      viewer.setSliceType(SLICE_TYPE[plane]);
    },
    setVoxel,
    moveVoxel(delta) { viewer.moveCrosshairInVox(...delta); },
    setScannerPoint(point) {
      setVoxel(Array.from(viewer.volumes[0].mm2vox(point), Math.round));
    },
    setWindow(center, width) {
      if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
        throw new RangeError('MRI contrast requires a finite center and positive width.');
      }
      viewer.volumes[0].cal_min = center - width / 2;
      viewer.volumes[0].cal_max = center + width / 2;
      viewer.updateGLVolume();
    },
    setFaOpacity(value) { viewer.setOpacity(1, value); },
    async syncTracts(enabled, minimum) {
      const visible = new Set(enabled);
      for (const [id, mesh] of meshes) mesh.visible = visible.has(id);
      for (const id of enabled) {
        let mesh = meshes.get(id);
        if (!mesh) {
          const bundle = catalog.bundles.find(bundle => bundle.id === id);
          if (!bundle) throw new RangeError(`Unknown MRI tract bundle: ${id}`);
          const asset = await readDiffusionAsset(bundle.file);
          mesh = await viewer.addMeshFromUrl({ ...asset, name: bundle.file.split('/').at(-1) });
          configureNavigationTract(mesh, minimum);
          mesh.updateMesh(viewer.gl);
          meshes.set(id, mesh);
        } else if (mesh.fiberLength !== minimum) {
          mesh.fiberLength = minimum;
          mesh.updateMesh(viewer.gl);
        }
        mesh.visible = true;
      }
      viewer.drawScene();
    },
    resize() { viewer.resizeListener(); },
    dispose() {
      for (const mesh of meshes.values()) mesh.unloadMesh(viewer.gl);
      meshes.clear();
      viewer.cleanup();
      viewer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
