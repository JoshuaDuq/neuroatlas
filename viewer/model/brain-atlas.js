import { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { visibilityOf } from '../catalog/visibility.js';
import { fetchPublished, REVALIDATE_HEADER } from './published-assets.js';

function validateManifest(manifest) {
  // Named individually because these fail together for one boring reason — a
  // manifest cached from an earlier deploy — and "expected schema version 1"
  // sends the reader to look at the version, which was never the problem.
  const missing = [
    ['schema_version 1', manifest.schema_version === 1],
    ['atlases', manifest.atlases?.length > 0],
    ['regions', Array.isArray(manifest.regions)],
    ['detail_levels', manifest.detail_levels?.length > 0],
  ].filter(([, present]) => !present).map(([field]) => field);
  if (missing.length) {
    throw new Error(
      `Invalid brain model manifest: missing or invalid ${missing.join(', ')}. ` +
      'A stale cached copy will do this; reload ignoring the cache.',
    );
  }
  const ids = new Set();
  for (const region of manifest.regions) {
    if (!region.id || ids.has(region.id) || !region.label ||
        !['left', 'right', 'midline'].includes(region.hemisphere) ||
        !['cortex', 'structure', 'non-region', 'tissue-region'].includes(region.kind)) {
      throw new Error(`Invalid or duplicate region metadata: ${region.id}`);
    }
    ids.add(region.id);
  }
}

function disposeScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of [object.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  for (const geometry of geometries) {
    geometry.boundsTree = null;
    geometry.dispose();
  }
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  scene.removeFromParent();
}

/** Asset-only controller. Add .group to your scene; coordinates remain untouched. */
export class BrainAtlas extends EventTarget {
  static async load(manifestUrl, atlasId) {
    const url = new URL(manifestUrl, globalThis.location.href);
    const response = await fetchPublished(url);
    if (!response.ok) throw new Error(`Manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    const loader = new GLTFLoader()
      .setPath(new URL('.', url).href)
      .setRequestHeader(REVALIDATE_HEADER);
    const model = new BrainAtlas(manifest, loader);
    try {
      await model.initialize(atlasId);
      return model;
    } catch (error) {
      model.dispose();
      throw error;
    }
  }

  constructor(manifest, loader) {
    super();
    validateManifest(manifest);
    this.manifest = manifest;
    this.loader = loader;
    this.group = new Group();
    this.group.name = 'Brain atlas';
    this.regions = new Map(manifest.regions.map(region => [region.id, region]));
    this.layers = new Map();
    this.pending = new Map();
    this.atlasId = null;
    this.detailId = null;
    // Pushed in by the sections, which own the plane. Keeping it here is what
    // lets `settings` be the whole display state, so visibility reads one place.
    this.cutAtlasId = null;
    this.cutActive = false;
    this.hemisphere = 'both';
    this.cortexVisible = true;
    this.cortexOpacity = 1;
    this.atlasColors = true;
    this.sourceColors = new WeakMap();
    this.selectedId = null;
    this.isolatedId = null;
    this.requestNumber = 0;
    this.disposed = false;
    this.clippingPlanes = [];
  }

  async initialize(atlasId = this.manifest.atlases[0].id, onProgress) {
    await this.setDetail(this.manifest.detail_levels[0].id, onProgress);
    await this.setAtlas(atlasId, onProgress);
  }

  async loadLayer(id, file, onProgress) {
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    if (this.layers.has(id)) return this.layers.get(id);
    if (this.pending.has(id)) return this.pending.get(id);
    const loading = this.loader.loadAsync(file, onProgress).then(({ scene }) => {
      if (this.disposed) {
        disposeScene(scene);
        throw new Error('BrainAtlas was disposed during loading.');
      }
      const meshes = [];
      const originalMaterials = new Set();
      try {
        scene.traverse(mesh => {
          if (!mesh.isMesh) return;
          const region = this.regions.get(mesh.userData.region_id);
          if (!region) throw new Error(`Mesh has no manifest region: ${mesh.name}`);
          for (const field of ['label', 'hemisphere', 'atlas', 'source_label_id', 'kind']) {
            if (mesh.userData[field] !== region[field]) {
              throw new Error(`Mesh metadata mismatch: ${region.id}.${field}`);
            }
          }
          if (!mesh.material.isMeshStandardMaterial) {
            throw new Error(`Expected a standard glTF material: ${region.id}`);
          }
          originalMaterials.add(mesh.material);
          // Indirect indexing preserves the scientific source triangle order.
          mesh.geometry.boundsTree = new MeshBVH(mesh.geometry, { indirect: true });
          mesh.raycast = acceleratedRaycast;
          mesh.material = mesh.material.clone();
          this.sourceColors.set(mesh, mesh.material.color.clone());
          meshes.push(mesh);
        });
        if (!meshes.length) throw new Error(`Empty brain model layer: ${id}`);
      } catch (error) {
        disposeScene(scene);
        throw error;
      } finally {
        for (const material of originalMaterials) material.dispose();
      }
      const layer = { scene, meshes };
      scene.visible = false;
      this.group.add(scene);
      this.layers.set(id, layer);
      return layer;
    }).finally(() => this.pending.delete(id));
    this.pending.set(id, loading);
    return loading;
  }

  async setAtlas(id, onProgress) {
    const atlas = this.manifest.atlases.find(atlas => atlas.id === id);
    if (!atlas) throw new Error(`Unknown atlas: ${id}`);
    const request = ++this.requestNumber;
    await this.loadLayer(id, atlas.file, onProgress);
    if (request !== this.requestNumber) return;
    this.atlasId = id;
    this.isolatedId = null;
    this.select(null);
  }

  /**
   * Choose which segmentation of the internal anatomy is drawn.
   *
   * Exactly one level is ever visible: both describe the same anatomy, so
   * drawing them together would put two thalami in the same place. A selection
   * belonging to the level being left is dropped by `update`.
   */
  async setDetail(id, onProgress) {
    const level = this.manifest.detail_levels.find(level => level.id === id);
    if (!level) throw new Error(`Unknown detail level: ${id}`);
    const request = ++this.requestNumber;
    await this.loadLayer(id, level.file, onProgress);
    if (request !== this.requestNumber) return;
    this.detailId = id;
    this.update();
  }

  /** What the cut is doing, reported by the sections that own the plane. */
  setCutState({ atlas, active }) {
    if (atlas === this.cutAtlasId && active === this.cutActive) return;
    this.cutAtlasId = atlas;
    this.cutActive = active;
    this.update();
  }

  /**
   * The display settings, as a plain object. Cheap: it walks nothing.
   *
   * Kept separate from `state` because the visibility rule needs these, and
   * `state` reads visibleMeshCount -> visibleMeshes -> mesh.visible, which
   * would recurse through the value being computed.
   */
  get settings() {
    return {
      atlas: this.atlasId,
      detail: this.detailId,
      cutAtlas: this.cutAtlasId,
      cutActive: this.cutActive,
      hemisphere: this.hemisphere,
      cortexVisible: this.cortexVisible,
      cortexOpacity: this.cortexOpacity,
      atlasColors: this.atlasColors,
      isolatedRegion: this.isolatedId,
    };
  }

  get state() {
    return {
      ...this.settings,
      selectedRegion: this.regions.get(this.selectedId) ?? null,
      visibleMeshCount: this.visibleMeshes.length,
    };
  }

  get visibleMeshes() {
    return [...this.layers.values()]
      .filter(layer => layer.scene.visible)
      .flatMap(layer => layer.meshes.filter(mesh => mesh.visible));
  }

  update() {
    const settings = this.settings;
    for (const [id, layer] of this.layers) {
      layer.scene.visible = id === this.detailId || id === this.atlasId;
      for (const mesh of layer.meshes) {
        const region = this.regions.get(mesh.userData.region_id);
        const cortex = region.kind === 'cortex' || region.kind === 'non-region';
        mesh.visible = visibilityOf(region, settings).visible;
        const material = mesh.material;
        if (material.clippingPlanes !== this.clippingPlanes) {
          material.clippingPlanes = this.clippingPlanes;
          material.needsUpdate = true;
        }
        material.color.copy(this.sourceColors.get(mesh));
        if (!this.atlasColors) material.color.setHex(cortex ? 0xd6cfc2 : 0xc7beb0);
        if (region.kind === 'non-region') material.color.setHex(0xb0aca5);
        // Selection is drawn by the outline pass. Tinting the material would
        // alter a region's atlas colour, which is the datum being displayed.
        material.opacity = cortex ? this.cortexOpacity : 1;
        const transparent = material.opacity < 1;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.depthWrite = !transparent;
      }
    }
    const selected = this.selectedId ? this.regions.get(this.selectedId) : null;
    if (selected && !this.canSelect(selected)) {
      this.selectedId = null;
      this.dispatchEvent(new CustomEvent('selectionchange', { detail: null }));
    }
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  /** Raycaster must already be configured with the host camera and pointer. */
  intersect(raycaster) {
    this.group.updateMatrixWorld(true);
    const firstHitOnly = raycaster.firstHitOnly;
    let hits;
    try {
      if (this.clippingPlanes.length) raycaster.firstHitOnly = false;
      hits = raycaster.intersectObjects(this.visibleMeshes, false);
    } finally {
      raycaster.firstHitOnly = firstHitOnly;
    }
    return hits.find(hit => this.clippingPlanes.every(plane => plane.distanceToPoint(hit.point) >= -1e-9)) ?? null;
  }

  pick(raycaster) {
    const hit = this.intersect(raycaster);
    if (!hit || hit.object.userData.kind === 'non-region') return null;
    return this.regions.get(hit.object.userData.region_id);
  }

  setClippingPlanes(planes) {
    if (!Array.isArray(planes) || planes.some(plane => !plane.isPlane ||
        !Number.isFinite(plane.constant) || !plane.normal.toArray().every(Number.isFinite) || Math.abs(plane.normal.length() - 1) > 1e-6)) {
      throw new Error('Clipping requires normalized, finite Three.js planes.');
    }
    this.clippingPlanes = planes;
    this.update();
  }

  /**
   * Whether a region can be the selection right now.
   *
   * The shared rule answers it, because a region may be drawn as geometry, as
   * a cut label, or both, and `settings` now carries all three displays.
   *
   * `select` and `update` must ask the same question. Two answers would let a
   * selection be accepted and then dropped again on the same call, which is
   * silent by construction.
   */
  canSelect(region) {
    return visibilityOf(region, this.settings).visible;
  }

  select(id) {
    if (id !== null) {
      const region = this.regions.get(id);
      if (!region) throw new Error(`Unknown region: ${id}`);
      if (region.kind === 'non-region') throw new Error(`Cannot select a non-region: ${id}`);
      if (!this.canSelect(region)) throw new Error(`Region is not visible: ${id}`);
    }
    this.selectedId = id;
    this.update();
    this.dispatchEvent(new CustomEvent('selectionchange', { detail: this.state.selectedRegion }));
  }

  setHemisphere(hemisphere) {
    if (!['both', 'left', 'right'].includes(hemisphere)) {
      throw new Error(`Invalid hemisphere: ${hemisphere}`);
    }
    this.hemisphere = hemisphere;
    this.isolatedId = null;
    this.update();
  }

  setCortexVisible(visible) {
    if (typeof visible !== 'boolean') throw new TypeError('Cortex visibility must be boolean.');
    this.cortexVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  setCortexOpacity(opacity) {
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new RangeError('Cortex opacity must be between 0 and 1.');
    }
    this.cortexOpacity = opacity;
    this.update();
  }

  setAtlasColors(enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('Atlas colors must be boolean.');
    this.atlasColors = enabled;
    this.update();
  }

  isolate() {
    if (!this.selectedId) throw new Error('Select a region before isolating.');
    this.isolatedId = this.selectedId;
    this.update();
  }

  /** Release isolation on its own, leaving every other setting alone. */
  clearIsolation() {
    this.isolatedId = null;
    this.update();
  }

  reset() {
    this.clippingPlanes = [];
    this.hemisphere = 'both';
    this.cortexVisible = true;
    this.cortexOpacity = 1;
    this.atlasColors = true;
    this.isolatedId = null;
    this.select(null);
  }

  dispose() {
    this.disposed = true;
    this.requestNumber += 1;
    for (const layer of this.layers.values()) disposeScene(layer.scene);
    this.layers.clear();
    this.group.removeFromParent();
  }
}
