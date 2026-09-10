import { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function validateManifest(manifest) {
  if (manifest.schema_version !== 1 || !manifest.atlases?.length ||
      !Array.isArray(manifest.regions) || !manifest.structures?.file) {
    throw new Error('Invalid brain model manifest: expected schema version 1.');
  }
  const ids = new Set();
  for (const region of manifest.regions) {
    if (!region.id || ids.has(region.id) || !region.label ||
        !['left', 'right', 'midline'].includes(region.hemisphere) ||
        !['cortex', 'structure', 'non-region'].includes(region.kind)) {
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
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  scene.removeFromParent();
}

/** Asset-only controller. Add .group to your scene; coordinates remain untouched. */
export class BrainAtlas extends EventTarget {
  static async load(manifestUrl, atlasId) {
    const url = new URL(manifestUrl, globalThis.location.href);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    const loader = new GLTFLoader().setPath(new URL('.', url).href);
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
    this.hemisphere = 'both';
    this.cortexVisible = true;
    this.cortexOpacity = 1;
    this.atlasColors = false;
    this.sourceColors = new WeakMap();
    this.selectedId = null;
    this.isolatedId = null;
    this.requestNumber = 0;
    this.disposed = false;
  }

  async initialize(atlasId = this.manifest.atlases[0].id) {
    await this.loadLayer('structures', this.manifest.structures.file);
    await this.setAtlas(atlasId);
  }

  async loadLayer(id, file) {
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    if (this.layers.has(id)) return this.layers.get(id);
    if (this.pending.has(id)) return this.pending.get(id);
    const loading = this.loader.loadAsync(file).then(({ scene }) => {
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

  async setAtlas(id) {
    const atlas = this.manifest.atlases.find(atlas => atlas.id === id);
    if (!atlas) throw new Error(`Unknown atlas: ${id}`);
    const request = ++this.requestNumber;
    await this.loadLayer(id, atlas.file);
    if (request !== this.requestNumber) return;
    this.atlasId = id;
    this.isolatedId = null;
    this.select(null);
  }

  get state() {
    return {
      atlas: this.atlasId,
      hemisphere: this.hemisphere,
      cortexVisible: this.cortexVisible,
      cortexOpacity: this.cortexOpacity,
      atlasColors: this.atlasColors,
      selectedRegion: this.regions.get(this.selectedId) ?? null,
      isolatedRegion: this.isolatedId,
      visibleMeshCount: this.visibleMeshes.length,
    };
  }

  get visibleMeshes() {
    return [...this.layers.values()]
      .filter(layer => layer.scene.visible)
      .flatMap(layer => layer.meshes.filter(mesh => mesh.visible));
  }

  update() {
    for (const [id, layer] of this.layers) {
      layer.scene.visible = id === 'structures' || id === this.atlasId;
      for (const mesh of layer.meshes) {
        const region = this.regions.get(mesh.userData.region_id);
        const cortex = id !== 'structures';
        const hemisphereVisible = this.hemisphere === 'both' ||
          region.hemisphere === 'midline' || region.hemisphere === this.hemisphere;
        mesh.visible = hemisphereVisible &&
          (!cortex || (this.cortexVisible && this.cortexOpacity > 0)) &&
          (!this.isolatedId || region.id === this.isolatedId);
        const selected = region.id === this.selectedId;
        const material = mesh.material;
        material.color.copy(this.sourceColors.get(mesh));
        if (!this.atlasColors) material.color.setHex(cortex ? 0xd6cfc2 : 0xc7beb0);
        if (region.kind === 'non-region') material.color.setHex(0xb0aca5);
        material.emissive.setHex(selected ? 0x547879 : 0x000000);
        material.emissiveIntensity = selected ? 0.65 : 0;
        material.opacity = cortex ? this.cortexOpacity : 1;
        const transparent = material.opacity < 1;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.depthWrite = !transparent;
      }
    }
    if (this.selectedId && !this.visibleMeshes.some(mesh => mesh.userData.region_id === this.selectedId)) {
      this.selectedId = null;
      this.dispatchEvent(new CustomEvent('selectionchange', { detail: null }));
    }
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  /** Raycaster must already be configured with the host camera and pointer. */
  pick(raycaster) {
    this.group.updateMatrixWorld(true);
    const hit = raycaster.intersectObjects(this.visibleMeshes, false)[0];
    if (!hit || hit.object.userData.kind === 'non-region') return null;
    return this.regions.get(hit.object.userData.region_id);
  }

  select(id) {
    if (id !== null) {
      const region = this.regions.get(id);
      if (!region) throw new Error(`Unknown region: ${id}`);
      if (region.kind === 'non-region') throw new Error(`Cannot select a non-region: ${id}`);
      if (!this.visibleMeshes.some(mesh => mesh.userData.region_id === id)) {
        throw new Error(`Region is not visible: ${id}`);
      }
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

  reset() {
    this.hemisphere = 'both';
    this.cortexVisible = true;
    this.cortexOpacity = 1;
    this.atlasColors = false;
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
