import {
  DataTexture, DoubleSide, Group, LinearFilter, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry,
  RGBAFormat, SRGBColorSpace, Vector3,
} from 'three';
import { centeredFrame, clippingPlane, rasToWorld, worldToRas } from './coordinates.js';
import { renderSlice } from './sampling.js';
import { loadVolumes } from './volume.js';

const MODES = ['off', 'sagittal', 'coronal', 'axial', 'oblique'];

/** Registered MRI cut face and clipping; never modifies source mesh geometry. */
export class BrainSections extends EventTarget {
  constructor(model, metadataUrl) {
    super();
    this.model = model;
    this.metadataUrl = metadataUrl;
    this.group = new Group();
    this.group.name = 'Registered MRI sections';
    this.group.visible = false;
    this.volumes = null;
    this.pending = null;
    this.face = null;
    this.disposed = false;
    this.requestNumber = 0;
    this.textureKey = null;
    this.state = {
      mode: 'off', crosshair: [0,0,0], reverse: false, showMRI: true,
      overlay: false, tilt: 30, azimuth: 30, status: 'idle', error: null,
    };
  }

  get active() { return this.state.mode !== 'off'; }

  get frame() {
    return centeredFrame(this.active ? this.state.mode : 'axial', this.state.crosshair, this.state);
  }

  async load() {
    if (this.disposed) throw new Error('BrainSections is disposed.');
    if (this.volumes) return;
    if (this.pending) return this.pending;
    this.state.status = 'loading';
    this.emit();
    this.pending = loadVolumes(this.metadataUrl).then(volumes => {
      if (this.disposed) throw new Error('BrainSections disposed during loading.');
      this.volumes = volumes;
      const d = volumes.metadata.display;
      this.display = { fieldOfView: d.field_of_view_mm, size: d.texture_size,
        windowCenter: d.window_center, windowWidth: d.window_width, overlay: false };
      this.createFace();
      this.state.status = 'ready';
      this.state.error = null;
      this.emit();
    }).catch(error => {
      this.state.status = 'error';
      this.state.error = error.message;
      this.emit();
      throw error;
    }).finally(() => { this.pending = null; });
    return this.pending;
  }

  createFace() {
    const texture = new DataTexture(new Uint8Array(this.display.size**2*4),
      this.display.size, this.display.size, RGBAFormat);
    texture.flipY = true;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: texture, side: DoubleSide, alphaTest: .5, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.face = new Mesh(new PlaneGeometry(this.display.fieldOfView/1000, this.display.fieldOfView/1000), material);
    this.face.name = 'Source MRI on cutting plane';
    this.group.add(this.face);
  }

  async setMode(mode) {
    if (!MODES.includes(mode)) throw new Error(`Unknown cut mode: ${mode}`);
    const request = ++this.requestNumber;
    if (mode !== 'off') await this.load();
    if (request !== this.requestNumber || this.disposed) return;
    this.state.mode = mode;
    this.update();
  }

  setCrosshair(point) {
    if (!Array.isArray(point) || point.length !== 3 ||
        point.some(value => !Number.isFinite(value) || Math.abs(value) > 128)) {
      throw new RangeError('RAS crosshair must be within ±128 mm.');
    }
    this.state.crosshair = [...point];
    this.update();
  }

  setOffset(offset) {
    if (!Number.isFinite(offset) || Math.abs(offset) > 128) throw new RangeError('Cut position must be within ±128 mm.');
    const frame = this.frame;
    const crosshair = new Vector3(...this.state.crosshair);
    // For oblique browsing, move along the plane normal through the origin.
    // This keeps every permitted offset valid regardless of the last MPR click.
    if (this.state.mode === 'oblique') crosshair.copy(frame.normal).multiplyScalar(offset);
    else crosshair.addScaledVector(frame.normal, offset - crosshair.dot(frame.normal));
    this.setCrosshair(crosshair.toArray());
  }

  setAngles(tilt, azimuth) {
    centeredFrame('oblique', this.state.crosshair, { tilt, azimuth });
    Object.assign(this.state, { tilt, azimuth });
    this.update();
  }

  setDisplay({ reverse = this.state.reverse, showMRI = this.state.showMRI,
    overlay = this.state.overlay } = {}) {
    if (![reverse,showMRI,overlay].every(value => typeof value === 'boolean')) throw new TypeError('Section display options must be boolean.');
    Object.assign(this.state, { reverse, showMRI, overlay });
    this.update();
  }

  setWindow(center, width) {
    if (!this.display || !Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
      throw new RangeError('MRI window requires a finite center and positive width.');
    }
    this.display.windowCenter = center;
    this.display.windowWidth = width;
    this.update();
  }

  update() {
    this.group.visible = this.active && this.state.showMRI;
    if (this.active) {
      const frame = this.frame;
      const rotation = new Matrix4().makeBasis(
        rasToWorld(frame.u.toArray()).normalize(), rasToWorld(frame.v.toArray()).normalize(),
        rasToWorld(new Vector3().crossVectors(frame.u, frame.v).toArray()).normalize());
      this.face.quaternion.setFromRotationMatrix(rotation);
      this.face.position.copy(rasToWorld(frame.center.toArray()));
      const key = JSON.stringify([frame.center,frame.u,frame.v,this.state.overlay,this.display]);
      if (key !== this.textureKey) {
        this.face.material.map.image.data = this.pixels(frame);
        this.face.material.map.needsUpdate = true;
        this.textureKey = key;
      }
      this.model.setClippingPlanes([clippingPlane(frame, this.state.reverse)]);
    } else {
      this.model.setClippingPlanes([]);
    }
    this.emit();
  }

  pixels(frame) {
    return renderSlice(this.volumes, frame, { ...this.display, overlay: this.state.overlay });
  }

  sample(point) {
    const labelId = this.volumes.segmentation.nearest(point);
    const region = [...this.model.regions.values()].find(region =>
      region.kind === 'structure' && region.source_label_id === labelId);
    return { labelId, name: this.volumes.metadata.labels[labelId].name, region,
      intensity: this.volumes.mri.linear(point), ras: point };
  }

  /** An opaque MRI face occludes meshes behind it, including unlabelled tissue. */
  pick(raycaster) {
    const surfaceHit = this.model.intersect(raycaster);
    if (this.group.visible) {
      this.group.updateMatrixWorld(true);
      const hit = raycaster.intersectObject(this.face)[0];
      if (hit && (!surfaceHit || hit.distance < surfaceHit.distance)) {
        const sample = this.sample(worldToRas(hit.point));
        if (sample.labelId) {
          return sample.region && this.model.visibleMeshes.some(mesh => mesh.userData.region_id === sample.region.id)
            ? sample.region : null;
        }
      }
    }
    return surfaceHit && surfaceHit.object.userData.kind !== 'non-region'
      ? this.model.regions.get(surfaceHit.object.userData.region_id) : null;
  }

  emit() { this.dispatchEvent(new Event('change')); }

  dispose() {
    this.disposed = true;
    this.requestNumber += 1;
    if (this.face) {
      this.face.material.map.dispose();
      this.face.material.dispose();
      this.face.geometry.dispose();
    }
    this.model.setClippingPlanes([]);
    this.group.removeFromParent();
  }
}
