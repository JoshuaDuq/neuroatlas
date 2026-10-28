import { Box3, Group, SRGBColorSpace, Vector3 } from 'three';
import type {
  BufferGeometry,
  Color,
  DataTexture,
  Intersection,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Ray,
  Raycaster,
  Texture,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HEMISPHERES, SURFACE_COLORS } from '../../types/index.ts';
import type {
  DisplaySettings,
  Hemisphere,
  Manifest,
  ManifestAppearance,
  ModelState,
  Paint,
  Region,
  SurfaceColor,
} from '../../types/index.ts';
import { labelOf } from '../../core/catalog/labels.ts';
import { validateCabNp } from '../../core/catalog/networks.ts';
import type { CabNpPartition } from '../../core/catalog/networks.ts';
import { validateFunctionalRegions } from '../../core/catalog/functional-regions.ts';
import type { FunctionalRegions } from '../../core/catalog/functional-regions.ts';
import { validateNeuropsychDomains } from '../../core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains, NeurosynthTerms } from '../../core/catalog/neuropsych-domains.ts';
import { validateBoundaryCertainty } from '../../core/catalog/boundary-certainty.ts';
import type { BoundaryCertainty } from '../../core/catalog/boundary-certainty.ts';
import { validateReceptorFingerprints } from '../../core/catalog/receptor-fingerprints.ts';
import type { ReceptorFingerprints } from '../../core/catalog/receptor-fingerprints.ts';
import { belongsToDetail, visibilityOf } from '../../core/catalog/visibility.ts';
import { createDissection } from '../../core/state/dissection.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import { tissueColor, createAnatomicalMaterial } from '../render/materials.ts';
import type { Appearance, AnatomicalUserData } from '../render/materials.ts';
import { attachNetworkColors, attachTerritoryColors } from '../render/network-colors.ts';
import type { NetworkMetadata } from '../render/network-colors.ts';
import {
  addBorderFeather,
  createFeatherPalette,
  featherBorders,
  writeFeatherPalette,
} from '../render/border-feather.ts';
import { addMriAppearance } from '../render/mri-material.ts';
import type { MriUniforms } from '../render/mri-material.ts';
import { worldToRas } from '../slices/coordinates.ts';
import { loadRibbonSources } from '../tissues/solid-assets.ts';
import { createWhiteMatterSurfaces, exposedWhiteMatter } from '../tissues/white-matter-surfaces.ts';
import type { WhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import { combineProgress } from './progress.ts';
import type { ProgressCallback } from './progress.ts';

export { SURFACE_COLORS };

/**
 * What the model reads of the published `manifest.json`: the shared manifest type with the
 * appearance and networks the materials need typed as they read them.
 */
export interface AtlasManifest extends Omit<Manifest, 'appearance' | 'networks'> {
  appearance: Appearance & Pick<ManifestAppearance, 'see_through_opacity'>;
  networks?: NetworkMetadata;
}

/** The part of a glTF loader the model uses: one published file, with download progress. */
export interface GlbLoader {
  loadAsync(file: string, onProgress?: ProgressCallback): Promise<{ scene: Group }>;
}

export interface LoadOptions {
  onProgress?: ProgressCallback;
  /** The detail level to open; the published default when absent. */
  detail?: string;
}

/** One loaded GLB: its scene, the region meshes in it, and the colours their borders blend through. */
export interface Layer {
  scene: Group;
  meshes: AtlasMesh[];
  featherPalette: DataTexture | null;
}

export type AtlasMesh = Mesh<BufferGeometry, MeshPhysicalMaterial>;

type Triple = [number, number, number];

/** The atlas events: `change` (the state), `selectionchange` (the region or null), `loaderror`. */
export interface BrainAtlasEventMap {
  change: CustomEvent<ModelState>;
  selectionchange: CustomEvent<Region | null>;
  loaderror: CustomEvent<Error>;
}

// Reused by intersect. A hover tests every visible mesh, and a fresh list per
// pointer frame would collect as the pointer moves.
const rayBox = new Box3();
const rayBoxHit = new Vector3();
const raySlots: { mesh: Mesh; entry: number }[] = [];
const rayHits: Intersection[] = [];

/**
 * Where the ray enters a mesh's world box, or Infinity when it misses.
 *
 * Inside the box the entry is 0: a triangle of that mesh may sit on the
 * camera. Three's box test returns the exit in that case, which would hide
 * the mesh behind a farther hit.
 */
function boxEntry(mesh: Mesh, ray: Ray): number {
  const { geometry } = mesh;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  rayBox.copy(geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
  if (rayBox.containsPoint(ray.origin)) return 0;
  return ray.intersectBox(rayBox, rayBoxHit) ? ray.origin.distanceTo(rayBoxHit) : Infinity;
}

const ENVELOPES = 'native-envelopes';
const SPINAL_CORD = 'spinal-cord';

/** A layer id this manifest does not publish; the app tells it from a failed download by this code. */
const unknownLayer = (message: string) =>
  Object.assign(new Error(message), { code: 'unknown-layer' });

function asOptions(onProgressOrOptions?: ProgressCallback | LoadOptions): LoadOptions {
  if (typeof onProgressOrOptions === 'function') return { onProgress: onProgressOrOptions };
  return onProgressOrOptions ?? {};
}

const isSurfaceColor = (mode: string): mode is SurfaceColor =>
  (SURFACE_COLORS as readonly string[]).includes(mode);

function validateManifest(manifest: AtlasManifest): void {
  // Named individually because these fail together for one boring reason — a
  // manifest cached from an earlier deploy — and "expected schema version 1"
  // sends the reader to look at the version, which was never the problem.
  const seeThroughOpacity = manifest.appearance?.see_through_opacity;
  const missing = [
    ['schema_version 1', manifest.schema_version === 1],
    ['atlases', manifest.atlases?.length > 0],
    ['regions', Array.isArray(manifest.regions)],
    ['detail_levels', manifest.detail_levels?.length > 0],
    ['appearance', Boolean(manifest.appearance?.tissue && manifest.appearance?.folds)],
    ['native tissue envelopes', Boolean(manifest.solid_envelopes?.file)],
    [
      'appearance.see_through_opacity',
      !manifest.neuropsych_domains || (seeThroughOpacity! > 0 && seeThroughOpacity! < 1),
    ],
    [
      'anatomy',
      Boolean(manifest.anatomy?.subject && manifest.anatomy?.display_name) &&
        typeof manifest.anatomy.individual === 'boolean',
    ],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field);
  if (missing.length) {
    throw new Error(
      `Invalid brain model manifest: missing or invalid ${missing.join(', ')}. ` +
        'A stale cached copy will do this; reload ignoring the cache.',
    );
  }
  const ids = new Set<string>();
  for (const region of manifest.regions) {
    if (
      !region.id ||
      ids.has(region.id) ||
      !region.label ||
      !['left', 'right', 'midline'].includes(region.hemisphere) ||
      !['cortex', 'structure', 'non-region', 'tissue-region'].includes(region.kind)
    ) {
      throw new Error(`Invalid or duplicate region metadata: ${region.id}`);
    }
    ids.add(region.id);
  }
}

function disposeScene(scene: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of [mesh.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if ((value as Texture | null | undefined)?.isTexture) textures.add(value as Texture);
      }
    }
  });
  for (const geometry of geometries) {
    geometry.boundsTree = undefined;
    geometry.dispose();
  }
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  scene.removeFromParent();
}

/** Asset-only controller. Add .group to your scene; coordinates remain untouched. */
export class BrainAtlas extends EventTarget {
  static async load(
    manifestUrl: string | URL,
    atlasId?: string,
    onProgressOrOptions?: ProgressCallback | LoadOptions,
  ): Promise<BrainAtlas> {
    const options = asOptions(onProgressOrOptions);
    const url = new URL(manifestUrl, globalThis.location.href);
    const readJson = async <T>(address: string | URL) =>
      JSON.parse(new TextDecoder().decode(await fetchAsset(address))) as T;
    const manifest = await readJson<AtlasManifest>(url.href);
    const [cabNp, functionalRegions, domains, terms, boundaryCertainty, receptors] = await Promise.all([
      manifest.cab_np ? readJson<CabNpPartition>(new URL(manifest.cab_np.file, url)) : null,
      manifest.functional_regions
        ? readJson<FunctionalRegions>(new URL(manifest.functional_regions.file, url))
        : null,
      manifest.neuropsych_domains
        ? readJson<NeuropsychDomains>(new URL(manifest.neuropsych_domains.file, url))
        : null,
      manifest.neurosynth_terms
        ? readJson<NeurosynthTerms>(new URL(manifest.neurosynth_terms.file, url))
        : null,
      manifest.boundary_certainty
        ? readJson<BoundaryCertainty>(new URL(manifest.boundary_certainty.file, url))
        : null,
      manifest.receptor_fingerprints
        ? readJson<ReceptorFingerprints>(new URL(manifest.receptor_fingerprints.file, url))
        : null,
    ]);
    const gltf = new GLTFLoader();
    const path = new URL('.', url).href;
    const loader: GlbLoader = {
      async loadAsync(file, onProgress) {
        const buffer = await fetchAsset(new URL(file, path), { onProgress });
        return gltf.parseAsync(buffer, path);
      },
    };
    const model = new BrainAtlas(
      manifest,
      loader,
      cabNp,
      functionalRegions,
      domains,
      terms,
      boundaryCertainty,
      receptors,
    );
    try {
      await model.initialize(atlasId, options);
      return model;
    } catch (error) {
      model.dispose();
      throw error;
    }
  }

  readonly manifest: AtlasManifest;
  loader: GlbLoader;
  readonly group = new Group();
  readonly regions: Map<string, Region>;
  readonly cabNp: CabNpPartition | null;
  readonly functionalRegions: FunctionalRegions | null;
  readonly domains: NeuropsychDomains | null;
  readonly boundaryCertainty: BoundaryCertainty | null;
  readonly receptors: ReceptorFingerprints | null;
  /** A panel's colours for named regions, every other region in tissue colour; null for none. */
  paint: Paint | null = null;
  readonly layers = new Map<string, Layer>();
  /** The native pial and white envelopes: every one, and the white ones the dissection exposes. */
  envelopes: Mesh[] | null = null;
  whiteMatterSurfaces: WhiteMatterSurfaces | null = null;
  readonly ribbonWedges = new Map<string, Mesh[]>();
  readonly sourceColors = new WeakMap<Mesh, Color>();
  clippingPlanes: Plane[] = [];
  spinalCordLoadState: 'unloaded' | 'loading' | 'ready' | 'error' = 'unloaded';
  spinalCordLoadError: unknown = null;
  private readonly dissection;
  private readonly pending = new Map<string, Promise<unknown>>();
  /** Who hears each pending download, keyed as `pending` is. */
  private readonly listeners = new Map<string, ProgressCallback[]>();
  private atlasId: string;
  private detailId: string;
  // Pushed in by the sections, which own the plane. Keeping it here is what
  // lets `settings` be the whole display state, so visibility reads one place.
  private cutAtlasId: string | null = null;
  private cutActive = false;
  private internalSystem: string | null = null;
  private internalConstituents = new Set<string>();
  private hemisphere: Hemisphere = 'both';
  private cortexVisible = true;
  private cortexOpacity = 1;
  private internalVisible = true;
  private spinalCordVisible = false;
  private spinalCordRequest = 0;
  private surfaceColor: SurfaceColor = 'atlas';
  private mriUniforms: MriUniforms | null = null;
  private selectedId: string | null = null;
  private isolatedId: string | null = null;
  // Separate, so a detail change does not cancel an atlas change still loading, or the reverse.
  private atlasRequest = 0;
  private detailRequest = 0;
  private isDisposed = false;
  private readonly centroids = new Map<string, Triple>();

  constructor(
    manifest: AtlasManifest,
    loader: GlbLoader,
    cabNp: CabNpPartition | null = null,
    functionalRegions: FunctionalRegions | null = null,
    domains: NeuropsychDomains | null = null,
    terms: NeurosynthTerms | null = null,
    boundaryCertainty: BoundaryCertainty | null = null,
    receptors: ReceptorFingerprints | null = null,
  ) {
    super();
    validateManifest(manifest);
    this.manifest = manifest;
    this.loader = loader;
    this.group.name = 'Brain atlas';
    this.regions = new Map(manifest.regions.map((region) => [region.id, region]));
    this.cabNp = cabNp && validateCabNp(cabNp, this.regions);
    this.functionalRegions =
      functionalRegions && validateFunctionalRegions(functionalRegions, this.regions);
    this.domains = domains && validateNeuropsychDomains(domains, this.regions, terms);
    this.boundaryCertainty =
      boundaryCertainty && validateBoundaryCertainty(boundaryCertainty, this.regions);
    this.receptors = receptors && validateReceptorFingerprints(receptors, this.regions);
    this.dissection = createDissection(this.regions);
    // What `initialize` is asked for by default; nothing is drawn until it has loaded them.
    this.atlasId = manifest.atlases[0]!.id;
    this.detailId = this.defaultDetail;
  }

  addEventListener<K extends keyof BrainAtlasEventMap>(
    type: K,
    listener: (event: BrainAtlasEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof BrainAtlasEventMap>(
    type: K,
    listener: (event: BrainAtlasEventMap[K]) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    super.removeEventListener(type, listener, options);
  }

  /** Whether `dispose` has run; the commands and the app's own checks read it. */
  get disposed(): boolean {
    return this.isDisposed;
  }

  /** The grouped learning overview when published, otherwise the native segmentation. */
  get defaultDetail(): string {
    const levels = this.manifest.detail_levels;
    return (levels.find((level) => level.id === 'learning') ?? levels[0]!).id;
  }

  /**
   * Load what the first frame draws: one cortical atlas and one detail level.
   * The envelopes and the cord wait until something needs them.
   */
  async initialize(
    atlasId: string = this.manifest.atlases[0]!.id,
    onProgressOrOptions?: ProgressCallback | LoadOptions,
  ): Promise<void> {
    const options = asOptions(onProgressOrOptions);
    const atlas = this.manifest.atlases.find((entry) => entry.id === atlasId);
    if (!atlas) throw unknownLayer(`Unknown atlas: ${atlasId}`);
    const detailId = options.detail === undefined ? this.defaultDetail : options.detail;
    const level = this.manifest.detail_levels.find((entry) => entry.id === detailId);
    if (!level) throw unknownLayer(`Unknown detail level: ${detailId}`);
    const progress = combineProgress(['detail', 'atlas'], options.onProgress);
    await Promise.all([
      this.loadLayer(level.id, level.file, progress.track('detail')),
      this.loadLayer(atlas.id, atlas.file, progress.track('atlas')),
    ]);
    this.detailId = level.id;
    this.atlasId = atlas.id;
    this.isolatedId = null;
    this.select(null);
  }

  /**
   * The native pial and white envelopes, downloaded the first time exposed
   * white matter or a cut needs them. Resolves to every
   * envelope mesh; a failed download is retried by the next call. `onProgress`
   * hears the download, whether this call starts it or joins one under way.
   */
  async ensureEnvelopes(onProgress?: ProgressCallback): Promise<Mesh[]> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    if (this.envelopes) return this.envelopes;
    if (this.pending.has(ENVELOPES)) {
      this.join(ENVELOPES, onProgress);
      return this.pending.get(ENVELOPES) as Promise<Mesh[]>;
    }
    const loading = Promise.all([
      this.loader.loadAsync(this.manifest.solid_envelopes.file, this.share(ENVELOPES, onProgress)),
      import('three-mesh-bvh'),
    ])
      .then(([{ scene }, { MeshBVH, acceleratedRaycast }]) => {
        let envelopes: Mesh[];
        try {
          if (this.isDisposed) throw new Error('BrainAtlas disposed during tissue loading.');
          envelopes = [];
          scene.traverse((object) => {
            if ((object as Mesh).isMesh) envelopes.push(object as Mesh);
          });
          const surfaces = createWhiteMatterSurfaces(scene, this.manifest.appearance);
          for (const mesh of surfaces.meshes) {
            mesh.geometry.boundsTree = new MeshBVH(mesh.geometry, { indirect: true });
            mesh.raycast = acceleratedRaycast;
            if (this.mriUniforms) addMriAppearance(mesh.material, this.mriUniforms);
          }
          this.whiteMatterSurfaces = surfaces;
          this.envelopes = envelopes;
          this.group.add(surfaces.group);
        } catch (error) {
          disposeScene(scene);
          throw error;
        }
        this.update();
        return envelopes;
      })
      .finally(() => this.settled(ENVELOPES));
    this.pending.set(ENVELOPES, loading);
    return loading;
  }

  /** Hidden cortex exposes white matter the moment it is hidden; the envelopes follow and repaint. */
  loadEnvelopesBehind(): void {
    this.ensureEnvelopes().catch((error: Error) => {
      if (this.isDisposed) return;
      console.error(error);
      this.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
    });
  }

  /**
   * Every supplemental layer (the cord assembly), downloaded the first time
   * the cord is shown. A failure clears the request so the next one retries.
   * `onProgress` hears the download, whether this call starts it or joins one under way.
   */
  async ensureSpinalCord(onProgress?: ProgressCallback): Promise<void> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const layers = this.manifest.supplemental_layers ?? [];
    if (!layers.some((layer) => layer.id === 'pam50')) {
      throw new Error('This anatomy does not publish a spinal cord.');
    }
    if (this.pending.has(SPINAL_CORD)) {
      this.join(SPINAL_CORD, onProgress);
      return this.pending.get(SPINAL_CORD) as Promise<void>;
    }
    if (layers.every((layer) => this.layers.has(layer.id))) return;
    this.spinalCordLoadState = 'loading';
    const progress = combineProgress(
      layers.map((layer) => layer.id),
      this.share(SPINAL_CORD, onProgress),
    );
    const loading = Promise.all(
      layers.map((layer) => this.loadLayer(layer.id, layer.file, progress.track(layer.id))),
    )
      .then(
        () => {
          this.spinalCordLoadState = 'ready';
          this.spinalCordLoadError = null;
          if (!this.isDisposed) this.update();
        },
        (error: unknown) => {
          this.spinalCordLoadState = 'error';
          this.spinalCordLoadError = error;
          throw error;
        },
      )
      .finally(() => this.settled(SPINAL_CORD));
    this.pending.set(SPINAL_CORD, loading);
    return loading;
  }

  /**
   * One closed ribbon solid per parcel of an atlas, cut from the envelopes and
   * kept, geometry and BVH alike, for the next cut.
   */
  async ensureRibbonWedges(atlas: string, baseUrl: string | URL): Promise<Mesh[]> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const cached = this.ribbonWedges.get(atlas);
    if (cached) return cached;
    const key = `ribbon:${atlas}`;
    if (this.pending.has(key)) return this.pending.get(key) as Promise<Mesh[]>;
    const loading = (async () => {
      const envelopes = await this.ensureEnvelopes();
      const [wedges, { MeshBVH }] = await Promise.all([
        loadRibbonSources(this.manifest, baseUrl, atlas, envelopes),
        import('three-mesh-bvh'),
      ]);
      if (this.isDisposed) {
        for (const wedge of wedges) wedge.geometry.dispose();
        throw new Error('BrainAtlas was disposed during loading.');
      }
      for (const wedge of wedges) {
        wedge.geometry.boundsTree = new MeshBVH(wedge.geometry, { indirect: true });
      }
      this.ribbonWedges.set(atlas, wedges);
      return wedges;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, loading);
    return loading;
  }

  async loadLayer(id: string, file: string, onProgress?: ProgressCallback): Promise<Layer> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const loaded = this.layers.get(id);
    if (loaded) return loaded;
    if (this.pending.has(id)) {
      this.join(id, onProgress);
      return this.pending.get(id) as Promise<Layer>;
    }
    const loading = Promise.all([
      this.loader.loadAsync(file, this.share(id, onProgress)),
      import('three-mesh-bvh'),
    ])
      .then(([{ scene }, { MeshBVH, acceleratedRaycast }]) => {
        if (this.isDisposed) {
          disposeScene(scene);
          throw new Error('BrainAtlas was disposed during loading.');
        }
        const meshes: AtlasMesh[] = [];
        const originalMaterials = new Set<Material>();
        try {
          scene.traverse((object) => {
            const mesh = object as Mesh<BufferGeometry, MeshStandardMaterial>;
            if (!mesh.isMesh) return;
            const region = this.regions.get(mesh.userData['region_id'] as string);
            if (!region) throw new Error(`Mesh has no manifest region: ${mesh.name}`);
            for (const field of [
              'label',
              'hemisphere',
              'atlas',
              'source_label_id',
              'kind',
            ] as const) {
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
            if (this.manifest.networks) {
              attachNetworkColors(mesh.geometry, this.manifest.networks);
            }
            if (this.manifest.arterial_territories) {
              attachTerritoryColors(mesh.geometry, this.manifest.arterial_territories.territories);
            }
            const shown = mesh as unknown as AtlasMesh;
            shown.material = createAnatomicalMaterial(mesh, region, this.manifest.appearance);
            if (this.mriUniforms) addMriAppearance(shown.material, this.mriUniforms);
            this.sourceColors.set(shown, shown.material.color.clone());
            // Region meshes never move after load. Skipping per-frame matrix
            // updates is free on 400+ nuclei.
            shown.matrixAutoUpdate = false;
            shown.updateMatrix();
            meshes.push(shown);
          });
          if (!meshes.length) throw new Error(`Empty brain model layer: ${id}`);
        } catch (error) {
          disposeScene(scene);
          throw error;
        } finally {
          for (const material of originalMaterials) material.dispose();
        }
        // A cortical atlas tiles one surface, so its parcels meet at shared borders.
        let featherPalette: DataTexture | null = null;
        if (meshes.every((mesh) => ['cortex', 'non-region'].includes(mesh.userData['kind']))) {
          featherBorders(meshes);
          featherPalette = createFeatherPalette(meshes.length);
          for (const mesh of meshes) addBorderFeather(mesh.material, featherPalette);
        }
        const layer: Layer = { scene, meshes, featherPalette };
        scene.visible = false;
        this.group.add(scene);
        this.layers.set(id, layer);
        return layer;
      })
      .finally(() => this.settled(id));
    this.pending.set(id, loading);
    return loading;
  }

  async setAtlas(id: string, onProgress?: ProgressCallback): Promise<void> {
    const atlas = this.manifest.atlases.find((entry) => entry.id === id);
    if (!atlas) throw unknownLayer(`Unknown atlas: ${id}`);
    const request = ++this.atlasRequest;
    await this.loadLayer(id, atlas.file, onProgress);
    if (request !== this.atlasRequest) return;
    this.atlasId = id;
    // CAB-NP groups one atlas's areas; any other atlas has none to colour.
    if (this.surfaceColor === 'cab-np' && id !== this.cabNp!.atlas) this.surfaceColor = 'atlas';
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
  async setDetail(id: string, onProgress?: ProgressCallback): Promise<void> {
    const level = this.manifest.detail_levels.find((entry) => entry.id === id);
    if (!level) throw unknownLayer(`Unknown detail level: ${id}`);
    const request = ++this.detailRequest;
    await this.loadLayer(id, level.file, onProgress);
    if (request !== this.detailRequest) return;
    this.detailId = id;
    this.internalSystem = null;
    this.internalConstituents = new Set();
    this.isolatedId = null;
    this.update();
  }

  /** What the cut is doing, reported by the sections that own the plane. */
  setCutState({ atlas, active }: { atlas: string | null; active: boolean }): void {
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
  get settings(): DisplaySettings {
    return {
      atlas: this.atlasId,
      detail: this.detailId,
      internalSystem: this.internalSystem,
      internalConstituents: this.internalConstituents,
      cutAtlas: this.cutAtlasId,
      cutActive: this.cutActive,
      hemisphere: this.hemisphere,
      cortexVisible: this.cortexVisible,
      cortexOpacity: this.cortexOpacity,
      internalVisible: this.internalVisible,
      spinalCordVisible: this.spinalCordVisible,
      surfaceColor: this.surfaceColor,
      paint: this.paint,
      isolatedRegion: this.isolatedId,
      ...this.dissection.state,
    };
  }

  get state(): ModelState {
    return {
      ...this.settings,
      selectedRegion: this.selectedId === null ? null : (this.regions.get(this.selectedId) ?? null),
      visibleMeshCount: this.visibleMeshes.length,
    };
  }

  get visibleMeshes(): AtlasMesh[] {
    const meshes: AtlasMesh[] = [...this.layers.values()]
      .filter((layer) => layer.scene.visible)
      .flatMap((layer) => layer.meshes.filter((mesh) => mesh.visible));
    if (this.whiteMatterSurfaces) {
      meshes.push(...this.whiteMatterSurfaces.meshes.filter((mesh) => mesh.visible));
    }
    return meshes;
  }

  update(): void {
    const settings = this.settings;
    if (
      !this.whiteMatterSurfaces &&
      !this.pending.has(ENVELOPES) &&
      exposedWhiteMatter(settings, this.regions).size
    ) {
      this.loadEnvelopesBehind();
    }
    this.whiteMatterSurfaces?.update(settings, this.regions, this.clippingPlanes);
    const paint = this.paint;
    const mri = this.surfaceColor === 'mri' && !paint;
    if (this.mriUniforms) this.mriUniforms.scanEnabled.value = mri;
    const { appearance } = this.manifest;
    for (const [id, layer] of this.layers) {
      layer.scene.visible =
        id === this.detailId ||
        id === this.atlasId ||
        (this.manifest.supplemental_layers ?? []).some((entry) => entry.id === id);
      for (const mesh of layer.meshes) {
        const region = this.regions.get(mesh.userData['region_id'] as string)!;
        const cortex = region.kind === 'cortex' || region.kind === 'non-region';
        const cabNpNetwork =
          this.surfaceColor === 'cab-np' && !paint ? this.cabNp!.regions[region.id] : null;
        mesh.visible = visibilityOf(region, settings).visible;
        const material = mesh.material;
        const userData = material.userData as AnatomicalUserData;
        if (cortex) {
          // Only tissue colour carries the T1 brightness it was tuned against;
          // under a published palette that modulation would distort the datum.
          userData.tissueVariation.value =
            this.surfaceColor === 'tissue' && !paint ? appearance.intensity.surface_strength : 0;
          if (userData.networkMix) {
            userData.networkMix.value = this.surfaceColor === 'network' && !paint ? 1 : 0;
          }
          if (userData.territoryMix) {
            userData.territoryMix.value = this.surfaceColor === 'territory' && !paint ? 1 : 0;
          }
        }
        if (material.clippingPlanes !== this.clippingPlanes) {
          material.clippingPlanes = this.clippingPlanes;
          material.needsUpdate = true;
        }
        // Under network colour this shows only where no network reaches: the
        // medial wall keeps the tissue it always had.
        material.color.copy(this.sourceColors.get(mesh)!);
        const painted = paint?.colors.get(region.id);
        if (painted) {
          material.color.setRGB(
            painted[0] / 255,
            painted[1] / 255,
            painted[2] / 255,
            SRGBColorSpace,
          );
        } else if (paint) {
          material.color.set(tissueColor(region, appearance.tissue));
        } else if (cabNpNetwork) {
          // Published sRGB, converted as the per-vertex network colours are.
          const [r, g, b] = this.cabNp!.colors[cabNpNetwork]!;
          material.color.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
        } else if (this.surfaceColor !== 'atlas' || region.kind === 'non-region') {
          material.color.set(tissueColor(region, appearance.tissue));
        }
        // Selection is drawn by the outline pass. Tinting the material would
        // alter a region's atlas colour, which is the datum being displayed.
        // A painted area is what the paint is about, so a see-through cortex leaves it opaque, and
        // the unpainted cortex around it gives the context.
        material.opacity = cortex && !painted ? this.cortexOpacity : 1;
        const transparent = material.opacity < 1;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.depthWrite = !transparent;
      }
      if (layer.featherPalette) writeFeatherPalette(layer.featherPalette, layer.meshes);
    }
    const selected = this.selectedId ? this.regions.get(this.selectedId) : null;
    if (selected && !this.canSelect(selected)) {
      this.selectedId = null;
      this.dispatchEvent(new CustomEvent('selectionchange', { detail: null }));
    }
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  /**
   * Raycaster must already be configured with the host camera and pointer.
   *
   * Meshes are tested from the front of the ray. Once a hit is in hand, a box
   * that starts beyond it cannot hold a closer triangle, so the rest of the
   * brain is not walked. A clipped hit does not count: the retained face
   * behind it still has to be found.
   */
  intersect(raycaster: Raycaster): Intersection<AtlasMesh> | null {
    this.group.updateMatrixWorld(true);
    return this.nearestHit(raycaster, this.visibleMeshes);
  }

  nearestHit(raycaster: Raycaster, meshes: readonly AtlasMesh[]): Intersection<AtlasMesh> | null {
    const planes = this.clippingPlanes;
    const clipped = planes.length > 0;
    let count = 0;
    for (const mesh of meshes) {
      const entry = boxEntry(mesh, raycaster.ray);
      if (entry === Infinity) continue;
      const slot = raySlots[count];
      if (slot) {
        slot.mesh = mesh;
        slot.entry = entry;
      } else {
        raySlots[count] = { mesh, entry };
      }
      count += 1;
    }
    for (let i = 1; i < count; i++) {
      const slot = raySlots[i]!;
      let j = i;
      while (j > 0 && raySlots[j - 1]!.entry > slot.entry) {
        raySlots[j] = raySlots[j - 1]!;
        j -= 1;
      }
      raySlots[j] = slot;
    }
    const firstHitOnly = raycaster.firstHitOnly;
    if (clipped) raycaster.firstHitOnly = false;
    try {
      let best: Intersection | null = null;
      let bestDistance = Infinity;
      for (let i = 0; i < count; i++) {
        const { mesh, entry } = raySlots[i]!;
        // The world box is a little loose after the matrix, so a hair of slack
        // keeps a triangle that lands on the box face.
        if (entry > bestDistance + 1e-5) break;
        rayHits.length = 0;
        mesh.raycast(raycaster, rayHits);
        for (let h = 0; h < rayHits.length; h++) {
          const hit = rayHits[h]!;
          if (hit.distance >= bestDistance) continue;
          if (clipped && !planes.every((plane) => plane.distanceToPoint(hit.point) >= -1e-9)) {
            continue;
          }
          best = hit;
          bestDistance = hit.distance;
        }
      }
      return best as Intersection<AtlasMesh> | null;
    } finally {
      raycaster.firstHitOnly = firstHitOnly;
    }
  }

  pick(raycaster: Raycaster): Region | null {
    const hit = this.intersect(raycaster);
    if (!hit || hit.object.userData['kind'] === 'non-region') return null;
    return this.regions.get(hit.object.userData['region_id'] as string) ?? null;
  }

  centroidOf(regionId: string | null): Triple | null {
    if (!regionId) return null;
    const cached = this.centroids.get(regionId);
    if (cached) return cached;
    const box = new Box3();
    for (const layer of this.layers.values()) {
      for (const mesh of layer.meshes) {
        if (mesh.userData['region_id'] === regionId) {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          box.expandByObject(mesh);
        }
      }
    }
    if (box.isEmpty()) return null;
    const [right, anterior, superior] = worldToRas(box.getCenter(new Vector3()));
    const ras: Triple = [
      Math.round(right * 10) / 10,
      Math.round(anterior * 10) / 10,
      Math.round(superior * 10) / 10,
    ];
    this.centroids.set(regionId, ras);
    return ras;
  }

  setClippingPlanes(planes: Plane[]): void {
    if (
      !Array.isArray(planes) ||
      planes.some(
        (plane) =>
          !plane.isPlane ||
          !Number.isFinite(plane.constant) ||
          !plane.normal.toArray().every(Number.isFinite) ||
          Math.abs(plane.normal.length() - 1) > 1e-6,
      )
    ) {
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
  canSelect(region: Region): boolean {
    if (region.supplemental && !this.layers.has(region.atlas!)) return false;
    return visibilityOf(region, this.settings).visible;
  }

  select(id: string | null): void {
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

  setInternalSystem(system: string | null): void {
    if (
      system !== null &&
      !this.manifest.regions.some(
        (region) =>
          region.kind === 'structure' &&
          belongsToDetail(region, this.detailId) &&
          labelOf(region, 'en')!.group === system,
      )
    ) {
      throw new Error(`Unknown internal anatomy system: ${system}`);
    }
    this.internalSystem = system;
    this.internalConstituents = new Set(
      this.manifest.regions
        .filter((region) => region.atlas === 'learning' && region.system_names!['en'] === system)
        .flatMap((region) => region.constituent_regions ?? []),
    );
    this.isolatedId = null;
    this.update();
  }

  setHemisphere(hemisphere: Hemisphere): void {
    if (!HEMISPHERES.includes(hemisphere)) {
      throw new Error(`Invalid hemisphere: ${hemisphere}`);
    }
    this.hemisphere = hemisphere;
    this.isolatedId = null;
    this.update();
  }

  setCortexVisible(visible: boolean): void {
    if (typeof visible !== 'boolean') throw new TypeError('Cortex visibility must be boolean.');
    this.cortexVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  setCortexOpacity(opacity: number): void {
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new RangeError('Cortex opacity must be between 0 and 1.');
    }
    this.cortexOpacity = opacity;
    this.update();
  }

  setInternalVisible(visible: boolean): void {
    if (typeof visible !== 'boolean') {
      throw new TypeError('Internal anatomy visibility must be boolean.');
    }
    this.internalVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  async setSpinalCordVisible(visible: boolean, onProgress?: ProgressCallback): Promise<void> {
    if (typeof visible !== 'boolean') {
      throw new TypeError('Spinal cord visibility must be boolean.');
    }
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const request = ++this.spinalCordRequest;
    if (visible) {
      await this.ensureSpinalCord(onProgress);
      if (request !== this.spinalCordRequest) return;
    }
    this.spinalCordVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  setSurfaceColor(mode: string): void {
    if (!isSurfaceColor(mode)) {
      throw new TypeError(`Unknown surface colour: ${mode}`);
    }
    if (mode === 'mri' && !this.mriUniforms) {
      throw new Error('MRI must load before selecting MRI appearance.');
    }
    if (mode === 'network' && !this.manifest.networks) {
      throw new Error('This model carries no network layer.');
    }
    if (mode === 'territory' && !this.manifest.arterial_territories) {
      throw new Error('This model carries no arterial territories.');
    }
    if (mode === 'cab-np') {
      if (!this.cabNp) throw new Error('This model carries no CAB-NP partition.');
      if (this.atlasId !== this.cabNp.atlas) {
        throw new Error(`CAB-NP colours ${this.cabNp.atlas} areas; show that atlas first.`);
      }
    }
    this.surfaceColor = mode;
    this.update();
  }

  /**
   * Draw `{ id, colors }` over the surface colour: each region in `colors` takes its sRGB
   * bytes, every other region its tissue colour. A paint is replaced whole, by id; null lifts it.
   */
  setPaint(paint: Paint | null): void {
    if (paint !== null && (typeof paint?.id !== 'string' || !(paint.colors instanceof Map))) {
      throw new TypeError('A paint needs an id and a Map of region colours.');
    }
    if ((paint?.id ?? null) === (this.paint?.id ?? null)) return;
    this.paint = paint;
    this.update();
  }

  setMriAnatomy(anatomy: { mriUniforms: MriUniforms } | null): void {
    if (!anatomy) throw new Error('MRI anatomy has not loaded.');
    if (this.mriUniforms === anatomy.mriUniforms) return;
    if (this.mriUniforms) throw new Error('MRI anatomy is already attached.');
    this.mriUniforms = anatomy.mriUniforms;
    // Envelopes that load later take it as they arrive.
    for (const mesh of this.whiteMatterSurfaces?.meshes ?? []) {
      addMriAppearance(mesh.material, this.mriUniforms);
    }
    for (const layer of this.layers.values()) {
      for (const mesh of layer.meshes) addMriAppearance(mesh.material, this.mriUniforms);
    }
  }

  isolate(): void {
    if (!this.selectedId) throw new Error('Select a region before isolating.');
    this.isolatedId = this.selectedId;
    this.update();
  }

  /** Release isolation on its own, leaving every other setting alone. */
  clearIsolation(): void {
    this.isolatedId = null;
    this.update();
  }

  get dissectionSelection(): { selectedId: string | null; isolatedId: string | null } {
    return { selectedId: this.selectedId, isolatedId: this.isolatedId };
  }

  hideRegions(ids: string[]): void {
    if (!this.dissection.hide(ids, this.dissectionSelection)) return;
    this.releaseHiddenIsolation();
    this.update();
  }

  showRegions(ids: string[]): void {
    if (this.dissection.show(ids, this.dissectionSelection)) this.update();
  }

  restoreHiddenRegions(): void {
    if (this.dissection.restore(this.dissectionSelection)) this.update();
  }

  undoDissection(): void {
    const previous = this.dissection.undo();
    if (!previous) return;
    const { isolatedId, selectedId } = previous as {
      isolatedId: string | null;
      selectedId: string | null;
    };
    this.isolatedId = null;
    if (isolatedId && this.canSelect(this.regions.get(isolatedId)!)) {
      this.isolatedId = isolatedId;
    }
    const selected = selectedId === null ? undefined : this.regions.get(selectedId);
    this.select(selected && this.canSelect(selected) ? selected.id : null);
  }

  loadHiddenRegions(ids: string[]): void {
    this.dissection.load(ids);
    this.releaseHiddenIsolation();
    this.update();
  }

  reset(): void {
    this.spinalCordRequest += 1;
    this.dissection.reset();
    this.clippingPlanes = [];
    this.internalSystem = null;
    this.internalConstituents = new Set();
    this.hemisphere = 'both';
    this.cortexVisible = true;
    this.cortexOpacity = 1;
    this.internalVisible = true;
    this.spinalCordVisible = false;
    this.surfaceColor = 'atlas';
    this.isolatedId = null;
    this.select(null);
  }

  dispose(): void {
    this.isDisposed = true;
    this.spinalCordRequest += 1;
    this.atlasRequest += 1;
    this.detailRequest += 1;
    for (const layer of this.layers.values()) {
      disposeScene(layer.scene);
      layer.featherPalette?.dispose();
    }
    if (this.whiteMatterSurfaces) disposeScene(this.whiteMatterSurfaces.group);
    for (const wedges of this.ribbonWedges.values()) {
      for (const wedge of wedges) {
        wedge.geometry.boundsTree = undefined;
        wedge.geometry.dispose();
      }
    }
    this.ribbonWedges.clear();
    this.layers.clear();
    this.centroids.clear();
    this.group.removeFromParent();
  }

  /** The callback a new download reports to; callers that join it later are added to the same list. */
  private share(key: string, onProgress?: ProgressCallback): ProgressCallback {
    const heard = onProgress ? [onProgress] : [];
    this.listeners.set(key, heard);
    return (event) => {
      for (const listener of heard) listener(event);
    };
  }

  private join(key: string, onProgress?: ProgressCallback): void {
    if (onProgress) this.listeners.get(key)!.push(onProgress);
  }

  private settled(key: string): void {
    this.pending.delete(key);
    this.listeners.delete(key);
  }

  /** A region that has just been hidden cannot stay isolated: nothing would be left to see. */
  private releaseHiddenIsolation(): void {
    if (this.isolatedId && this.dissection.state.hiddenRegions.has(this.isolatedId)) {
      this.isolatedId = null;
    }
  }
}
