import type {
  DisplaySettings,
  FunctionalLevel,
  Hemisphere,
  Manifest,
  ModelState,
  Paint,
  Region,
  SurfaceColor,
} from '../../types/index.ts';
import { FUNCTIONAL_LEVELS, HEMISPHERES, SURFACE_COLORS } from '../../types/index.ts';
import type {
  CabNpData,
  DomainsData,
  EngineModel,
  FunctionalRegionsData,
  OnProgress,
  SpinalCordLoad,
  Vec3,
} from '../api.ts';
import { coded, sameSet } from './support.ts';

export interface FakeModelOptions {
  manifest: Manifest;
  cabNp?: CabNpData;
  functionalRegions?: FunctionalRegionsData;
  domains?: DomainsData;
  /** Called after every state change, as the real model's `change` event (brain-atlas.js:602). */
  changed: () => void;
}

/** The model plus the hooks the fake sections drive; the real model's sections call the same methods. */
export interface FakeModel extends EngineModel {
  /** brain-atlas.js:789 (the colour check) and :833 (the scan attached by `sections.setSurfaceColor`). */
  applySurfaceColor(mode: SurfaceColor): void;
  /** brain-atlas.js:466. */
  setCutState(cut: { atlas: string; active: boolean }): void;
  /** Mark a layer downloaded (what `loadLayer` does, brain-atlas.js:364). */
  loadLayer(id: string): void;
  loadGlassSolids(): void;
  attachMri(): void;
  dispose(): void;
}

interface Dissected {
  hidden: ReadonlySet<string>;
  selectedId: string | null;
  isolatedId: string | null;
}

/**
 * In-memory stand-in for `BrainAtlas`. Its visibility rule is a compact copy of catalog/visibility.js
 * (layer, internal system, hemisphere, cortex, internal anatomy, cord, hidden, isolated), without the cut-label
 * cases and with the learning level's `system_names` as the only system grouping: enough for state and controller code to see a selection accepted or refused for the
 * reasons the real model gives. Every download resolves at once.
 */
export function createFakeModel({
  manifest,
  cabNp,
  functionalRegions,
  domains,
  changed,
}: FakeModelOptions): FakeModel {
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const levels = manifest.detail_levels;
  const defaultDetail = (levels.find((level) => level.id === 'learning') ?? levels[0]!).id;
  const layers = new Set<string>();
  const dissection = { hidden: new Set<string>(), history: [] as Dissected[] };
  let envelopes = false;
  let spinalCord: SpinalCordLoad = 'unloaded';
  let glassSolids = false;
  let mri = false;
  let disposed = false;
  let selectedId: string | null = null;

  const values = {
    atlas: manifest.atlases[0]!.id,
    detail: defaultDetail,
    internalSystem: null as string | null,
    internalConstituents: new Set<string>(),
    cutAtlas: null as string | null,
    cutActive: false,
    hemisphere: 'both' as Hemisphere,
    cortexVisible: true,
    cortexOpacity: 1,
    internalVisible: true,
    spinalCordVisible: false,
    surfaceColor: 'atlas' as SurfaceColor,
    functionalLevel: 'named' as FunctionalLevel,
    paint: null as Paint | null,
    isolatedRegion: null as string | null,
  };
  layers.add(values.atlas);
  layers.add(values.detail);

  const unknownLayer = (message: string) => coded(message, 'unknown-layer');
  const settings = (): DisplaySettings => ({
    ...values,
    internalConstituents: new Set(values.internalConstituents),
    hiddenRegions: new Set(dissection.hidden),
    dissectionCanUndo: dissection.history.length > 0,
  });

  /** visibility.js:33: with a system chosen, only its structures show; the group is the learning level's `system_names`. */
  function internalSystemAllows(region: Region, surface: boolean): boolean {
    if (!values.internalSystem || surface) return true;
    if (values.detail === 'learning' && region.atlas !== 'learning' && !region.supplemental) {
      return values.internalConstituents.has(region.id);
    }
    return region.system_names?.en === values.internalSystem;
  }

  function hidden(region: Region): boolean {
    const s = values;
    const surface = region.kind === 'cortex' || region.kind === 'non-region';
    if (region.kind === 'tissue-region') return !s.cutActive;
    if (region.kind === 'structure') {
      if (!(region.supplemental === true || region.atlas === s.detail)) return true;
    } else if (surface && region.atlas !== s.atlas) return true;
    if (!internalSystemAllows(region, surface)) return true;
    if (
      s.hemisphere !== 'both' &&
      region.hemisphere !== 'midline' &&
      region.hemisphere !== s.hemisphere
    ) {
      return true;
    }
    if ((surface || region.atlas === 'wmparc') && !(s.cortexVisible && s.cortexOpacity > 0))
      return true;
    if (region.kind === 'structure' && !s.internalVisible) return true;
    if (region.atlas === 'zanatomy' && !s.spinalCordVisible) return true;
    if (dissection.hidden.has(region.id)) return true;
    return Boolean(s.isolatedRegion && region.id !== s.isolatedRegion);
  }

  const canSelect = (region: Region) =>
    !(region.supplemental && !layers.has(region.atlas ?? '')) && !hidden(region);

  /** A selection the new settings no longer show is dropped, as `update` does (brain-atlas.js:519). */
  function update() {
    const region = selectedId ? regions.get(selectedId) : undefined;
    if (region && !canSelect(region)) selectedId = null;
    changed();
  }

  const requireBoolean = (value: unknown, what: string) => {
    if (typeof value !== 'boolean') throw new TypeError(`${what} must be boolean.`);
  };

  const requireRegions = (ids: readonly string[]) => {
    for (const id of ids) if (!regions.has(id)) throw new Error(`Unknown region: ${id}`);
  };

  /** brain-atlas.js dissection: one history entry per action, no-ops add none (state/dissection.js:15). */
  function replaceHidden(next: Set<string>) {
    if (sameSet(next, dissection.hidden)) return false;
    dissection.history.push({
      hidden: dissection.hidden,
      selectedId,
      isolatedId: values.isolatedRegion,
    });
    dissection.hidden = next;
    return true;
  }

  function select(id: string | null) {
    if (id !== null) {
      const region = regions.get(id);
      if (!region) throw new Error(`Unknown region: ${id}`);
      if (region.kind === 'non-region') throw new Error(`Cannot select a non-region: ${id}`);
      if (!canSelect(region)) throw new Error(`Region is not visible: ${id}`);
    }
    selectedId = id;
    update();
  }

  const model: FakeModel = {
    manifest,
    regions,
    cabNp: cabNp ?? null,
    functionalRegions: functionalRegions ?? null,
    domains: domains ?? null,
    defaultDetail,
    get settings() {
      return settings();
    },
    get state(): ModelState {
      return {
        ...settings(),
        selectedRegion: (selectedId && regions.get(selectedId)) || null,
        visibleMeshCount: [...regions.values()].filter(
          (region) => region.kind !== 'tissue-region' && layerLoaded(region) && !hidden(region),
        ).length,
      };
    },
    get disposed() {
      return disposed;
    },
    hasLayer: (id) => layers.has(id),
    get envelopesLoaded() {
      return envelopes;
    },
    get spinalCordLoad() {
      return spinalCord;
    },
    isRegionDrawn(id) {
      const region = regions.get(id);
      return Boolean(
        region && region.kind !== 'tissue-region' && layerLoaded(region) && !hidden(region),
      );
    },
    centroidOf(id) {
      const region = id ? regions.get(id) : undefined;
      if (!region || !layerLoaded(region)) return null;
      const side = region.hemisphere === 'left' ? -1 : region.hemisphere === 'right' ? 1 : 0;
      return [side * 30, 0, 0] satisfies Vec3;
    },
    canSelect,

    select,
    setInternalSystem(system) {
      if (
        system !== null &&
        !manifest.regions.some((r) => r.kind === 'structure' && r.system_names?.en === system)
      ) {
        throw new Error(`Unknown internal anatomy system: ${system}`);
      }
      values.internalSystem = system;
      values.internalConstituents = new Set(
        manifest.regions
          .filter((r) => r.atlas === 'learning' && r.system_names?.en === system)
          .flatMap((r) => r.constituent_regions ?? []),
      );
      values.isolatedRegion = null;
      update();
    },
    setHemisphere(hemisphere) {
      if (!HEMISPHERES.includes(hemisphere)) throw new Error(`Invalid hemisphere: ${hemisphere}`);
      values.hemisphere = hemisphere;
      values.isolatedRegion = null;
      update();
    },
    setCortexVisible(visible) {
      requireBoolean(visible, 'Cortex visibility');
      values.cortexVisible = visible;
      values.isolatedRegion = null;
      update();
    },
    setCortexOpacity(opacity) {
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new RangeError('Cortex opacity must be between 0 and 1.');
      }
      values.cortexOpacity = opacity;
      update();
    },
    setInternalVisible(visible) {
      requireBoolean(visible, 'Internal anatomy visibility');
      values.internalVisible = visible;
      values.isolatedRegion = null;
      update();
    },
    async setSpinalCordVisible(visible, onProgress?: OnProgress) {
      requireBoolean(visible, 'Spinal cord visibility');
      if (disposed) throw new Error('BrainAtlas has been disposed.');
      if (visible) await model.ensureSpinalCord(onProgress);
      values.spinalCordVisible = visible;
      values.isolatedRegion = null;
      update();
    },
    setFunctionalLevel(level) {
      if (!FUNCTIONAL_LEVELS.includes(level))
        throw new TypeError(`Unknown functional level: ${level}`);
      values.functionalLevel = level;
      update();
    },
    setPaint(paint) {
      if (paint !== null && (typeof paint.id !== 'string' || !(paint.colors instanceof Map))) {
        throw new TypeError('A paint needs an id and a Map of region colours.');
      }
      if ((paint?.id ?? null) === (values.paint?.id ?? null)) return;
      values.paint = paint;
      update();
    },
    isolate() {
      if (!selectedId) throw new Error('Select a region before isolating.');
      values.isolatedRegion = selectedId;
      update();
    },
    clearIsolation() {
      values.isolatedRegion = null;
      update();
    },
    hideRegions(ids) {
      requireRegions(ids);
      if (!replaceHidden(new Set([...dissection.hidden, ...ids]))) return;
      if (values.isolatedRegion && dissection.hidden.has(values.isolatedRegion))
        values.isolatedRegion = null;
      update();
    },
    showRegions(ids) {
      requireRegions(ids);
      const shown = new Set(ids);
      if (replaceHidden(new Set([...dissection.hidden].filter((id) => !shown.has(id))))) update();
    },
    restoreHiddenRegions() {
      if (replaceHidden(new Set())) update();
    },
    undoDissection() {
      const previous = dissection.history.pop();
      if (!previous) return;
      dissection.hidden = new Set(previous.hidden);
      values.isolatedRegion = null;
      const isolated = previous.isolatedId ? regions.get(previous.isolatedId) : undefined;
      if (isolated && canSelect(isolated)) values.isolatedRegion = isolated.id;
      const selected = previous.selectedId ? regions.get(previous.selectedId) : undefined;
      select(selected && canSelect(selected) ? selected.id : null);
    },
    loadHiddenRegions(ids) {
      requireRegions(ids);
      dissection.hidden = new Set(ids);
      dissection.history = [];
      update();
    },
    reset() {
      dissection.hidden = new Set();
      dissection.history = [];
      values.internalSystem = null;
      values.internalConstituents = new Set();
      values.hemisphere = 'both';
      values.cortexVisible = true;
      values.cortexOpacity = 1;
      values.internalVisible = true;
      values.spinalCordVisible = false;
      values.surfaceColor = 'atlas';
      values.functionalLevel = 'named';
      values.isolatedRegion = null;
      select(null);
    },

    async setAtlas(id) {
      if (!manifest.atlases.some((atlas) => atlas.id === id))
        throw unknownLayer(`Unknown atlas: ${id}`);
      layers.add(id);
      values.atlas = id;
      if (values.surfaceColor === 'cab-np' && id !== cabNp?.atlas) values.surfaceColor = 'atlas';
      if (values.surfaceColor === 'functional' && id !== functionalRegions?.atlas)
        values.surfaceColor = 'atlas';
      values.isolatedRegion = null;
      select(null);
    },
    async setDetail(id) {
      if (!levels.some((level) => level.id === id))
        throw unknownLayer(`Unknown detail level: ${id}`);
      layers.add(id);
      values.detail = id;
      values.internalSystem = null;
      values.internalConstituents = new Set();
      values.isolatedRegion = null;
      update();
    },
    async ensureEnvelopes() {
      envelopes = true;
    },
    async ensureSpinalCord() {
      if (!(manifest.supplemental_layers ?? []).some((layer) => layer.id === 'zanatomy')) {
        throw new Error('This anatomy does not publish a spinal cord.');
      }
      for (const layer of manifest.supplemental_layers ?? []) layers.add(layer.id);
      spinalCord = 'ready';
      update();
    },
    async prefetchLayer(id) {
      layers.add(id);
    },

    applySurfaceColor(mode) {
      if (!SURFACE_COLORS.includes(mode)) throw new TypeError(`Unknown surface colour: ${mode}`);
      if (mode === 'mri' && !mri) throw new Error('MRI must load before selecting MRI appearance.');
      if (mode === 'network' && !manifest.networks)
        throw new Error('This model carries no network layer.');
      if (mode === 'cab-np') {
        if (!cabNp) throw new Error('This model carries no CAB-NP partition.');
        if (values.atlas !== cabNp.atlas) {
          throw new Error(`CAB-NP colours ${cabNp.atlas} areas; show that atlas first.`);
        }
      }
      if (mode === 'functional') {
        if (!functionalRegions) throw new Error('This model carries no functional divisions.');
        if (values.atlas !== functionalRegions.atlas) {
          throw new Error(
            `Functional divisions colour ${functionalRegions.atlas} areas; show that atlas first.`,
          );
        }
        if (!glassSolids)
          throw new Error('Glass-brain solids must load before selecting functional divisions.');
      }
      values.surfaceColor = mode;
      update();
    },
    setCutState({ atlas, active }) {
      if (atlas === values.cutAtlas && active === values.cutActive) return;
      values.cutAtlas = atlas;
      values.cutActive = active;
      update();
    },
    loadLayer(id) {
      layers.add(id);
    },
    loadGlassSolids() {
      glassSolids = true;
    },
    attachMri() {
      mri = true;
    },
    dispose() {
      disposed = true;
    },
  };

  /** A region's geometry is downloaded: its atlas or detail layer is in. */
  function layerLoaded(region: Region): boolean {
    return layers.has(region.atlas ?? '');
  }

  return model;
}
