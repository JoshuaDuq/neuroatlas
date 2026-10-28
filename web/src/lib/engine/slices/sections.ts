import { Group, Plane, Vector3 } from 'three';
import type { Intersection, Raycaster } from 'three';
import type { CutMode, Region } from '../../types/index.ts';
import { TissueSections } from '../tissues/gpu-sections.ts';
import type {
  Anatomy,
  CutHit,
  CutModel,
  Highlight,
  VolumeMetadata,
} from '../tissues/gpu-sections.ts';
import { centeredFrame, clippingPlane } from './coordinates.ts';
import type { Frame, Ras } from './coordinates.ts';
import { renderSlice } from './sampling.ts';
import { loadVolume } from './volume.ts';
import type { Volume } from './volume.ts';
import type { SurfaceColor } from '../../types/index.ts';

const MODES: readonly CutMode[] = ['off', 'sagittal', 'coronal', 'axial', 'oblique'];

type Bounds = [[number, number, number], [number, number, number]];
type SectionsStatus = 'idle' | 'loading' | 'ready' | 'error';
type SectionsErrorCode = 'asset-fetch' | 'asset-updated' | 'cut-failed';

interface SectionsStateRecord {
  mode: CutMode;
  /**
   * Which label volume the cut samples. It starts at the surface atlas and
   * then moves independently: a cut atlas need not have a surface at all.
   */
  cutAtlas: string;
  crosshair: [number, number, number];
  reverse: boolean;
  overlay: boolean;
  tilt: number;
  azimuth: number;
  status: SectionsStatus;
  error: SectionsErrorCode | null;
}

/** The model as the sections drive it: the cut's own model plus the display commands it issues. */
export interface SectionsModel extends CutModel {
  readonly clippingPlanes: readonly Plane[];
  setClippingPlanes(planes: Plane[]): void;
  setCutState(state: { atlas: string; active: boolean }): void;
  setMriAnatomy(anatomy: Anatomy | null): void;
  setSurfaceColor(mode: string): void;
  intersect(raycaster: Raycaster): (Intersection & { region?: Region | null }) | null;
}

interface LoadedVolumes {
  metadata: VolumeMetadata;
  mri: Volume;
  segmentation: Volume;
}

interface MriDisplay {
  fieldOfView: number;
  size: number;
  windowCenter: number;
  windowWidth: number;
}

function projectBounds(bounds: Bounds, normal: Vector3): [number, number] {
  const [min, max] = bounds;
  const corners = [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ] as const;
  const projections = corners.map(([x, y, z]) => x * normal.x + y * normal.y + z * normal.z);
  return [Math.min(...projections), Math.max(...projections)];
}

const isCode = (error: unknown): error is { code: string } =>
  typeof error === 'object' && error !== null && 'code' in error;

/** GPU categorical tissue cuts, with independent optional MRI reference views. */
export class BrainSections extends EventTarget {
  readonly model: SectionsModel;
  readonly metadataUrl: string | URL;
  readonly tissues: TissueSections;
  readonly group = new Group();
  volumes: LoadedVolumes | null = null;
  display: MriDisplay | null = null;
  readonly state: SectionsStateRecord;
  private pending: Promise<void> | null = null;
  private disposed = false;
  private requestNumber = 0;
  /** The cut atlas whose volume last finished loading: what a failed choice returns to. */
  private loadedCutAtlas: string | null = null;
  private appearanceRequest = 0;
  private readonly clipPlane = new Plane();
  private visibilityKey = '';
  private readonly onModelChange: () => void;

  constructor(
    model: SectionsModel,
    metadataUrl: string | URL,
    tissues: TissueSections = new TissueSections(model, metadataUrl),
  ) {
    super();
    this.model = model;
    this.metadataUrl = metadataUrl;
    this.tissues = tissues;
    this.group.name = 'GPU labelled brain sections';
    this.group.add(tissues.group);
    this.group.visible = false;
    this.state = {
      mode: 'off',
      cutAtlas: model.state.atlas,
      crosshair: [0, 0, 0],
      reverse: false,
      overlay: false,
      tilt: 30,
      azimuth: 30,
      status: 'idle',
      error: null,
    };
    this.onModelChange = () => {
      const s = model.state;
      const key = JSON.stringify([
        s.hemisphere,
        s.cortexVisible,
        s.cortexOpacity,
        s.isolatedRegion,
        s.internalSystem,
        s.internalVisible,
        s.surfaceColor,
        s.paint?.id ?? null,
        s.detail,
        s.spinalCordVisible,
        [...(s.hiddenRegions ?? [])].sort(),
      ]);
      if (key === this.visibilityKey) return;
      this.visibilityKey = key;
      if (this.active) {
        const [minimum, maximum] = this.offsetRange;
        const offset = new Vector3(...this.state.crosshair).dot(this.frame.normal);
        if (offset < minimum || offset > maximum) {
          this.setOffset(Math.min(maximum, Math.max(minimum, offset)));
          return;
        }
        const detailReady = this.tissues.hasDetail(s.detail);
        if (this.tissues.layers.has(this.state.cutAtlas) && detailReady) this.update();
        else {
          this.group.visible = false;
          // `setMode` has already reported the failure before rejecting.
          this.setMode(this.state.mode).catch(() => {});
        }
      }
    };
    model.addEventListener('change', this.onModelChange);
    this.onModelChange();
  }

  get active(): boolean {
    return this.state.mode !== 'off';
  }

  /** Whether a cut can be drawn without first downloading the tissue envelopes it caps. */
  get solidsReady(): boolean {
    return Boolean(this.tissues.solidsReady);
  }

  get frame(): Frame {
    return centeredFrame(this.active ? this.state.mode : 'axial', this.state.crosshair, this.state);
  }

  get coordinateBounds(): Bounds {
    const bounds: Bounds = [
      [-128, -128, -128],
      [128, 128, 128],
    ];
    // The cord hangs hundreds of millimetres below the brain. While it is
    // hidden, folding that tail into the range stretches the axial slider
    // across empty space and the millimetre readout no longer tracks the brain.
    const cordShown = Boolean(this.model.state.spinalCordVisible);
    for (const layer of this.model.manifest.supplemental_layers ?? []) {
      if (layer.id === 'pam50' && !cordShown) continue;
      if (!layer.bounds_ras_mm) continue;
      for (let axis = 0; axis < 3; axis++) {
        bounds[0][axis] = Math.floor(Math.min(bounds[0][axis]!, layer.bounds_ras_mm[0]![axis]!));
        bounds[1][axis] = Math.ceil(Math.max(bounds[1][axis]!, layer.bounds_ras_mm[1]![axis]!));
      }
    }
    return bounds;
  }

  get coordinateLimit(): number {
    return Math.max(...this.coordinateBounds.flat().map(Math.abs));
  }

  /**
   * Where the plane may sit along its normal. An oblique crosshair is the
   * plane's foot on the normal, so the range also stops where that point would
   * leave the coordinate limit: every offset in it is then a legal cut.
   */
  get offsetRange(): [number, number] {
    if (this.state.mode === 'oblique') {
      const { normal } = this.frame;
      const [minimum, maximum] = projectBounds(this.coordinateBounds, normal);
      // A hair inside, so float rounding cannot put the foot a fraction past the limit.
      const reach =
        (this.coordinateLimit /
          Math.max(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z))) *
        (1 - 1e-12);
      return [Math.max(minimum, -reach), Math.min(maximum, reach)];
    }
    const axis = { sagittal: 0, coronal: 1, axial: 2, off: 2 }[this.state.mode];
    const [low, high] = this.coordinateBounds;
    return [low[axis], high[axis]];
  }

  /**
   * Load the linked MRI views: the T1 the cut and MRI colour already hold,
   * plus the segmentation, which only these views read.
   */
  async load(): Promise<void> {
    if (this.disposed) throw new Error('BrainSections is disposed.');
    if (this.volumes) return;
    if (this.pending) return this.pending;
    this.state.status = 'loading';
    this.emit();
    this.pending = (async () => {
      const metadata = await this.tissues.loadVolumeMetadata();
      const [anatomy, segmentation] = await Promise.all([
        this.tissues.loadMri(),
        loadVolume(metadata.segmentation, this.metadataUrl),
      ]);
      if (this.disposed) throw new Error('BrainSections disposed during loading.');
      this.volumes = { metadata, mri: anatomy.volume, segmentation };
      const d = metadata.display;
      this.display = {
        fieldOfView: d.field_of_view_mm,
        size: d.texture_size,
        windowCenter: d.window_center,
        windowWidth: d.window_width,
      };
      this.tissues.setWindow(this.display.windowCenter, this.display.windowWidth);
      this.state.status = 'ready';
      this.state.error = null;
      this.emit();
    })()
      .catch((error: unknown) => {
        this.report(error);
        throw error;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  /**
   * Load whatever the cut currently needs, and only then let it draw.
   *
   * The chosen atlas can change while a load is in flight, so the choice is
   * re-read after every await: resuming with a stale one would draw from a
   * layer that was never loaded. `update` may assume the current layer exists.
   */
  async prepare(): Promise<void> {
    this.state.status = 'loading';
    this.emit();
    let loaded: string | null = null;
    while (loaded !== this.state.cutAtlas) {
      loaded = this.state.cutAtlas;
      await this.tissues.load(loaded);
    }
    this.loadedCutAtlas = loaded;
    if (this.display) this.tissues.setWindow(this.display.windowCenter, this.display.windowWidth);
  }

  /**
   * Colour the surface. `current` is the scene command's intent check: a later
   * command, or a later colour, overtakes this one, and the download it waited
   * on then lands without changing the colour.
   */
  async setSurfaceColor(mode: SurfaceColor, current: () => boolean = () => true): Promise<void> {
    const request = ++this.appearanceRequest;
    const live = () => request === this.appearanceRequest && !this.disposed && current();
    // Overtaken by another command rather than another colour, the loading this began is over.
    const settle = () => {
      if (request !== this.appearanceRequest || this.disposed || this.state.status !== 'loading')
        return;
      this.state.status = 'ready';
      this.emit();
    };
    if (mode === 'mri') {
      this.state.status = 'loading';
      this.emit();
      try {
        await this.tissues.loadMri();
      } catch (error) {
        if (live()) this.report(error);
        else settle();
        throw error;
      }
      if (!live()) return settle();
      if (this.display) this.tissues.setWindow(this.display.windowCenter, this.display.windowWidth);
      this.model.setMriAnatomy(this.tissues.anatomy);
    }
    this.model.setSurfaceColor(mode);
    this.state.status = 'ready';
    this.state.error = null;
    this.emit();
  }

  async setMode(mode: CutMode): Promise<void> {
    if (!MODES.includes(mode)) throw new Error(`Unknown cut mode: ${mode}`);
    const request = ++this.requestNumber;
    if (mode !== 'off') {
      try {
        await this.prepare();
      } catch (error) {
        this.report(error);
        throw error;
      }
    }
    if (request !== this.requestNumber || this.disposed) return;
    this.state.mode = mode;
    this.update();
    if (mode !== 'off') this.tissues.solids.warm();
  }

  setCrosshair(point: Ras): void {
    if (
      !Array.isArray(point) ||
      point.length !== 3 ||
      point.some((value) => !Number.isFinite(value) || Math.abs(value) > this.coordinateLimit)
    ) {
      throw new RangeError(`RAS crosshair must be within ±${this.coordinateLimit} mm.`);
    }
    this.state.crosshair = [point[0], point[1], point[2]];
    this.update();
  }

  setOffset(offset: number): void {
    this.setCrosshair(this.crosshairFor(offset));
  }

  /**
   * Move the plane without blocking the pointer. The picture stays on the last
   * complete cut until the next caps are ready, then surface and cap land together.
   */
  async setOffsetReady(offset: number): Promise<void> {
    const point = this.crosshairFor(offset);
    await this.commitFrame(
      centeredFrame(this.active ? this.state.mode : 'axial', point, this.state),
      () => {
        this.state.crosshair = point;
      },
    );
  }

  async setAnglesReady(tilt: number, azimuth: number): Promise<void> {
    const frame = centeredFrame('oblique', this.state.crosshair, { tilt, azimuth });
    await this.commitFrame(frame, () => {
      Object.assign(this.state, { tilt, azimuth });
    });
  }

  crosshairFor(offset: number): [number, number, number] {
    const [minimum, maximum] = this.offsetRange;
    if (!Number.isFinite(offset) || offset < minimum || offset > maximum)
      throw new RangeError(`Cut position must be between ${minimum} and ${maximum} mm.`);
    const frame = this.frame;
    const crosshair = new Vector3(...this.state.crosshair);
    if (this.state.mode === 'oblique') crosshair.copy(frame.normal).multiplyScalar(offset);
    else crosshair.addScaledVector(frame.normal, offset - crosshair.dot(frame.normal));
    const point = crosshair.toArray();
    if (point.some((value) => Math.abs(value) > this.coordinateLimit))
      throw new RangeError(`RAS crosshair must be within ±${this.coordinateLimit} mm.`);
    return point;
  }

  async commitFrame(frame: Frame, assign: () => void): Promise<void> {
    if (!this.active) {
      assign();
      this.update();
      return;
    }
    const plane = clippingPlane(frame, this.state.reverse);
    const generation = this.tissues.solids.generation;
    const built = await this.tissues.solids.build(plane);
    // Closing the cut does not bump the generation, so a build landing after it is stale too.
    if (this.disposed || !this.active || generation !== this.tissues.solids.generation) return;
    if (!built) {
      assign();
      this.update();
      return;
    }
    assign();
    if (!this.tissues.solids.applyBuild(plane, built, generation)) return;
    this.group.visible = true;
    this.clipPlane.copy(plane);
    if (this.model.clippingPlanes[0] !== this.clipPlane)
      this.model.setClippingPlanes([this.clipPlane]);
    this.state.status = 'ready';
    this.state.error = null;
    this.emit();
  }

  /**
   * Choose the label volume the cut samples, leaving the cortical surface as it
   * is. On failure the previous choice is restored, because the control renders
   * from this state and must not show an atlas that did not load.
   */
  async setCutAtlas(atlas: string): Promise<void> {
    if (atlas === this.state.cutAtlas) return;
    const previous = this.state.cutAtlas;
    this.state.cutAtlas = atlas;
    if (!this.active) {
      this.emit();
      return;
    }
    const request = ++this.requestNumber;
    try {
      await this.prepare();
    } catch (error) {
      // Only a failure of the atlas the state still names rolls it back, and it
      // returns to an atlas that loaded, not to a choice that never did.
      if (this.state.cutAtlas === atlas) this.state.cutAtlas = this.loadedCutAtlas ?? previous;
      if (request === this.requestNumber) this.report(error);
      throw error;
    }
    if (request !== this.requestNumber || this.disposed) return;
    this.update();
  }

  setAngles(tilt: number, azimuth: number): void {
    centeredFrame('oblique', this.state.crosshair, { tilt, azimuth });
    Object.assign(this.state, { tilt, azimuth });
    this.update();
  }

  setDisplay({
    reverse = this.state.reverse,
    overlay = this.state.overlay,
  }: { reverse?: boolean; overlay?: boolean } = {}): void {
    if (![reverse, overlay].every((value) => typeof value === 'boolean'))
      throw new TypeError('Section display options must be boolean.');
    const recut = reverse !== this.state.reverse;
    Object.assign(this.state, { reverse, overlay });
    if (recut) this.update();
    else this.emit();
  }

  /** Re-read the accent that marks a chosen cut face. */
  applyTheme(): void {
    this.tissues.markWith();
  }

  setWindow(center: number, width: number): void {
    if (!this.display || !Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
      throw new RangeError('MRI window requires a finite center and positive width.');
    }
    this.display.windowCenter = center;
    this.display.windowWidth = width;
    this.tissues.setWindow(center, width);
    this.emit();
  }

  update(): void {
    if (!this.active) {
      this.group.visible = false;
      this.model.setClippingPlanes([]);
      this.state.status = 'ready';
      this.emit();
      return;
    }
    const frame = this.frame,
      reverse = this.state.reverse;

    try {
      this.tissues.update(frame, this.state.cutAtlas, reverse);
      if (this.disposed) return;
      this.group.visible = true;
      this.clipPlane.copy(clippingPlane(frame, reverse));
      if (this.model.clippingPlanes[0] !== this.clipPlane) {
        this.model.setClippingPlanes([this.clipPlane]);
      }
      this.state.status = 'ready';
      this.state.error = null;
      this.emit();
    } catch (error) {
      this.report(error);
    }
  }

  pixels(frame: Frame): Uint8ClampedArray {
    const { volumes, display } = this;
    if (!volumes || !display) throw new Error('The linked MRI has not loaded.');
    return renderSlice(
      {
        mri: volumes.mri,
        segmentation: volumes.segmentation,
        metadata: { labels: volumes.metadata.labels },
      },
      frame,
      { ...display, overlay: this.state.overlay },
    );
  }

  sample(point: Ras): {
    labelId: number;
    name: string;
    region: Region | undefined;
    intensity: number;
    ras: Ras;
  } {
    const { volumes } = this;
    if (!volumes) throw new Error('The linked MRI has not loaded.');
    const labelId = volumes.segmentation.label(point);
    // The linked segmentation is aseg; other atlases reuse its label numbers.
    const region = [...this.model.regions.values()].find(
      (region) =>
        region.atlas === 'aseg' &&
        region.kind === 'structure' &&
        region.source_label_id === labelId,
    );
    return {
      labelId,
      name: volumes.metadata.labels[labelId]!.name,
      region,
      intensity: volumes.mri.linear(point),
      ras: point,
    };
  }

  /** Light the cut faces of the pointed-at and the chosen region. */
  setHighlight(highlight: Highlight): void {
    this.tissues.setHighlight(highlight);
  }

  /** Intersect the nearest visible surface or categorical cut-face. */
  intersect(raycaster: Raycaster): CutHit | null {
    const surfaceHit = this.model.intersect(raycaster);
    if (this.group.visible) {
      this.group.updateMatrixWorld(true);
      const cap = this.tissues.intersect(raycaster);
      if (cap && (!surfaceHit || cap.distance < surfaceHit.distance + 1e-9)) {
        return cap;
      }
    }
    return surfaceHit;
  }

  /** Pick the nearest visible surface or categorical cut-face label. */
  pick(raycaster: Raycaster): Region | null | undefined {
    const hit = this.intersect(raycaster);
    console.log(
      '[pick-debug]',
      hit && hit.object?.name,
      hit && ('region' in hit ? hit.region?.id : hit.object?.userData),
      hit?.distance,
    );
    if (!hit) return null;
    if ('region' in hit && hit.region !== undefined) return hit.region;
    return hit.object.userData['kind'] !== 'non-region'
      ? this.model.regions.get(hit.object.userData['region_id'] as string)
      : null;
  }

  /** The status carries a code for the app to word: `asset-fetch`, `asset-updated` or `cut-failed`. */
  report(error: unknown): void {
    this.state.status = 'error';
    this.state.error =
      isCode(error) && (error.code === 'asset-fetch' || error.code === 'asset-updated')
        ? error.code
        : 'cut-failed';
    console.error(error);
    this.emit();
  }

  emit(): void {
    // The model owns display state; the plane is ours, so we report it there
    // rather than have visibility reach across for it.
    this.model.setCutState({ atlas: this.state.cutAtlas, active: this.active });
    this.dispatchEvent(new Event('change'));
  }

  dispose(): void {
    this.disposed = true;
    this.requestNumber++;
    this.model.removeEventListener('change', this.onModelChange);
    this.tissues.dispose();
    this.model.setClippingPlanes([]);
    this.group.removeFromParent();
  }
}
