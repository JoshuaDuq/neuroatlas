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
  Vector2,
  Vector3,
} from 'three';
import {
  clippingPlane, rasToWorld, worldToRas, worldToVoxelMatrix,
} from '../slices/coordinates.js';
import { fetchPublished } from '../model/published-assets.js';
import { loadVolume } from '../slices/volume.js';
import { codeIndex, liftFor } from './highlight.js';
import { createPalette, labelVisible, usesAtlasColors, usesNetworkColors } from './palette.js';
import { createCutMaterial } from './shader.js';
import { SolidSections } from './solid-sections.js';
import {
  BANDS, addSolidSources, indexLabels, loadRibbonSources, loadSolidSources,
  loadStructureSources, loadSupplementalSources, paintSolids,
} from './solid-assets.js';
import { createWhiteMatter } from './white-matter.js';

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
    this.envelopes = [];
    this.details = new Map();
    this.detailsLoading = new Map();
    this.whiteMatter = null;
    this.solids = new SolidSections();
    this.group.add(this.solids.group);
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
    if (this.anatomyLoading) return this.anatomyLoading;
    if (this.anatomy) return;
    this.anatomyLoading = (async () => {
      await this.loadMetadata();
      const url = new URL('volumes.json', this.baseUrl);
      const response = await fetchPublished(url);
      if (!response.ok) throw new Error(`MRI metadata request failed: HTTP ${response.status}`);
      const metadata = await response.json();
      if (metadata.schema_version !== 1) throw new Error('Unsupported MRI schema.');
      const parcels = this.metadata.white_matter;
      const [volume, sources, parcelVolume, supplemental] = await Promise.all([
        loadVolume(metadata.mri, url),
        loadSolidSources(this.model.manifest, this.baseUrl),
        parcels ? loadVolume(parcels, this.baseUrl) : null,
        loadSupplementalSources(this.model.manifest, this.baseUrl),
      ]);
      if (this.disposed) {
        for (const source of [...sources, ...supplemental]) {
          source.geometry.dispose();
          source.material.dispose();
        }
        throw new Error('Tissue sections disposed during MRI loading.');
      }
      this.anatomy = this.createAnatomy(volume);
      this.whiteMatter = parcelVolume && createWhiteMatter(parcels, parcelVolume);
      this.envelopes = sources;
      addSolidSources(
        this.solids, sources, this.anatomy, this.model.manifest.appearance, BANDS.envelope,
        this.whiteMatter,
      );
      addSolidSources(this.solids, supplemental, this.anatomy,
        this.model.manifest.appearance, BANDS.structure);
    })().finally(() => { this.anatomyLoading = null; });
    return this.anatomyLoading;
  }

  hasDetail(detail) {
    return this.details.has(detail);
  }

  /** Cap the internal anatomy the viewer is showing; both levels segment the same. */
  async loadDetail(detail) {
    if (this.details.has(detail)) return;
    if (this.detailsLoading.has(detail)) return this.detailsLoading.get(detail);
    const pending = loadStructureSources(this.model.manifest, this.baseUrl, detail)
      .then(sources => {
        if (this.disposed) throw new Error('Tissue sections disposed during loading.');
        addSolidSources(
          this.solids, sources, this.anatomy, this.model.manifest.appearance, BANDS.structure,
        );
        this.details.set(detail, sources.length);
      })
      .finally(() => this.detailsLoading.delete(detail));
    this.detailsLoading.set(detail, pending);
    return pending;
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
    await this.loadDetail(this.model.state.detail);
    if (this.layers.has(atlas)) return;
    if (this.pending.has(atlas)) return this.pending.get(atlas);
    const metadata = this.metadata.atlases[atlas];
    if (!metadata) throw new Error(`Missing tissue atlas: ${atlas}`);
    const pending = Promise.all([
      loadVolume(metadata, this.baseUrl),
      loadRibbonSources(this.model.manifest, this.baseUrl, atlas, this.envelopes),
    ])
      .then(([volume, wedges]) => {
        if (this.disposed) throw new Error('Tissue sections disposed during loading.');
        const layer = this.createLayer(metadata, volume);
        addSolidSources(
          this.solids, wedges, this.anatomy, this.model.manifest.appearance, BANDS.ribbon,
        );
        layer.wedged = wedges.length > 0;
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
      // A sampled face is one mesh for every label, so it compares the
      // pointed-at and chosen codes rather than carrying a lift of its own.
      highlightCodes: { value: new Vector2(-1, -1) },
      highlightLifts: { value: new Vector2(0, 0) },
    };
    const material = createCutMaterial(uniforms, tissue);
    const mesh = new Mesh(new PlaneGeometry(0.5, 0.5), material);
    mesh.name = 'Native labelled tissue cut';
    mesh.visible = false;
    this.group.add(mesh);
    return {
      metadata, volume, texture, palette, mesh, uniforms, paletteKey: null,
      solidLabels: indexLabels(metadata.labels), codes: codeIndex(metadata.labels),
      wedged: false,
    };
  }

  update(frame, atlas, reverse = false) {
    const layer = this.layers.get(atlas);
    if (!layer) throw new Error(`Tissue atlas has not loaded: ${atlas}`);
    this.current = layer;
    this.frame = frame;
    const state = this.model.state;
    // A cut-only atlas has no surface to cut parcels out of, so its published
    // colours still have to come from the label volume and its 1 mm steps.
    const solid = layer.wedged || state.surfaceColor === 'tissue';
    const supplemental = this.solids.solids.some(entry => entry.source.userData.supplemental);
    this.solids.group.visible = solid || supplemental;
    this.whiteMatter?.update({ atlas, isolatedRegion: state.isolatedRegion });
    if (this.solids.group.visible) {
      paintSolids(this.solids, {
        labels: layer.solidLabels,
        state,
        atlas,
        detail: state.detail,
        wedged: layer.wedged,
        appearance: this.model.manifest.appearance,
        lookup: { regions: this.model.regions, networks: this.model.manifest.networks },
        whiteMatter: this.whiteMatter?.active ? this.whiteMatter : null,
      });
      if (!solid) {
        for (const entry of this.solids.solids) entry.visible &&= entry.source.userData.supplemental === true;
      }
      this.solids.update(clippingPlane(frame, reverse));
    }
    for (const candidate of this.layers.values()) {
      candidate.mesh.visible = candidate === layer && !solid;
    }
    const u = rasToWorld(frame.u.toArray()).normalize();
    const v = rasToWorld(frame.v.toArray()).normalize();
    const normal = new Vector3().crossVectors(u, v);
    layer.mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(u, v, normal));
    layer.mesh.position.copy(rasToWorld(frame.center.toArray()));
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
      state.internalSystem,
      state.detail,
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

  /**
   * Light the cut faces of the pointed-at and the chosen region.
   *
   * Off the state loop on purpose: a pointer answers this once a frame,
   * and a full render would rebuild every panel that often.
   */
  setHighlight(highlight = {}) {
    this.solids.highlight(highlight);
    this.whiteMatter?.setHighlight(highlight);
    for (const layer of this.layers.values()) {
      const code = region => layer.codes.get(region) ?? -1;
      layer.uniforms.highlightCodes.value.set(
        code(highlight.hovered), code(highlight.selected));
      layer.uniforms.highlightLifts.value.set(
        liftFor(highlight.hovered, highlight), liftFor(highlight.selected, highlight));
    }
  }

  /** CPU picking uses the exact same nearest-cell rule as the GPU shader. */
  intersect(raycaster) {
    if (!this.current) return null;
    this.group.updateMatrixWorld(true);
    const cap = this.solids.group.visible ? this.solids.intersect(raycaster) : null;
    const sampled = this.current.mesh.visible ? raycaster.intersectObject(this.current.mesh)[0] : null;
    const hit = cap ?? sampled;
    const solid = Boolean(cap);
    if (!hit) return null;
    // A cap was drawn from its own geometry, and only the atlas's own labels
    // are on the 1 mm grid: resampling it under a nucleus answers with
    // whatever the segmentation put there, which is a different detail
    // level's region entirely. What was drawn is what was pointed at.
    if (hit.region) return { ...hit, region: this.model.regions.get(hit.region) ?? null };
    const code = this.current.volume.nearest(worldToRas(hit.point));
    const label = this.current.metadata.labels[code];
    if (solid) {
      // The solid that was hit is the anatomy drawn there, and it is the one
      // the viewer is showing: resampling the label grid here could name a
      // region from a detail level that is not on screen, or a parcel across
      // the boundary the cap just drew.
      const parcel = this.whiteMatterAt(hit);
      const isolated = this.model.state.isolatedRegion;
      // While a parcel is isolated its cap discards every other parcel.
      if (parcel !== undefined && this.whiteMatter.holds(isolated) && parcel !== isolated) {
        return null;
      }
      const id = hit.source.userData.region_id ?? parcel ?? label?.region_id ?? null;
      return { ...hit, region: this.model.regions.get(id) ?? null, label };
    }
    if (!labelVisible(label, this.model.state, { regions: this.model.regions })) return null;
    return { ...hit, region: this.model.regions.get(label.region_id) ?? null, label };
  }

  /** The gyral white-matter parcel a white-envelope cap draws at a hit, if it samples one. */
  whiteMatterAt(hit) {
    if (hit.source.userData.boundary !== 'white' || !this.whiteMatter?.active) return undefined;
    return this.whiteMatter.regionAt(worldToRas(hit.point));
  }

  dispose() {
    this.disposed = true;
    this.solids.dispose();
    this.whiteMatter?.dispose();
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
