import {
  Data3DTexture,
  DataTexture,
  DoubleSide,
  FloatType,
  GLSL3,
  Group,
  Matrix4,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RedIntegerFormat,
  RGBAFormat,
  ShaderMaterial,
  UnsignedShortType,
  Vector3,
} from 'three';
import { rasToWorld, worldToRas } from '../slices/coordinates.js';
import { loadVolume } from '../slices/volume.js';
import { createPalette, labelVisible } from './palette.js';
import { vertexShader, fragmentShader } from './shader.js';

/** One persistent GPU plane reads categorical tissue IDs from the native 3D grid. */
export class TissueSections {
  constructor(model, baseUrl) {
    this.model = model;
    this.baseUrl = baseUrl;
    this.group = new Group();
    this.group.name = 'GPU labelled tissue sections';
    this.layers = new Map();
    this.pending = new Map();
    this.metadata = null;
    this.metadataLoading = null;
    this.current = null;
    this.disposed = false;
    this.frame = null;
  }

  async loadMetadata() {
    if (this.metadata) return;
    if (this.metadataLoading) return this.metadataLoading;
    this.metadataLoading = (async () => {
      const response = await fetch(new URL('tissue-labels.json', this.baseUrl));
      if (!response.ok) throw new Error(`Tissue metadata request failed: HTTP ${response.status}`);
      const metadata = await response.json();
      if (metadata.schema_version !== 1) throw new Error('Unsupported tissue label schema.');
      this.metadata = metadata;
    })().finally(() => {
      this.metadataLoading = null;
    });
    return this.metadataLoading;
  }

  async load() {
    if (this.disposed) throw new Error('Tissue sections disposed.');
    await this.loadMetadata();
    const atlas = this.model.state.atlas;
    if (this.layers.has(atlas)) return;
    if (this.pending.has(atlas)) return this.pending.get(atlas);
    const metadata = this.metadata.atlases[atlas];
    if (!metadata) throw new Error(`Missing tissue atlas: ${atlas}`);
    const pending = loadVolume(metadata, this.baseUrl)
      .then((volume) => {
        if (this.disposed) throw new Error('Tissue sections disposed during loading.');
        const layer = this.createLayer(metadata, volume);
        this.layers.set(atlas, layer);
      })
      .finally(() => this.pending.delete(atlas));
    this.pending.set(atlas, pending);
    return pending;
  }

  createLayer(metadata, volume) {
    const texture = new Data3DTexture(volume.data, ...volume.shape);
    texture.format = RedIntegerFormat;
    texture.type = UnsignedShortType;
    texture.internalFormat = 'R16UI';
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    const palette = new DataTexture(
      new Float32Array(metadata.labels.length * 4),
      metadata.labels.length,
      1,
      RGBAFormat,
      FloatType,
    );
    palette.needsUpdate = true;
    const worldToRas = new Matrix4().set(1000, 0, 0, 0, 0, 0, -1000, 0, 0, 1000, 0, 0, 0, 0, 0, 1);
    const worldToVoxel = new Matrix4().fromArray(volume.inverse).multiply(worldToRas);
    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      uniforms: {
        labelVolume: { value: texture },
        labelPalette: { value: palette },
        worldToVoxel: { value: worldToVoxel },
        volumeShape: { value: new Vector3(...volume.shape) },
      },
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new Mesh(new PlaneGeometry(0.5, 0.5), material);
    mesh.name = 'Native labelled tissue cut';
    mesh.visible = false;
    this.group.add(mesh);
    return { metadata, volume, texture, palette, mesh, paletteKey: null };
  }

  update(frame) {
    const layer = this.layers.get(this.model.state.atlas);
    if (!layer) throw new Error('Current tissue atlas has not loaded.');
    this.current = layer;
    this.frame = frame;
    for (const candidate of this.layers.values()) candidate.mesh.visible = candidate === layer;
    const u = rasToWorld(frame.u.toArray()).normalize();
    const v = rasToWorld(frame.v.toArray()).normalize();
    const normal = new Vector3().crossVectors(u, v);
    layer.mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(u, v, normal));
    layer.mesh.position.copy(rasToWorld(frame.center.toArray()));
    const state = this.model.state;
    const key = JSON.stringify([
      state.atlasColors,
      state.hemisphere,
      state.cortexVisible,
      state.cortexOpacity,
      state.isolatedRegion,
    ]);
    if (key !== layer.paletteKey) {
      layer.palette.image.data = createPalette(layer.metadata.labels, state);
      layer.palette.needsUpdate = true;
      layer.paletteKey = key;
    }
    return true;
  }

  /** CPU picking uses the exact same nearest-cell rule as the GPU shader. */
  intersect(raycaster) {
    if (!this.current) return null;
    this.group.updateMatrixWorld(true);
    const hit = raycaster.intersectObject(this.current.mesh)[0];
    if (!hit) return null;
    const code = this.current.volume.nearest(worldToRas(hit.point));
    const label = this.current.metadata.labels[code];
    if (!labelVisible(label, this.model.state)) return null;
    return { ...hit, region: this.model.regions.get(label.region_id) ?? null, label };
  }

  dispose() {
    this.disposed = true;
    for (const layer of this.layers.values()) {
      layer.texture.dispose();
      layer.palette.dispose();
      layer.mesh.geometry.dispose();
      layer.mesh.material.dispose();
    }
    this.layers.clear();
    this.group.removeFromParent();
  }
}
