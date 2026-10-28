import { Vector3 } from 'three';
import type { Manifest } from '../types/index.ts';
import type {
  EngineModel,
  EngineSections,
  MprPlane,
  MriDisplay,
  MriWindow,
  PlaneFrame,
  SectionsState,
  Vec3,
  VolumeSample,
} from './api.ts';
import type { BrainAtlas } from './model/brain-atlas.ts';
import type { BrainSections } from './slices/sections.ts';
import { centeredFrame } from './slices/coordinates.ts';
import type { Frame } from './slices/coordinates.ts';

const toTuple = (vector: Vector3): Vec3 => [vector.x, vector.y, vector.z];

const planeFrame = ({ center, normal, u, v, edges }: Frame): PlaneFrame => ({
  center: toTuple(center),
  normal: toTuple(normal),
  u: toTuple(u),
  v: toTuple(v),
  edges,
});

const frameOf = ({ center, normal, u, v, edges }: PlaneFrame): Frame => ({
  center: new Vector3(...center),
  normal: new Vector3(...normal),
  u: new Vector3(...u),
  v: new Vector3(...v),
  edges: edges as Frame['edges'],
});

/**
 * `BrainAtlas` as the contract's model. The class stays a 1-1 port; what the contract adds are reads
 * the application used to make on the model's fields (`layers`, `envelopes`, `visibleMeshes`) and the
 * one prefetch that names its file.
 */
export function createEngineModel(atlas: BrainAtlas): EngineModel {
  return {
    // The model validated the manifest on load; the contract's type is its published shape.
    manifest: atlas.manifest as unknown as Manifest,
    regions: atlas.regions,
    cabNp: atlas.cabNp,
    functionalRegions: atlas.functionalRegions,
    domains: atlas.domains,
    boundaryCertainty: atlas.boundaryCertainty,
    get defaultDetail() {
      return atlas.defaultDetail;
    },
    get settings() {
      return atlas.settings;
    },
    get state() {
      return atlas.state;
    },
    get disposed() {
      return atlas.disposed;
    },
    hasLayer: (id) => atlas.layers.has(id),
    get envelopesLoaded() {
      return atlas.envelopes !== null;
    },
    get spinalCordLoad() {
      return atlas.spinalCordLoadState;
    },
    isRegionDrawn: (id) => atlas.visibleMeshes.some((mesh) => mesh.userData['region_id'] === id),
    centroidOf: (id) => atlas.centroidOf(id),
    canSelect: (region) => atlas.canSelect(region),

    select: (id) => atlas.select(id),
    setInternalSystem: (system) => atlas.setInternalSystem(system),
    setHemisphere: (hemisphere) => atlas.setHemisphere(hemisphere),
    setCortexVisible: (visible) => atlas.setCortexVisible(visible),
    setCortexOpacity: (opacity) => atlas.setCortexOpacity(opacity),
    setInternalVisible: (visible) => atlas.setInternalVisible(visible),
    setSpinalCordVisible: (visible, onProgress) => atlas.setSpinalCordVisible(visible, onProgress),
    setFunctionalLevel: (level) => atlas.setFunctionalLevel(level),
    setSurfaceColor: (mode) => atlas.setSurfaceColor(mode),
    setPaint: (paint) => atlas.setPaint(paint),
    isolate: () => atlas.isolate(),
    clearIsolation: () => atlas.clearIsolation(),
    hideRegions: (ids) => atlas.hideRegions([...ids]),
    showRegions: (ids) => atlas.showRegions([...ids]),
    restoreHiddenRegions: () => atlas.restoreHiddenRegions(),
    undoDissection: () => atlas.undoDissection(),
    loadHiddenRegions: (ids) => atlas.loadHiddenRegions([...ids]),
    reset: () => atlas.reset(),

    setAtlas: (id, onProgress) => atlas.setAtlas(id, onProgress),
    setDetail: (id, onProgress) => atlas.setDetail(id, onProgress),
    async ensureEnvelopes(onProgress) {
      await atlas.ensureEnvelopes(onProgress);
    },
    ensureSpinalCord: (onProgress) => atlas.ensureSpinalCord(onProgress),
    async prefetchLayer(id) {
      // An atlas or a detail level: the supplemental layers load with their own commands.
      const entry =
        atlas.manifest.atlases.find((candidate) => candidate.id === id) ??
        atlas.manifest.detail_levels.find((candidate) => candidate.id === id);
      if (!entry) {
        throw Object.assign(new Error(`Unknown layer: ${id}`), { code: 'unknown-layer' });
      }
      await atlas.loadLayer(id, entry.file);
    },
  };
}

/**
 * `BrainSections` as the contract's sections: the cut's own frame and pixels in tuples, a fresh
 * snapshot of its state on every read, and the reads the panels used to make on its fields. The class
 * stays a 1-1 port (`ui/chrome/sections.js` and `app.js:825-831` computed these).
 */
export function createEngineSections(sections: BrainSections): EngineSections {
  const snapshot = (): SectionsState => ({
    ...sections.state,
    crosshair: [...sections.state.crosshair],
  });
  const published = (): MriWindow | null => {
    const display = sections.volumes?.metadata.display;
    return display ? { center: display.window_center, width: display.window_width } : null;
  };

  return {
    get state() {
      return snapshot();
    },
    get active() {
      return sections.active;
    },
    get solidsReady() {
      return sections.solidsReady;
    },
    get frame() {
      return planeFrame(sections.frame);
    },
    get offsetRange() {
      return sections.offsetRange;
    },
    get offset() {
      return new Vector3(...sections.state.crosshair).dot(sections.frame.normal);
    },
    get volumesLoaded() {
      return sections.volumes !== null;
    },
    get display(): MriDisplay | null {
      return sections.display && { ...sections.display };
    },
    get publishedWindow() {
      return published();
    },
    mriWindowLink() {
      const shown = sections.display;
      const window = published();
      if (!shown || !window) return null;
      if (shown.windowCenter === window.center && shown.windowWidth === window.width) return null;
      return { center: shown.windowCenter, width: shown.windowWidth };
    },
    cutSpacingMm: (atlas) => sections.tissues.metadata?.atlases[atlas]?.voxel_spacing_mm?.[0] ?? 1,

    load: () => sections.load(),
    setMode: (mode) => sections.setMode(mode),
    setCrosshair: (point) => sections.setCrosshair(point),
    setOffset: (offset) => sections.setOffset(offset),
    setOffsetReady: (offset) => sections.setOffsetReady(offset),
    setAngles: (tilt, azimuth) => sections.setAngles(tilt, azimuth),
    setAnglesReady: (tilt, azimuth) => sections.setAnglesReady(tilt, azimuth),
    setCutAtlas: (atlas) => sections.setCutAtlas(atlas),
    setDisplay: (options) => sections.setDisplay(options),
    setWindow: (center, width) => sections.setWindow(center, width),
    setSurfaceColor: (mode, current) => sections.setSurfaceColor(mode, current),

    mprFrame: (plane: MprPlane) => planeFrame(centeredFrame(plane, sections.state.crosshair)),
    pixels: (frame) => sections.pixels(frameOf(frame)),
    sample: (point): VolumeSample => sections.sample(point),
  };
}
