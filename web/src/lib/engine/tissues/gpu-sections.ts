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
import type { Color, Intersection, IUniform, Material, Plane, Raycaster } from 'three';
import type { Region } from '../../types/index.ts';
import type { Frame } from '../slices/coordinates.ts';
import {
  clippingPlane,
  rasToWorld,
  worldToRas,
  worldToVoxelMatrix,
} from '../slices/coordinates.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import { loadVolume } from '../slices/volume.ts';
import type { Volume, VolumeFile } from '../slices/volume.ts';
import { codeIndex, liftFor } from './highlight.ts';
import {
  createPalette,
  labelVisible,
  usesAtlasColors,
  usesCabNpColors,
  usesFunctionalColors,
  usesNetworkColors,
  usesPaint,
} from './palette.ts';
import type { Label, PaletteLookup, PaletteState } from './palette.ts';
import { createCutMaterial } from './shader.ts';
import { SolidSections } from './solid-sections.ts';
import type { SolidHit } from './solid-sections.ts';
import {
  BANDS,
  addSolidSources,
  enclosingFirst,
  indexLabels,
  paintSolids,
  solidSource,
} from './solid-assets.ts';
import type { LabelIndex } from './solid-assets.ts';
import { createWhiteMatter } from './white-matter.ts';
import type { WhiteMatter, WhiteMatterRecord } from './white-matter.ts';
import {
  addMriAppearance,
  createMriUniforms,
  setMriHighlight,
  setMriWindow,
} from '../render/mri-material.ts';
import type { MriUniforms } from '../render/mri-material.ts';
import type { Appearance } from '../render/materials.ts';
import { token } from '../render/tokens.ts';
import { createCapLabels, updateCapLabels } from './cap-labels.ts';
import type { CapLabelUniforms } from './cap-labels.ts';

/** `volumes.json`: the MRI and segmentation records, their labels and the default MRI window. */
export interface VolumeMetadata {
  schema_version: number;
  mri: VolumeFile;
  segmentation: VolumeFile;
  labels: Readonly<Record<number, { name: string; color: readonly number[] }>>;
  display: {
    field_of_view_mm: number;
    texture_size: number;
    window_center: number;
    window_width: number;
  };
}

/** One atlas's published label volume and its label table (`tissue-labels.json`). */
export interface TissueAtlasRecord extends VolumeFile {
  labels: readonly Label[];
}

export interface TissueMetadata {
  schema_version: number;
  atlases: Readonly<Record<string, TissueAtlasRecord>>;
  white_matter?: WhiteMatterRecord & VolumeFile;
}

export interface Highlight {
  hovered?: string | null;
  selected?: string | null;
}

/** The registered MRI the cut materials sample. */
export interface Anatomy {
  texture: Data3DTexture;
  volume: Volume;
  worldToVoxel: Matrix4;
  mriUniforms: MriUniforms;
  capLabels: CapLabelUniforms;
}

/** One loaded cut atlas: its label grid on the GPU and the plane that samples it. */
export interface TissueLayer {
  metadata: TissueAtlasRecord;
  volume: Volume;
  texture: Data3DTexture;
  palette: DataTexture;
  mesh: Mesh<PlaneGeometry, Material>;
  uniforms: {
    labelVolume: IUniform<Data3DTexture>;
    labelPalette: IUniform<DataTexture>;
    worldToVoxel: IUniform<Matrix4>;
    volumeShape: IUniform<Vector3>;
    mriVolume: IUniform<Data3DTexture>;
    worldToMri: IUniform<Matrix4>;
    mriShape: IUniform<Vector3>;
    t1Range: IUniform<number[]>;
    tissueVariation: IUniform<number>;
    highlightCodes: IUniform<Vector2>;
    highlightLifts: IUniform<Vector2>;
  };
  paletteKey: string | null;
  solidLabels: LabelIndex;
  codes: Map<string, number>;
  wedged: boolean;
}

/**
 * The part of the model (`BrainAtlas`, legacy `model/brain-atlas.js`) that the
 * cut reads and drives; the model itself belongs to another chunk.
 */
export interface CutModel extends EventTarget {
  readonly manifest: {
    appearance: Appearance;
    networks?: PaletteLookup['networks'];
    supplemental_layers?: { id: string; bounds_ras_mm?: readonly (readonly number[])[] }[];
  };
  readonly regions: ReadonlyMap<string, Region>;
  readonly cabNp: PaletteLookup['cabNp'] | null;
  readonly functionalRegions: PaletteLookup['functional'] | null;
  readonly layers: ReadonlyMap<string, { meshes: Mesh[] }>;
  readonly sourceColors: ReadonlyMap<Mesh, Color>;
  readonly state: PaletteState;
  readonly clippingPlanes: readonly Plane[];
  ensureEnvelopes(): Promise<Mesh[]>;
  ensureSpinalCord(): Promise<unknown>;
  ensureRibbonWedges(atlas: string, baseUrl: string | URL): Promise<Mesh[]>;
  loadGlassSolids(baseUrl: string | URL): Promise<unknown>;
  setClippingPlanes(planes: Plane[]): void;
  setCutState(state: { atlas: string; active: boolean }): void;
  setMriAnatomy(anatomy: Anatomy | null): void;
  setSurfaceColor(mode: string): void;
  intersect(raycaster: Raycaster): (Intersection & { region?: Region | null }) | null;
}

/** A cut hit with the region it names and the label it landed on. */
export type CutHit = (Intersection | SolidHit) & { region?: Region | null; label?: Label };

const readJson = async <T>(url: URL): Promise<T> =>
  JSON.parse(new TextDecoder().decode(await fetchAsset(url))) as T;

const _poseU = new Vector3();
const _poseV = new Vector3();
const _poseN = new Vector3();
const _poseBasis = new Matrix4();

/** The sampled label plane is hidden while solids draw the cut, so a drag skips this. */
function poseLabelPlane(mesh: Mesh, frame: Frame): void {
  _poseU.copy(rasToWorld(frame.u.toArray())).normalize();
  _poseV.copy(rasToWorld(frame.v.toArray())).normalize();
  _poseN.crossVectors(_poseU, _poseV);
  mesh.quaternion.setFromRotationMatrix(_poseBasis.makeBasis(_poseU, _poseV, _poseN));
  mesh.position.copy(rasToWorld(frame.center.toArray()));
}

/** One persistent GPU plane reads categorical tissue IDs from the native 3D grid. */
export class TissueSections {
  readonly group = new Group();
  readonly layers = new Map<string, TissueLayer>();
  readonly solids = new SolidSections();
  anatomy: Anatomy | null = null;
  solidsReady = false;
  private readonly pending = new Map<string, Promise<void>>();
  private metadata: TissueMetadata | null = null;
  private metadataLoading: Promise<void> | null = null;
  private volumeMetadata: VolumeMetadata | null = null;
  private volumeMetadataLoading: Promise<VolumeMetadata> | null = null;
  private current: TissueLayer | null = null;
  private disposed = false;
  private mriLoading: Promise<Anatomy> | null = null;
  private solidsLoading: Promise<void> | null = null;
  private readonly details = new Map<string, number>();
  private whiteMatter: WhiteMatter | null = null;
  private paintKey: string | undefined;

  private readonly model: CutModel;
  private readonly baseUrl: string | URL;

  constructor(model: CutModel, baseUrl: string | URL) {
    this.model = model;
    this.baseUrl = baseUrl;
    this.group.name = 'GPU labelled tissue sections';
    this.group.add(this.solids.group);
  }

  /** What a cut label's colour is looked up in: its region and each published network palette. */
  get paletteLookup(): PaletteLookup {
    const { regions, manifest, cabNp, functionalRegions } = this.model;
    return {
      regions,
      networks: manifest.networks,
      ...(cabNp && { cabNp }),
      ...(functionalRegions && { functional: functionalRegions }),
    };
  }

  async loadMetadata(): Promise<void> {
    if (this.metadata) return;
    if (this.metadataLoading) return this.metadataLoading;
    this.metadataLoading = (async () => {
      const metadata = await readJson<TissueMetadata>(new URL('tissue-labels.json', this.baseUrl));
      if (metadata.schema_version !== 1) throw new Error('Unsupported tissue label schema.');
      this.metadata = metadata;
    })().finally(() => {
      this.metadataLoading = null;
    });
    return this.metadataLoading;
  }

  /** `volumes.json`: the MRI and segmentation headers and the default MRI window. */
  async loadVolumeMetadata(): Promise<VolumeMetadata> {
    if (this.volumeMetadata) return this.volumeMetadata;
    if (this.volumeMetadataLoading) return this.volumeMetadataLoading;
    this.volumeMetadataLoading = (async () => {
      const metadata = await readJson<VolumeMetadata>(new URL('volumes.json', this.baseUrl));
      if (metadata.schema_version !== 1) throw new Error('Unsupported MRI schema.');
      this.volumeMetadata = metadata;
      return metadata;
    })().finally(() => {
      this.volumeMetadataLoading = null;
    });
    return this.volumeMetadataLoading;
  }

  /**
   * The native T1 on the GPU. MRI surface colour needs nothing more, and the
   * linked MRI views read the same volume rather than downloading it again.
   */
  async loadMri(): Promise<Anatomy> {
    if (this.anatomy) return this.anatomy;
    if (this.mriLoading) return this.mriLoading;
    this.mriLoading = (async () => {
      const metadata = await this.loadVolumeMetadata();
      const volume = await loadVolume(metadata.mri, new URL('volumes.json', this.baseUrl));
      if (this.disposed) throw new Error('Tissue sections disposed during MRI loading.');
      this.anatomy = this.createAnatomy(volume);
      this.setWindow(metadata.display.window_center, metadata.display.window_width);
      return this.anatomy;
    })().finally(() => {
      this.mriLoading = null;
    });
    return this.mriLoading;
  }

  /**
   * The MRI, the tissue envelopes every cut caps and the cord, built from the
   * model's own meshes; the first cut is what downloads the envelopes and cord
   * when nothing has yet.
   */
  async loadAnatomy(): Promise<void> {
    if (this.solidsReady) return;
    if (this.solidsLoading) return this.solidsLoading;
    this.solidsLoading = (async () => {
      await this.loadMetadata();
      const parcels = this.metadata!.white_matter;
      const cord = this.model.manifest.supplemental_layers?.some(
        (layer) => layer.id === 'zanatomy',
      );
      const [, envelopes, parcelVolume] = await Promise.all([
        this.loadMri(),
        this.model.ensureEnvelopes(),
        parcels ? loadVolume(parcels, this.baseUrl) : null,
        cord ? this.model.ensureSpinalCord() : null,
      ]);
      if (this.disposed) throw new Error('Tissue sections disposed during MRI loading.');
      const anatomy = this.anatomy!;
      this.whiteMatter = parcelVolume && parcels ? createWhiteMatter(parcels, parcelVolume) : null;
      addSolidSources(
        this.solids,
        envelopes.map((mesh) => solidSource(mesh)),
        anatomy,
        this.model.manifest.appearance,
        BANDS.envelope,
        this.whiteMatter,
      );
      if (cord) {
        const meshes = this.model.manifest.supplemental_layers!.flatMap(
          (layer) => this.model.layers.get(layer.id)!.meshes,
        );
        const sources = enclosingFirst(
          meshes.map((mesh) =>
            solidSource(mesh, { ...mesh.userData }, this.model.sourceColors.get(mesh)),
          ),
        );
        addSolidSources(
          this.solids,
          sources,
          anatomy,
          this.model.manifest.appearance,
          BANDS.structure,
        );
      }
      this.solidsReady = true;
    })().finally(() => {
      this.solidsLoading = null;
    });
    return this.solidsLoading;
  }

  /** Whether the cut caps the detail level the model now shows. */
  hasDetail(detail: string): boolean {
    return this.details.has(detail);
  }

  /** Cap the internal anatomy the viewer is showing; both levels segment the same. */
  addDetail(detail: string): void {
    if (this.details.has(detail)) return;
    const layer = this.model.layers.get(detail);
    if (!layer) throw new Error(`Detail level has not loaded: ${detail}`);
    const sources = enclosingFirst(
      layer.meshes.map((mesh) =>
        solidSource(mesh, { ...mesh.userData, detail }, this.model.sourceColors.get(mesh)),
      ),
    );
    addSolidSources(
      this.solids,
      sources,
      this.anatomy!,
      this.model.manifest.appearance,
      BANDS.structure,
    );
    this.details.set(detail, sources.length);
  }

  createAnatomy(volume: Volume): Anatomy {
    if (!(volume.data instanceof Uint8Array)) throw new Error('Expected native uint8 MRI.');
    const texture = new Data3DTexture(volume.data, ...volume.shape);
    texture.format = RedFormat;
    texture.type = UnsignedByteType;
    texture.internalFormat = 'R8';
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    const worldToVoxel = worldToVoxelMatrix(volume);
    const anatomy = {
      texture,
      volume,
      worldToVoxel,
      mriUniforms: createMriUniforms({ texture, worldToVoxel, volume }),
      capLabels: createCapLabels(),
    };
    this.markWith(anatomy.mriUniforms);
    return anatomy;
  }

  /**
   * Which colour marks a pointed-at or chosen cut face.
   *
   * The scan is achromatic, so the mark is the theme's one accent rather than
   * a lift toward white, which bright tissue would drown. Called again when
   * the theme changes, because the two palettes name different accents.
   */
  markWith(uniforms: MriUniforms | undefined = this.anatomy?.mriUniforms): void {
    const accent = token('--accent');
    if (uniforms && accent) setMriHighlight(uniforms, accent);
  }

  setWindow(center: number, width: number): void {
    if (this.anatomy) setMriWindow(this.anatomy.mriUniforms, center, width);
  }

  /** Load one named label volume. The caller owns which atlas the cut samples. */
  async load(atlas: string): Promise<void> {
    if (this.disposed) throw new Error('Tissue sections disposed.');
    await Promise.all([this.loadMetadata(), this.loadAnatomy()]);
    this.addDetail(this.model.state.detail);
    if (this.layers.has(atlas)) return;
    const loading = this.pending.get(atlas);
    if (loading) return loading;
    const metadata = this.metadata!.atlases[atlas];
    if (!metadata) throw new Error(`Missing tissue atlas: ${atlas}`);
    const pending = Promise.all([
      loadVolume(metadata, this.baseUrl),
      this.model.ensureRibbonWedges(atlas, this.baseUrl),
    ])
      .then(([volume, wedges]) => {
        if (this.disposed) throw new Error('Tissue sections disposed during loading.');
        const layer = this.createLayer(metadata, volume);
        addSolidSources(
          this.solids,
          wedges.map((wedge) => solidSource(wedge)),
          this.anatomy!,
          this.model.manifest.appearance,
          BANDS.ribbon,
        );
        layer.wedged = wedges.length > 0;
        this.layers.set(atlas, layer);
      })
      .finally(() => this.pending.delete(atlas));
    this.pending.set(atlas, pending);
    return pending;
  }

  createLayer(metadata: TissueAtlasRecord, volume: Volume): TissueLayer {
    if (!this.anatomy) throw new Error('MRI must load before creating tissue sections.');
    if (!(volume.data instanceof Uint16Array)) throw new Error('Expected uint16 tissue labels.');
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
    const uniforms: TissueLayer['uniforms'] = {
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
    addMriAppearance(material, this.anatomy.mriUniforms, 'lift');
    const mesh = new Mesh(new PlaneGeometry(0.5, 0.5), material);
    mesh.name = 'Native labelled tissue cut';
    mesh.visible = false;
    this.group.add(mesh);
    return {
      metadata,
      volume,
      texture,
      palette,
      mesh,
      uniforms,
      paletteKey: null,
      solidLabels: indexLabels(metadata.labels),
      codes: codeIndex(metadata.labels),
      wedged: false,
    };
  }

  update(frame: Frame, atlas: string, reverse = false): true {
    const layer = this.layers.get(atlas);
    if (!layer) throw new Error(`Tissue atlas has not loaded: ${atlas}`);
    this.current = layer;
    const state = this.model.state;
    const anatomy = this.anatomy!;
    // A cut-only atlas has no surface to cut parcels out of, so its published
    // colours still have to come from the label volume.
    const mri = state.surfaceColor === 'mri' && !usesPaint(state);
    anatomy.mriUniforms.scanEnabled.value = mri;
    updateCapLabels(anatomy.capLabels, layer, state);
    const solid = layer.wedged || state.surfaceColor === 'tissue' || mri;
    const supplemental = this.solids.solids.some((entry) => entry.source.userData['supplemental']);
    this.solids.group.visible = solid || supplemental;
    this.whiteMatter?.update({
      atlas,
      isolatedRegion: state.isolatedRegion,
      hiddenRegions: state.hiddenRegions,
    });
    if (this.solids.group.visible) {
      // Colour does not depend on where the plane sits. A drag only moves the
      // plane, and repainting every solid there is work the frame cannot spare.
      const constituents = state.internalConstituents
        ? [...state.internalConstituents].sort().join(',')
        : '';
      const paintKey = [
        state.surfaceColor,
        state.functionalLevel,
        state.paint?.id,
        state.atlas,
        state.hemisphere,
        state.cortexVisible,
        state.cortexOpacity,
        state.isolatedRegion,
        state.internalVisible,
        state.internalSystem,
        state.spinalCordVisible,
        state.detail,
        state.cutAtlas,
        state.cutActive,
        constituents,
        atlas,
        layer.wedged,
        this.whiteMatter?.active ?? false,
        [...(state.hiddenRegions ?? [])].sort().join(','),
      ].join('|');
      if (paintKey !== this.paintKey) {
        this.paintKey = paintKey;
        paintSolids(this.solids as unknown as Parameters<typeof paintSolids>[0], {
          labels: layer.solidLabels,
          state,
          atlas,
          detail: state.detail,
          wedged: layer.wedged,
          appearance: this.model.manifest.appearance,
          lookup: this.paletteLookup,
          whiteMatter: this.whiteMatter?.active ? this.whiteMatter : null,
        });
      }
      if (!solid) {
        for (const entry of this.solids.solids)
          entry.visible &&= entry.source.userData['supplemental'] === true;
      }
      this.solids.update(clippingPlane(frame, reverse));
    }
    for (const candidate of this.layers.values()) {
      candidate.mesh.visible = candidate === layer && !solid;
    }
    if (!solid) poseLabelPlane(layer.mesh, frame);
    // Only tissue colour carries the T1 brightness it was tuned against; under
    // a published palette — atlas or network — that modulation would distort
    // the datum, and the cut would no longer match its key.
    const published =
      usesAtlasColors(state) ||
      usesNetworkColors(state) ||
      usesCabNpColors(state) ||
      usesFunctionalColors(state) ||
      usesPaint(state);
    layer.uniforms.tissueVariation.value = published
      ? 0
      : this.model.manifest.appearance.intensity.cut_strength;
    const key = JSON.stringify([
      state.surfaceColor,
      state.functionalLevel,
      state.paint?.id ?? null,
      state.hemisphere,
      state.cortexVisible,
      state.cortexOpacity,
      state.isolatedRegion,
      state.internalSystem,
      state.detail,
      [...(state.hiddenRegions ?? [])].sort(),
    ]);
    if (key !== layer.paletteKey) {
      layer.palette.image.data = createPalette(
        layer.metadata.labels,
        state,
        this.model.manifest.appearance.tissue,
        this.paletteLookup,
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
  setHighlight(highlight: Highlight = {}): void {
    this.solids.highlight(highlight);
    this.whiteMatter?.setHighlight(highlight);
    for (const layer of this.layers.values()) {
      const code = (region: string | null | undefined) =>
        (region == null ? undefined : layer.codes.get(region)) ?? -1;
      layer.uniforms.highlightCodes.value.set(code(highlight.hovered), code(highlight.selected));
      layer.uniforms.highlightLifts.value.set(
        liftFor(highlight.hovered, highlight),
        liftFor(highlight.selected, highlight),
      );
    }
  }

  /** CPU picking uses the label rule the GPU shader draws with. */
  capVisibleAt(hit: SolidHit): boolean {
    const state = this.model.state;
    const parcel = this.whiteMatterAt(hit);
    if (parcel != null && state.hiddenRegions?.has(parcel)) return false;
    if (
      parcel !== undefined &&
      state.isolatedRegion !== null &&
      this.whiteMatter!.holds(state.isolatedRegion) &&
      parcel !== state.isolatedRegion
    )
      return false;
    if (!((hit.object as Mesh).material as Material).userData.sampledLabels.value) return true;
    const code = this.current!.volume.label(worldToRas(hit.point));
    const label = this.current!.metadata.labels[code];
    return (
      (code === 0 && !state.isolatedRegion) ||
      Boolean(label && labelVisible(label, state, { regions: this.model.regions }))
    );
  }

  intersect(raycaster: Raycaster): CutHit | null {
    if (!this.current) return null;
    this.group.updateMatrixWorld(true);
    const cap = this.solids.group.visible
      ? this.solids.intersect(raycaster, (hit) => this.capVisibleAt(hit))
      : null;
    const sampled = this.current.mesh.visible
      ? raycaster.intersectObject(this.current.mesh)[0]
      : null;
    const hit = cap ?? sampled;
    const solid = Boolean(cap);
    if (!hit) return null;
    if (cap && ((cap.object as Mesh).material as Material).userData.sampledLabels.value) {
      const code = this.current.volume.label(worldToRas(hit.point));
      const label = this.current.metadata.labels[code];
      const visible =
        label && labelVisible(label, this.model.state, { regions: this.model.regions });
      return {
        ...hit,
        region: visible ? (this.model.regions.get(label.region_id!) ?? null) : null,
        label,
      };
    }
    // A cap was drawn from its own geometry, and only the atlas's own labels
    // are on the 1 mm grid: resampling it under a nucleus answers with
    // whatever the segmentation put there, which is a different detail
    // level's region entirely. What was drawn is what was pointed at.
    if (cap?.region) return { ...hit, region: this.model.regions.get(cap.region) ?? null };
    const code = this.current.volume.label(worldToRas(hit.point));
    const label = this.current.metadata.labels[code];
    if (solid) {
      // The solid that was hit is the anatomy drawn there, and it is the one
      // the viewer is showing: resampling the label grid here could name a
      // region from a detail level that is not on screen, or a parcel across
      // the boundary the cap just drew.
      const parcel = this.whiteMatterAt(cap!);
      const id = cap!.source.userData['region_id'] ?? parcel ?? label?.region_id ?? null;
      return { ...hit, region: this.model.regions.get(id) ?? null, label };
    }
    if (!label || !labelVisible(label, this.model.state, { regions: this.model.regions }))
      return null;
    return { ...hit, region: this.model.regions.get(label.region_id!) ?? null, label };
  }

  /** The gyral white-matter parcel a white-envelope cap draws at a hit, if it samples one. */
  whiteMatterAt(hit: SolidHit): string | null | undefined {
    if (hit.source.userData['boundary'] !== 'white' || !this.whiteMatter?.active) return undefined;
    return this.whiteMatter.regionAt(new Vector3(...worldToRas(hit.point)));
  }

  dispose(): void {
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
