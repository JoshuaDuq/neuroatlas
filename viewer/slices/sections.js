import { Group, Plane, Vector3 } from 'three';
import { TissueSections } from '../tissues/gpu-sections.js';
import { centeredFrame, clippingPlane } from './coordinates.js';
import { renderSlice } from './sampling.js';
import { loadVolumes } from './volume.js';

const MODES = ['off', 'sagittal', 'coronal', 'axial', 'oblique'];

function projectBounds(bounds, normal) {
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
  ];
  const projections = corners.map(
    ([x, y, z]) => x * normal.x + y * normal.y + z * normal.z,
  );
  return [Math.min(...projections), Math.max(...projections)];
}

/** GPU categorical tissue cuts, with independent optional MRI reference views. */
export class BrainSections extends EventTarget {
  constructor(model, metadataUrl, tissues = new TissueSections(model, metadataUrl)) {
    super();
    this.model = model;
    this.metadataUrl = metadataUrl;
    this.tissues = tissues;
    this.group = new Group();
    this.group.name = 'GPU labelled brain sections';
    this.group.add(tissues.group);
    this.group.visible = false;
    this.volumes = null;
    this.pending = null;
    this.disposed = false;
    this.requestNumber = 0;
    this.appearanceRequest = 0;
    this.clipPlane = new Plane();
    this.state = {
      mode: 'off',
      // Which label volume the cut samples. It starts at the surface atlas and
      // then moves independently: a cut atlas need not have a surface at all.
      cutAtlas: model.state.atlas,
      crosshair: [0, 0, 0],
      reverse: false,
      overlay: false,
      tilt: 30,
      azimuth: 30,
      status: 'idle',
      error: null,
    };
    this.visibilityKey = '';
    this.onModelChange = () => {
      const s = model.state;
      const key = JSON.stringify([
        s.hemisphere,
        s.cortexVisible,
        s.cortexOpacity,
        s.isolatedRegion,
        s.internalSystem,
        s.surfaceColor,
        s.detail,
      ]);
      if (key === this.visibilityKey) return;
      this.visibilityKey = key;
      if (this.active) {
        if (this.tissues.layers.has(this.state.cutAtlas) &&
            this.tissues.hasDetail(s.detail)) this.update();
        else {
          this.group.visible = false;
          this.setMode(this.state.mode).catch((error) => this.report(error));
        }
      }
    };
    model.addEventListener('change', this.onModelChange);
    this.onModelChange();
  }

  get active() {
    return this.state.mode !== 'off';
  }
  get frame() {
    return centeredFrame(this.active ? this.state.mode : 'axial', this.state.crosshair, this.state);
  }

  get coordinateBounds() {
    const bounds = [[-128, -128, -128], [128, 128, 128]];
    for (const layer of this.model.manifest?.supplemental_layers ?? []) {
      for (let axis = 0; axis < 3; axis++) {
        bounds[0][axis] = Math.floor(Math.min(bounds[0][axis], layer.bounds_ras_mm[0][axis]));
        bounds[1][axis] = Math.ceil(Math.max(bounds[1][axis], layer.bounds_ras_mm[1][axis]));
      }
    }
    return bounds;
  }

  get coordinateLimit() {
    return Math.max(...this.coordinateBounds.flat().map(Math.abs));
  }

  get offsetRange() {
    if (this.state.mode === 'oblique') {
      return projectBounds(this.coordinateBounds, this.frame.normal);
    }
    const axis = { sagittal: 0, coronal: 1, axial: 2, off: 2 }[this.state.mode];
    return this.coordinateBounds.map(bound => bound[axis]);
  }

  /** Load native MRI only when the separate reference views are requested. */
  async load() {
    if (this.disposed) throw new Error('BrainSections is disposed.');
    if (this.volumes) return;
    if (this.pending) return this.pending;
    this.state.status = 'loading';
    this.emit();
    this.pending = loadVolumes(this.metadataUrl)
      .then((volumes) => {
        if (this.disposed) throw new Error('BrainSections disposed during loading.');
        this.volumes = volumes;
        const d = volumes.metadata.display;
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
      })
      .catch((error) => {
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
  async prepare() {
    this.state.status = 'loading';
    this.emit();
    let loaded = null;
    while (loaded !== this.state.cutAtlas) {
      loaded = this.state.cutAtlas;
      await this.tissues.load(loaded);
    }
    if (this.display) this.tissues.setWindow(this.display.windowCenter, this.display.windowWidth);
  }

  async setSurfaceColor(mode) {
    const request = ++this.appearanceRequest;
    if (mode === 'mri') {
      this.state.status = 'loading';
      this.emit();
      try {
        await this.tissues.loadAnatomy();
      } catch (error) {
        if (request === this.appearanceRequest && !this.disposed) this.report(error);
        throw error;
      }
      if (request !== this.appearanceRequest || this.disposed) return;
      if (this.display) this.tissues.setWindow(this.display.windowCenter, this.display.windowWidth);
      this.model.setMriAnatomy(this.tissues.anatomy);
    }
    this.model.setSurfaceColor(mode);
    this.state.status = 'ready';
    this.state.error = null;
    this.emit();
  }

  async setMode(mode) {
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
  }

  setCrosshair(point) {
    if (
      !Array.isArray(point) ||
      point.length !== 3 ||
      point.some((value) => !Number.isFinite(value) || Math.abs(value) > this.coordinateLimit)
    ) {
      throw new RangeError(`RAS crosshair must be within ±${this.coordinateLimit} mm.`);
    }
    this.state.crosshair = [...point];
    this.update();
  }

  setOffset(offset) {
    const [minimum, maximum] = this.offsetRange;
    if (!Number.isFinite(offset) || offset < minimum || offset > maximum)
      throw new RangeError(`Cut position must be between ${minimum} and ${maximum} mm.`);
    const frame = this.frame;
    const crosshair = new Vector3(...this.state.crosshair);
    if (this.state.mode === 'oblique') crosshair.copy(frame.normal).multiplyScalar(offset);
    else crosshair.addScaledVector(frame.normal, offset - crosshair.dot(frame.normal));
    this.setCrosshair(crosshair.toArray());
  }

  /**
   * Choose the label volume the cut samples, leaving the cortical surface as it
   * is. On failure the previous choice is restored, because the control renders
   * from this state and must not show an atlas that did not load.
   */
  async setCutAtlas(atlas) {
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
      this.state.cutAtlas = previous;
      this.report(error);
      throw error;
    }
    if (request !== this.requestNumber || this.disposed) return;
    this.update();
  }

  setAngles(tilt, azimuth) {
    centeredFrame('oblique', this.state.crosshair, { tilt, azimuth });
    Object.assign(this.state, { tilt, azimuth });
    this.update();
  }

  setDisplay({ reverse = this.state.reverse, overlay = this.state.overlay } = {}) {
    if (![reverse, overlay].every((value) => typeof value === 'boolean'))
      throw new TypeError('Section display options must be boolean.');
    const recut = reverse !== this.state.reverse;
    Object.assign(this.state, { reverse, overlay });
    if (recut) this.update();
    else this.emit();
  }

  /** Re-read the accent that marks a chosen cut face. */
  applyTheme() {
    this.tissues.markWith();
  }

  setWindow(center, width) {
    if (!this.display || !Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
      throw new RangeError('MRI window requires a finite center and positive width.');
    }
    this.display.windowCenter = center;
    this.display.windowWidth = width;
    this.tissues.setWindow(center, width);
    this.emit();
  }

  update() {
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

  pixels(frame) {
    return renderSlice(this.volumes, frame, { ...this.display, overlay: this.state.overlay });
  }

  sample(point) {
    const labelId = this.volumes.segmentation.nearest(point);
    const region = [...this.model.regions.values()].find(
      (region) => region.kind === 'structure' && region.source_label_id === labelId,
    );
    return {
      labelId,
      name: this.volumes.metadata.labels[labelId].name,
      region,
      intensity: this.volumes.mri.linear(point),
      ras: point,
    };
  }

  /** Light the cut faces of the pointed-at and the chosen region. */
  setHighlight(highlight) {
    this.tissues.setHighlight(highlight);
  }

  /** Intersect the nearest visible surface or categorical cut-face. */
  intersect(raycaster) {
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
  pick(raycaster) {
    const hit = this.intersect(raycaster);
    if (!hit) return null;
    if (hit.region !== undefined) return hit.region;
    return hit.object?.userData?.kind !== 'non-region'
      ? this.model.regions.get(hit.object.userData.region_id)
      : null;
  }

  report(error) {
    this.state.status = 'error';
    this.state.error = error.message;
    console.error(error);
    this.emit();
  }
  emit() {
    // The model owns display state; the plane is ours, so we report it there
    // rather than have visibility reach across for it.
    this.model.setCutState({ atlas: this.state.cutAtlas, active: this.active });
    this.dispatchEvent(new Event('change'));
  }

  dispose() {
    this.disposed = true;
    this.requestNumber++;
    this.model.removeEventListener('change', this.onModelChange);
    this.tissues.dispose();
    this.model.setClippingPlanes([]);
    this.group.removeFromParent();
  }
}
