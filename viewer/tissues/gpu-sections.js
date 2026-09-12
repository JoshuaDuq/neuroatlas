import {
  Data3DTexture,
  DataTexture,
  FloatType,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  RedIntegerFormat,
  RGBAFormat,
  UnsignedByteType,
  UnsignedShortType,
  Vector3,
} from 'three';
import { rasToWorld, worldToRas } from '../slices/coordinates.js';
import { fetchPublished } from '../model/published-assets.js';
import { loadVolume } from '../slices/volume.js';
import { createPalette, labelVisible, usesAtlasColors, usesNetworkColors } from './palette.js';
import { createCutMaterial } from './shader.js';

function worldToVoxelMatrix(volume) {
  const worldToSource = new Matrix4().set(
    1000, 0, 0, 0, 0, 0, -1000, 0, 0, 1000, 0, 0, 0, 0, 0, 1,
  );
  return new Matrix4().fromArray(volume.inverse).multiply(worldToSource);
}

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
    this.anatomy = null;
    this.anatomyLoading = null;
  }

  async loadMetadata() {
    if (this.metadata) return;
    if (this.metadataLoading) return this.metadataLoading;
    this.metadataLoading = (async () => {
      const response = await fetchPublished(new URL('tissue-labels.json', this.baseUrl));
      if (!response.ok) throw new Error(`Tissue metadata request failed: HTTP ${response.status}`);
      const metadata = await response.json();
      if (metadata.schema_version !== 1) throw new Error('Unsupported tissue label schema.');
      this.metadata = metadata;
    })().finally(() => {
      this.metadataLoading = null;
    });
    return this.metadataLoading;
  }

  async loadAnatomy() {
    if (this.anatomy) return;
    if (this.anatomyLoading) return this.anatomyLoading;
    this.anatomyLoading = (async () => {
      const url = new URL('volumes.json', this.baseUrl);
      const response = await fetchPublished(url);
      if (!response.ok) throw new Error(`MRI metadata request failed: HTTP ${response.status}`);
      const metadata = await response.json();
      if (metadata.schema_version !== 1) throw new Error('Unsupported MRI schema.');
      const volume = await loadVolume(metadata.mri, url);
      if (this.disposed) throw new Error('Tissue sections disposed during MRI loading.');
      this.anatomy = this.createAnatomy(volume);
    })().finally(() => { this.anatomyLoading = null; });
    return this.anatomyLoading;
  }

  createAnatomy(volume) {
    if (!(volume.data instanceof Uint8Array)) throw new Error('Expected native uint8 MRI.');
    const texture = new Data3DTexture(volume.data, ...volume.shape);
    texture.format = RedFormat;
    texture.type = UnsignedByteType;
    texture.internalFormat = 'R8';
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return { texture, volume, worldToVoxel: worldToVoxelMatrix(volume) };
  }

  /** Load one named label volume. The caller owns which atlas the cut samples. */
  async load(atlas) {
    if (this.disposed) throw new Error('Tissue sections disposed.');
    await Promise.all([this.loadMetadata(), this.loadAnatomy()]);
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
    if (!this.anatomy) throw new Error('MRI must load before creating tissue sections.');
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
    const { intensity, tissue } = this.model.manifest.appearance;
    const uniforms = {
      labelVolume: { value: texture },
      labelPalette: { value: palette },
      worldToVoxel: { value: worldToVoxelMatrix(volume) },
      volumeShape: { value: new Vector3(...volume.shape) },
      mriVolume: { value: this.anatomy.texture },
      worldToMri: { value: this.anatomy.worldToVoxel },
      mriShape: { value: new Vector3(...this.anatomy.volume.shape) },
      t1Range: { value: [intensity.low, intensity.high] },
      tissueVariation: { value: intensity.cut_strength },
    };
    const material = createCutMaterial(uniforms, tissue);
    const mesh = new Mesh(new PlaneGeometry(0.5, 0.5), material);
    mesh.name = 'Native labelled tissue cut';
    mesh.visible = false;
    this.group.add(mesh);
    return { metadata, volume, texture, palette, mesh, uniforms, paletteKey: null };
  }

  update(frame, atlas) {
    const layer = this.layers.get(atlas);
    if (!layer) throw new Error(`Tissue atlas has not loaded: ${atlas}`);
    this.current = layer;
    this.frame = frame;
    for (const candidate of this.layers.values()) candidate.mesh.visible = candidate === layer;
    const u = rasToWorld(frame.u.toArray()).normalize();
    const v = rasToWorld(frame.v.toArray()).normalize();
    const normal = new Vector3().crossVectors(u, v);
    layer.mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(u, v, normal));
    layer.mesh.position.copy(rasToWorld(frame.center.toArray()));
    const state = this.model.state;
    // Only tissue colour carries the T1 brightness it was tuned against; under
    // a published palette — atlas or network — that modulation would distort
    // the datum, and the cut would no longer match its key.
    const published = usesAtlasColors(state) || usesNetworkColors(state);
    layer.uniforms.tissueVariation.value = published
      ? 0 : this.model.manifest.appearance.intensity.cut_strength;
    const key = JSON.stringify([
      state.surfaceColor,
      state.hemisphere,
      state.cortexVisible,
      state.cortexOpacity,
      state.isolatedRegion,
    ]);
    if (key !== layer.paletteKey) {
      layer.palette.image.data = createPalette(
        layer.metadata.labels, state, this.model.manifest.appearance.tissue,
        { regions: this.model.regions, networks: this.model.manifest.networks },
      );
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
    this.anatomy?.texture.dispose();
    this.anatomy = null;
    this.layers.clear();
    this.group.removeFromParent();
  }
}
