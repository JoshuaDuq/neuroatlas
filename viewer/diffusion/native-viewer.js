import { Box3, Group, LineBasicMaterial, LineSegments, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readDiffusionAsset } from './assets.js';
import { createTractGeometry, filterTractGeometry } from './native-geometry.js';
import { summarizeLengths } from './streamlines.js';
import { decodeTractAsset } from './tract-file.js';
import { createReferenceTransform } from './reference-space.js';
import { rasToWorld, worldToRas } from '../slices/coordinates.js';

export function createNativeTractViewer(catalog, invalidate) {
  const group = new Group();
  group.name = catalog.id;
  group.visible = false;
  const bundles = new Map();
  let outline = null;
  let minimum = 1;
  let disposed = false;
  let outlineVisible = true;
  let clippingPlanes = [];

  async function loadOutline() {
    if (outline) return;
    const [asset, spaceAsset] = await Promise.all([
      readDiffusionAsset(catalog.brain_outline.file), readDiffusionAsset(catalog.reference_space),
    ]);
    const space = JSON.parse(new TextDecoder().decode(spaceAsset.buffer));
    if (space.anatomy !== catalog.anatomy) throw new Error('The tract reference space belongs to a different anatomy.');
    const transform = createReferenceTransform(space.scanner_ras_to_surface_ras);
    const result = await new GLTFLoader().parseAsync(asset.buffer, '');
    if (disposed) throw new Error('Tract viewer disposed during outline loading.');
    outline = result.scene;
    outline.visible = outlineVisible;
    outline.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.geometry.computeVertexNormals();
      mesh.material.dispose();
      mesh.material = new MeshStandardMaterial({ color: 0xb3babf,
        roughness: 0.8, transparent: true, opacity: catalog.brain_outline.opacity,
        depthWrite: false });
    });
    group.matrixAutoUpdate = false;
    group.matrix.copy(transform);
    group.add(outline);
    group.updateWorldMatrix(true, true);
    invalidate();
  }

  async function loadBundle(bundle) {
    if (bundles.has(bundle.id)) {
      setVisible(bundle.id, true);
      return;
    }
    const { buffer } = await readDiffusionAsset(bundle.file);
    const source = await decodeTractAsset(buffer);
    if (disposed) throw new Error('Tract viewer disposed during bundle loading.');
    const { geometry, lengths } = createTractGeometry(source.pts, source.offsetPt0);
    filterTractGeometry(geometry, source.offsetPt0, lengths, minimum);
    const lines = new LineSegments(geometry, new LineBasicMaterial({
      vertexColors: true, toneMapped: false, clippingPlanes,
    }));
    lines.name = bundle.id;
    lines.matrixAutoUpdate = false;
    lines.updateMatrix();
    group.add(lines);
    bundles.set(bundle.id, { bundle, lines, lengths, offsets: source.offsetPt0 });
    invalidate();
  }

  function setVisible(id, visible) {
    const entry = bundles.get(id);
    if (!entry) throw new RangeError(`Unknown tract bundle: ${id}`);
    entry.lines.visible = visible;
    invalidate();
  }

  return {
    group,
    scannerToSurface(point) { return worldToRas(rasToWorld(point).applyMatrix4(group.matrix)); },
    surfaceToScanner(point) { return worldToRas(rasToWorld(point).applyMatrix4(group.matrix.clone().invert())); },
    get ready() { return Boolean(outline); },
    get anyVisible() { return [...bundles.values()].some(entry => entry.lines.visible); },
    get bounds() { return new Box3().setFromObject(outline ?? group); },
    async load() {
      await loadOutline();
      for (const bundle of catalog.bundles.filter(bundle => bundle.initial)) await loadBundle(bundle);
    },
    loadBundle,
    hasBundle(id) { return bundles.has(id); },
    setVisible,
    setOutlineVisible(value) {
      outlineVisible = value;
      if (outline) outline.visible = value;
      invalidate();
    },
    setClippingPlanes(planes) {
      if (planes === clippingPlanes) return;
      clippingPlanes = planes;
      for (const { lines } of bundles.values()) {
        lines.material.clippingPlanes = planes;
        lines.material.needsUpdate = true;
      }
      invalidate();
    },
    setOpacity(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Brain opacity must be between 0 and 1.');
      outline.traverse(mesh => { if (mesh.isMesh) mesh.material.opacity = value; });
      invalidate();
    },
    setMinimum(value) {
      for (const entry of bundles.values()) {
        filterTractGeometry(entry.lines.geometry, entry.offsets, entry.lengths, value);
      }
      minimum = value;
      invalidate();
    },
    snapshot() {
      return [...bundles.values()].map(({ bundle, lines, lengths }) => ({
        id: bundle.id, catalogId: bundle.id, name: bundle.name.en, label: bundle.name,
        file: bundle.file.split('/').at(-1), visible: lines.visible,
        ...summarizeLengths(lengths, minimum),
      }));
    },
    dispose() {
      disposed = true;
      group.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      group.removeFromParent();
      bundles.clear();
    },
  };
}
