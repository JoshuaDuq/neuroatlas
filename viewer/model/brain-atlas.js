import { Box3, Group, SRGBColorSpace, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { labelOf } from '../catalog/labels.js';
import { validateCabNp } from '../catalog/networks.js';
import {
  FUNCTIONAL_LEVELS, functionalRegionOf, validateFunctionalRegions,
} from '../catalog/functional-regions.js';
import { shownDomain, validateNeuropsychDomains } from '../catalog/neuropsych-domains.js';
import { belongsToDetail, visibilityOf } from '../catalog/visibility.js';
import { worldToRas } from '../slices/coordinates.js';
import { fetchAsset } from './asset-cache.js';
import { combineProgress } from './progress.js';
import { REVALIDATE_HEADER } from './published-assets.js';
import { createAnatomicalMaterial, tissueColor } from '../render/materials.js';
import { attachNetworkColors } from '../render/network-colors.js';
import { addMriAppearance } from '../render/mri-material.js';
import { createDissection } from '../state/dissection.js';
import { createGlassSolids } from '../tissues/glass-solids.js';
import { loadRibbonSources } from '../tissues/solid-assets.js';
import { createWhiteMatterSurfaces, exposedWhiteMatter } from '../tissues/white-matter-surfaces.js';

// Reused by intersect. A hover tests every visible mesh, and a fresh list per
// pointer frame would collect as the pointer moves.
const rayBox = new Box3();
const rayBoxHit = new Vector3();
const raySlots = [];
const rayHits = [];

/**
 * Where the ray enters a mesh's world box, or Infinity when it misses.
 *
 * Inside the box the entry is 0: a triangle of that mesh may sit on the
 * camera. Three's box test returns the exit in that case, which would hide
 * the mesh behind a farther hit.
 */
function boxEntry(mesh, ray) {
  const { geometry } = mesh;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  rayBox.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  if (rayBox.containsPoint(ray.origin)) return 0;
  return ray.intersectBox(rayBox, rayBoxHit) ? ray.origin.distanceTo(rayBoxHit) : Infinity;
}

const ENVELOPES = 'native-envelopes';

/** A layer id this manifest does not publish; the app tells it from a failed download by this code. */
const unknownLayer = message => Object.assign(new Error(message), { code: 'unknown-layer' });
const SPINAL_CORD = 'spinal-cord';

function asOptions(onProgressOrOptions) {
  if (typeof onProgressOrOptions === 'function') return { onProgress: onProgressOrOptions };
  return onProgressOrOptions ?? {};
}

/**
 * What the cortical surface is coloured by.
 *
 * `tissue` is the modelled tissue class, `atlas` the parcellation's own
 * published colours, `network` the Yeo palette carried per vertex,
 * `cab-np` CAB-NP's network for each HCP-MMP area as a whole, and
 * `functional` the published functional divisions, drawn solid inside glass,
 * and `domains` each area's neuropsychological domains on opaque cortex.
 * They are one setting rather than several toggles because the surface can
 * only show one of them at a time.
 */
export const SURFACE_COLORS = ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional', 'domains'];

function validateManifest(manifest) {
  // Named individually because these fail together for one boring reason — a
  // manifest cached from an earlier deploy — and "expected schema version 1"
  // sends the reader to look at the version, which was never the problem.
  const missing = [
    ['schema_version 1', manifest.schema_version === 1],
    ['atlases', manifest.atlases?.length > 0],
    ['regions', Array.isArray(manifest.regions)],
    ['detail_levels', manifest.detail_levels?.length > 0],
    ['appearance', Boolean(manifest.appearance?.tissue && manifest.appearance?.folds)],
    ['native tissue envelopes', Boolean(manifest.solid_envelopes?.file)],
    ['appearance.glass_opacity', !manifest.functional_regions
      || (manifest.appearance?.glass_opacity > 0 && manifest.appearance.glass_opacity < 1)],
    ['anatomy', Boolean(manifest.anatomy?.subject && manifest.anatomy?.display_name)
      && typeof manifest.anatomy.individual === 'boolean'],
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
  static async load(manifestUrl, atlasId, onProgressOrOptions) {
    const options = asOptions(onProgressOrOptions);
    const url = new URL(manifestUrl, globalThis.location.href);
    const bytes = await fetchAsset(url.href);
    const manifest = JSON.parse(new TextDecoder().decode(bytes));
    const [cabNp, functionalRegions, domains] = await Promise.all(
      [manifest.cab_np, manifest.functional_regions, manifest.neuropsych_domains].map(async pointer => (pointer
        ? JSON.parse(new TextDecoder().decode(await fetchAsset(new URL(pointer.file, url).href)))
        : null)),
    );
    const loader = new GLTFLoader()
      .setPath(new URL('.', url).href)
      .setRequestHeader(REVALIDATE_HEADER);
    loader.loadAsync = async (file, onProgress) => {
      const asset = new URL(file, loader.path).href;
      const buffer = await fetchAsset(asset, { onProgress });
      return loader.parseAsync(buffer, loader.path);
    };
    const model = new BrainAtlas(manifest, loader, cabNp, functionalRegions, domains);
    try {
      await model.initialize(atlasId, options);
      return model;
    } catch (error) {
      model.dispose();
      throw error;
    }
  }

  constructor(manifest, loader, cabNp = null, functionalRegions = null, domains = null) {
    super();
    validateManifest(manifest);
    this.manifest = manifest;
    this.loader = loader;
    this.group = new Group();
    this.group.name = 'Brain atlas';
    this.regions = new Map(manifest.regions.map(region => [region.id, region]));
    this.cabNp = cabNp && validateCabNp(cabNp, this.regions);
    this.functionalRegions = functionalRegions && validateFunctionalRegions(functionalRegions, this.regions);
    this.functionalLevel = 'named';
    this.domains = domains && validateNeuropsychDomains(domains, this.regions);
    // The domain the reader picked from the key, or null for every area's strongest.
    this.domain = null;
    this.glassSolids = null;
    this.dissection = createDissection(this.regions);
    this.layers = new Map();
    // The native pial and white envelopes: every one, and the white ones the dissection exposes.
    this.envelopes = null;
    this.whiteMatterSurfaces = null;
    this.ribbonWedges = new Map();
    this.pending = new Map();
    this.atlasId = null;
    this.detailId = null;
    // Pushed in by the sections, which own the plane. Keeping it here is what
    // lets `settings` be the whole display state, so visibility reads one place.
    this.cutAtlasId = null;
    this.cutActive = false;
    this.internalSystem = null;
    this.internalConstituents = new Set();
    this.hemisphere = 'both';
    this.cortexVisible = true;
    this.cortexOpacity = 1;
    this.internalVisible = true;
    this.spinalCordVisible = false;
    this.spinalCordLoadState = 'unloaded';
    this.spinalCordLoadError = null;
    this.spinalCordRequest = 0;
    this.surfaceColor = 'atlas';
    this.mriUniforms = null;
    this.sourceColors = new WeakMap();
    this.selectedId = null;
    this.isolatedId = null;
    // Separate, so a detail change does not cancel an atlas change still loading, or the reverse.
    this.atlasRequest = 0;
    this.detailRequest = 0;
    this.disposed = false;
    this.clippingPlanes = [];
    this.centroids = new Map();
  }

  /**
   * The grouped learning overview when published, otherwise the native segmentation.
   */
  get defaultDetail() {
    const levels = this.manifest.detail_levels;
    return (levels.find(level => level.id === 'learning') ?? levels[0]).id;
  }

  /**
   * Load what the first frame draws: one cortical atlas and one detail level.
   * The envelopes and the cord wait until something needs them.
   */
  async initialize(atlasId = this.manifest.atlases[0].id, onProgressOrOptions) {
    const options = asOptions(onProgressOrOptions);
    const atlas = this.manifest.atlases.find(entry => entry.id === atlasId);
    if (!atlas) throw unknownLayer(`Unknown atlas: ${atlasId}`);
    const detailId = options.detail === undefined ? this.defaultDetail : options.detail;
    const level = this.manifest.detail_levels.find(entry => entry.id === detailId);
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
   * white matter, the glass brain or a cut needs them. Resolves to every
   * envelope mesh; a failed download is retried by the next call. `onProgress`
   * hears the download this call starts.
   */
  async ensureEnvelopes(onProgress) {
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    if (this.envelopes) return this.envelopes;
    if (this.pending.has(ENVELOPES)) return this.pending.get(ENVELOPES);
    const loading = Promise.all([
      this.loader.loadAsync(this.manifest.solid_envelopes.file, onProgress),
      import('three-mesh-bvh'),
    ]).then(([{ scene }, { MeshBVH, acceleratedRaycast }]) => {
      try {
        if (this.disposed) throw new Error('BrainAtlas disposed during tissue loading.');
        const envelopes = [];
        scene.traverse(mesh => { if (mesh.isMesh) envelopes.push(mesh); });
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
      return this.envelopes;
    }).finally(() => this.pending.delete(ENVELOPES));
    this.pending.set(ENVELOPES, loading);
    return loading;
  }

  /** Hidden cortex exposes white matter the moment it is hidden; the envelopes follow and repaint. */
  loadEnvelopesBehind() {
    this.ensureEnvelopes().catch(error => {
      if (this.disposed) return;
      console.error(error);
      this.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
    });
  }

  /**
   * Every supplemental layer (the cord assembly), downloaded the first time
   * the cord is shown. A failure clears the request so the next one retries.
   * `onProgress` hears the download this call starts.
   */
  async ensureSpinalCord(onProgress) {
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    const layers = this.manifest.supplemental_layers ?? [];
    if (!layers.some(layer => layer.id === 'zanatomy')) throw new Error('This anatomy does not publish a spinal cord.');
    if (this.pending.has(SPINAL_CORD)) return this.pending.get(SPINAL_CORD);
    if (layers.every(layer => this.layers.has(layer.id))) return;
    this.spinalCordLoadState = 'loading';
    const progress = combineProgress(layers.map(layer => layer.id), onProgress);
    const loading = Promise.all(layers.map(layer => this.loadLayer(layer.id, layer.file, progress.track(layer.id))))
      .then(() => {
        this.spinalCordLoadState = 'ready';
        this.spinalCordLoadError = null;
        if (!this.disposed) this.update();
      }, error => {
        this.spinalCordLoadState = 'error';
        this.spinalCordLoadError = error;
        throw error;
      })
      .finally(() => this.pending.delete(SPINAL_CORD));
    this.pending.set(SPINAL_CORD, loading);
    return loading;
  }

  /**
   * One closed ribbon solid per parcel of an atlas, cut from the envelopes and
   * kept: the glass brain and the cut share them, geometry and BVH alike.
   */
  async ensureRibbonWedges(atlas, baseUrl) {
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    if (this.ribbonWedges.has(atlas)) return this.ribbonWedges.get(atlas);
    const key = `ribbon:${atlas}`;
    if (this.pending.has(key)) return this.pending.get(key);
    const loading = (async () => {
      const envelopes = await this.ensureEnvelopes();
      const [wedges, { MeshBVH }] = await Promise.all([
        loadRibbonSources(this.manifest, baseUrl, atlas, envelopes), import('three-mesh-bvh'),
      ]);
      if (this.disposed) {
        for (const wedge of wedges) wedge.geometry.dispose();
        throw new Error('BrainAtlas was disposed during loading.');
      }
      for (const wedge of wedges) wedge.geometry.boundsTree = new MeshBVH(wedge.geometry, { indirect: true });
      this.ribbonWedges.set(atlas, wedges);
      return wedges;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, loading);
    return loading;
  }

  /** Close each named functional region into a ribbon solid for the glass brain. */
  async loadGlassSolids(baseUrl) {
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    if (this.glassSolids) return;
    if (!this.functionalRegions) throw new Error('This model carries no functional divisions.');
    const key = 'glass-solids';
    if (this.pending.has(key)) return this.pending.get(key);
    const loading = (async () => {
      const { atlas, regions } = this.functionalRegions;
      const [wedges, { acceleratedRaycast }] = await Promise.all([
        this.ensureRibbonWedges(atlas, baseUrl), import('three-mesh-bvh'),
      ]);
      if (this.disposed) throw new Error('BrainAtlas was disposed during loading.');
      this.glassSolids = createGlassSolids(
        wedges.filter(wedge => regions.named[wedge.userData.region_id]), this.manifest.appearance);
      // Seen through the glass, a solid's wall can show where its patch does not.
      for (const mesh of this.glassSolids.meshes) mesh.raycast = acceleratedRaycast;
      this.group.add(this.glassSolids.group);
      this.update();
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, loading);
    return loading;
  }

  async loadLayer(id, file, onProgress) {
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    if (this.layers.has(id)) return this.layers.get(id);
    if (this.pending.has(id)) return this.pending.get(id);
    const loading = Promise.all([
      this.loader.loadAsync(file, onProgress),
      import('three-mesh-bvh'),
    ]).then(([{ scene }, { MeshBVH, acceleratedRaycast }]) => {
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
          if (this.manifest.networks) {
            attachNetworkColors(mesh.geometry, this.manifest.networks);
          }
          mesh.material = createAnatomicalMaterial(mesh, region, this.manifest.appearance);
          if (this.mriUniforms) addMriAppearance(mesh.material, this.mriUniforms);
          this.sourceColors.set(mesh, mesh.material.color.clone());
          // Region meshes never move after load. Skipping per-frame matrix
          // updates is free on 400+ nuclei.
          mesh.matrixAutoUpdate = false;
          mesh.updateMatrix();
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
    if (!atlas) throw unknownLayer(`Unknown atlas: ${id}`);
    const request = ++this.atlasRequest;
    await this.loadLayer(id, atlas.file, onProgress);
    if (request !== this.atlasRequest) return;
    this.atlasId = id;
    // CAB-NP and the functional divisions group one atlas's areas; any other atlas has none to colour.
    if (this.surfaceColor === 'cab-np' && id !== this.cabNp.atlas) this.surfaceColor = 'atlas';
    if (this.surfaceColor === 'functional' && id !== this.functionalRegions.atlas) this.surfaceColor = 'atlas';
    if (this.surfaceColor === 'domains' && id !== this.domains.atlas) this.surfaceColor = 'atlas';
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
      functionalLevel: this.functionalLevel,
      domain: this.domain,
      isolatedRegion: this.isolatedId,
      ...this.dissection.state,
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
    const meshes = [...this.layers.values()]
      .filter(layer => layer.scene.visible)
      .flatMap(layer => layer.meshes.filter(mesh => mesh.visible));
    if (this.whiteMatterSurfaces) {
      meshes.push(...this.whiteMatterSurfaces.meshes.filter(mesh => mesh.visible));
    }
    return meshes;
  }

  update() {
    const settings = this.settings;
    if (!this.whiteMatterSurfaces && !this.pending.has(ENVELOPES)
        && exposedWhiteMatter(settings, this.regions).size) this.loadEnvelopesBehind();
    this.whiteMatterSurfaces?.update(settings, this.regions, this.clippingPlanes);
    const mri = this.surfaceColor === 'mri';
    if (this.mriUniforms) this.mriUniforms.scanEnabled.value = mri;
    const functional = this.surfaceColor === 'functional';
    const domains = this.surfaceColor === 'domains';
    const shownCortex = new Set();
    for (const [id, layer] of this.layers) {
      layer.scene.visible = id === this.detailId || id === this.atlasId ||
        (this.manifest.supplemental_layers ?? []).some(entry => entry.id === id);
      for (const mesh of layer.meshes) {
        const region = this.regions.get(mesh.userData.region_id);
        const cortex = region.kind === 'cortex' || region.kind === 'non-region';
        const cabNpNetwork = this.surfaceColor === 'cab-np' ? this.cabNp.regions[region.id] : null;
        const division = !cortex ? null
          : functional ? functionalRegionOf(this.functionalRegions, this.functionalLevel, region.id)
            : domains ? shownDomain(this.domains, region.id, this.domain) : null;
        // Cortex outside every division of the level is the glass the divisions sit in; an
        // area that reaches no domain keeps the plain tissue colour, opaque.
        const glass = functional && cortex && !division;
        mesh.visible = visibilityOf(region, settings).visible;
        if (mesh.visible && layer.scene.visible) shownCortex.add(region.id);
        const material = mesh.material;
        if (cortex) {
          // Only tissue colour carries the T1 brightness it was tuned against;
          // under a published palette that modulation would distort the datum.
          material.userData.tissueVariation.value = this.surfaceColor === 'tissue'
            ? this.manifest.appearance.intensity.surface_strength : 0;
          if (material.userData.networkMix) {
            material.userData.networkMix.value =
              this.surfaceColor === 'network' ? 1 : 0;
          }
        }
        if (material.clippingPlanes !== this.clippingPlanes) {
          material.clippingPlanes = this.clippingPlanes;
          material.needsUpdate = true;
        }
        // Under network colour this shows only where no network reaches: the
        // medial wall keeps the tissue it always had.
        material.color.copy(this.sourceColors.get(mesh));
        if (cabNpNetwork) {
          // Published sRGB, converted as the per-vertex network colours are.
          material.color.setRGB(
            ...this.cabNp.colors[cabNpNetwork].map(value => value / 255), SRGBColorSpace);
        } else if (division) {
          material.color.setRGB(...division.color.map(value => value / 255), SRGBColorSpace);
        } else if (this.surfaceColor !== 'atlas' || region.kind === 'non-region') {
          material.color.set(tissueColor(region, this.manifest.appearance.tissue));
        }
        // Selection is drawn by the outline pass. Tinting the material would
        // alter a region's atlas colour, which is the datum being displayed.
        material.opacity = cortex
          ? this.cortexOpacity * (glass ? this.manifest.appearance.glass_opacity : 1) : 1;
        material.userData.glass = glass;
        const transparent = material.opacity < 1;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.depthWrite = !transparent;
      }
    }
    // Translucent divisions show what is behind them, so only opaque ones need closing.
    const solid = functional && this.functionalLevel === 'named' && this.cortexOpacity === 1;
    this.glassSolids?.update({
      solidOf: id => (solid ? functionalRegionOf(this.functionalRegions, 'named', id) : null),
      shown: id => shownCortex.has(id),
      clippingPlanes: this.clippingPlanes,
    });
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
  intersect(raycaster) {
    this.group.updateMatrixWorld(true);
    const meshes = this.visibleMeshes;
    if (!meshes.some(mesh => mesh.material.userData.glass)) return this.nearestHit(raycaster, meshes);
    // A division seen through the glass, patch or ribbon solid, is what the reader is pointing at.
    const solids = this.glassSolids?.meshes.filter(mesh => mesh.visible) ?? [];
    return this.nearestHit(raycaster, [...meshes.filter(mesh => !mesh.material.userData.glass), ...solids])
      ?? this.nearestHit(raycaster, meshes.filter(mesh => mesh.material.userData.glass));
  }

  nearestHit(raycaster, meshes) {
    const planes = this.clippingPlanes;
    const clipped = planes.length > 0;
    let count = 0;
    for (const mesh of meshes) {
      const entry = boxEntry(mesh, raycaster.ray);
      if (entry === Infinity) continue;
      const slot = raySlots[count] ?? (raySlots[count] = { mesh: null, entry: 0 });
      slot.mesh = mesh;
      slot.entry = entry;
      count += 1;
    }
    for (let i = 1; i < count; i++) {
      const slot = raySlots[i];
      let j = i;
      while (j > 0 && raySlots[j - 1].entry > slot.entry) {
        raySlots[j] = raySlots[j - 1];
        j -= 1;
      }
      raySlots[j] = slot;
    }
    const firstHitOnly = raycaster.firstHitOnly;
    if (clipped) raycaster.firstHitOnly = false;
    try {
      let best = null;
      let bestDistance = Infinity;
      for (let i = 0; i < count; i++) {
        const { mesh, entry } = raySlots[i];
        // The world box is a little loose after the matrix, so a hair of slack
        // keeps a triangle that lands on the box face.
        if (entry > bestDistance + 1e-5) break;
        rayHits.length = 0;
        mesh.raycast(raycaster, rayHits);
        for (let h = 0; h < rayHits.length; h++) {
          const hit = rayHits[h];
          if (hit.distance >= bestDistance) continue;
          if (clipped && !planes.every(plane => plane.distanceToPoint(hit.point) >= -1e-9)) continue;
          best = hit;
          bestDistance = hit.distance;
        }
      }
      return best;
    } finally {
      raycaster.firstHitOnly = firstHitOnly;
    }
  }

  pick(raycaster) {
    const hit = this.intersect(raycaster);
    if (!hit || hit.object.userData.kind === 'non-region') return null;
    return this.regions.get(hit.object.userData.region_id);
  }

  centroidOf(regionId) {
    if (!regionId) return null;
    if (this.centroids.has(regionId)) return this.centroids.get(regionId);
    const box = new Box3();
    for (const layer of this.layers.values()) {
      for (const mesh of layer.meshes) {
        if (mesh.userData.region_id === regionId) {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          box.expandByObject(mesh);
        }
      }
    }
    if (box.isEmpty()) return null;
    const center = box.getCenter(new Vector3());
    const ras = worldToRas(center).map(v => Math.round(v * 10) / 10);
    this.centroids.set(regionId, ras);
    return ras;
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
    if (region.supplemental && !this.layers.has(region.atlas)) return false;
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

  setInternalSystem(system) {
    if (system !== null && !this.manifest.regions.some(region =>
      region.kind === 'structure' && belongsToDetail(region, this.detailId) &&
      labelOf(region, 'en').group === system)) {
      throw new Error(`Unknown internal anatomy system: ${system}`);
    }
    this.internalSystem = system;
    this.internalConstituents = new Set(this.manifest.regions
      .filter(region => region.atlas === 'learning' && region.system_names.en === system)
      .flatMap(region => region.constituent_regions));
    this.isolatedId = null;
    this.update();
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

  setInternalVisible(visible) {
    if (typeof visible !== 'boolean') throw new TypeError('Internal anatomy visibility must be boolean.');
    this.internalVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  async setSpinalCordVisible(visible, onProgress) {
    if (typeof visible !== 'boolean') throw new TypeError('Spinal cord visibility must be boolean.');
    if (this.disposed) throw new Error('BrainAtlas has been disposed.');
    const request = ++this.spinalCordRequest;
    if (visible) {
      await this.ensureSpinalCord(onProgress);
      if (request !== this.spinalCordRequest) return;
    }
    this.spinalCordVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  setSurfaceColor(mode) {
    if (!SURFACE_COLORS.includes(mode)) {
      throw new TypeError(`Unknown surface colour: ${mode}`);
    }
    if (mode === 'mri' && !this.mriUniforms) {
      throw new Error('MRI must load before selecting MRI appearance.');
    }
    if (mode === 'network' && !this.manifest.networks) {
      throw new Error('This model carries no network layer.');
    }
    if (mode === 'cab-np' && !this.cabNp) throw new Error('This model carries no CAB-NP partition.');
    if (mode === 'cab-np' && this.atlasId !== this.cabNp.atlas) {
      throw new Error(`CAB-NP colours ${this.cabNp.atlas} areas; show that atlas first.`);
    }
    if (mode === 'functional') {
      if (!this.functionalRegions) throw new Error('This model carries no functional divisions.');
      if (this.atlasId !== this.functionalRegions.atlas) {
        throw new Error(`Functional divisions colour ${this.functionalRegions.atlas} areas; show that atlas first.`);
      }
      if (!this.glassSolids) throw new Error('Glass-brain solids must load before selecting functional divisions.');
    }
    if (mode === 'domains') {
      if (!this.domains) throw new Error('This model carries no neuropsychological domains.');
      if (this.atlasId !== this.domains.atlas) {
        throw new Error(`Neuropsychological domains colour ${this.domains.atlas} areas; show that atlas first.`);
      }
    }
    this.surfaceColor = mode;
    this.update();
  }

  setFunctionalLevel(level) {
    if (!FUNCTIONAL_LEVELS.includes(level)) throw new TypeError(`Unknown functional level: ${level}`);
    this.functionalLevel = level;
    this.update();
  }

  /** Show one domain's every area, or with null each area's strongest domain. */
  setDomain(id) {
    if (id !== null && !this.domains?.domains.some(domain => domain.id === id)) {
      throw new TypeError(`Unknown neuropsychological domain: ${id}`);
    }
    this.domain = id;
    this.update();
  }

  setMriAnatomy(anatomy) {
    if (this.mriUniforms === anatomy.mriUniforms) return;
    if (this.mriUniforms) throw new Error('MRI anatomy is already attached.');
    this.mriUniforms = anatomy.mriUniforms;
    // Envelopes that load later take it as they arrive.
    for (const mesh of this.whiteMatterSurfaces?.meshes ?? []) addMriAppearance(mesh.material, this.mriUniforms);
    for (const layer of this.layers.values()) {
      for (const mesh of layer.meshes) addMriAppearance(mesh.material, this.mriUniforms);
    }
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

  get dissectionSelection() {
    return { selectedId: this.selectedId, isolatedId: this.isolatedId };
  }

  hideRegions(ids) {
    if (!this.dissection.hide(ids, this.dissectionSelection)) return;
    if (this.dissection.state.hiddenRegions.has(this.isolatedId)) this.isolatedId = null;
    this.update();
  }

  showRegions(ids) {
    if (this.dissection.show(ids, this.dissectionSelection)) this.update();
  }

  restoreHiddenRegions() {
    if (this.dissection.restore(this.dissectionSelection)) this.update();
  }

  undoDissection() {
    const previous = this.dissection.undo();
    if (!previous) return;
    this.isolatedId = null;
    if (previous.isolatedId && this.canSelect(this.regions.get(previous.isolatedId))) {
      this.isolatedId = previous.isolatedId;
    }
    const selected = this.regions.get(previous.selectedId);
    this.select(selected && this.canSelect(selected) ? selected.id : null);
  }

  loadHiddenRegions(ids) {
    this.dissection.load(ids);
    this.update();
  }

  reset() {
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
    this.functionalLevel = 'named';
    this.domain = null;
    this.isolatedId = null;
    this.select(null);
  }

  dispose() {
    this.disposed = true;
    this.spinalCordRequest += 1;
    this.atlasRequest += 1;
    this.detailRequest += 1;
    for (const layer of this.layers.values()) disposeScene(layer.scene);
    if (this.whiteMatterSurfaces) disposeScene(this.whiteMatterSurfaces.group);
    // The glass solids draw the cached wedges' geometry, which goes with the wedges.
    for (const mesh of this.glassSolids?.meshes ?? []) mesh.material.dispose();
    this.glassSolids?.group.removeFromParent();
    for (const wedges of this.ribbonWedges.values()) {
      for (const wedge of wedges) {
        wedge.geometry.boundsTree = null;
        wedge.geometry.dispose();
      }
    }
    this.ribbonWedges.clear();
    this.layers.clear();
    this.centroids.clear();
    this.group.removeFromParent();
  }
}
