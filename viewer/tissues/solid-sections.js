import {
  AlwaysStencilFunc, BackSide, Box3, BufferAttribute, BufferGeometry, DecrementWrapStencilOp, DoubleSide,
  FrontSide, Group, IncrementWrapStencilOp, Matrix3, Mesh, MeshBasicMaterial,
  NotEqualStencilFunc, Plane, PlaneGeometry, Quaternion, Raycaster, ReplaceStencilOp,
  Sphere, Vector3,
} from 'three';
import { sectionTriangles } from './plane-section.js';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import { liftFor } from './highlight.js';

const CAP_NORMAL = new Vector3(0, 0, 1);
const BOUNDS_CENTER = new Vector3();
const BOUNDS_SIZE = new Vector3();
const PLANE_CENTER = new Vector3();
const PLANE_ROTATION = new Quaternion();
const SECTION_POINT = new Vector3();
const INSIDE_NORMALS = new Matrix3();
const INSIDE_NORMAL = new Vector3();

function clearStencil(renderer) {
  renderer.clearStencil();
}

/** A sphere around the vertices actually drawn, so a spare buffer tail is not part of it. */
function boundDrawn(geometry, vertexCount) {
  const array = geometry.getAttribute('position').array;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const x = array[i * 3];
    const y = array[i * 3 + 1];
    const z = array[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  const sphere = geometry.boundingSphere ?? (geometry.boundingSphere = new Sphere());
  sphere.center.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  let radius = 0;
  for (let i = 0; i < vertexCount; i++) {
    radius = Math.max(radius, SECTION_POINT.set(
      array[i * 3], array[i * 3 + 1], array[i * 3 + 2],
    ).distanceTo(sphere.center));
  }
  sphere.radius = radius;
}

/** Every solid's inside test reads both faces: the exit from inside a closed surface is a back face. */
const PROBE = new MeshBasicMaterial({ side: DoubleSide });

function stencilMaterial(plane, side, operation) {
  return new MeshBasicMaterial({
    side, clippingPlanes: [plane], colorWrite: false,
    depthWrite: false, depthTest: false, stencilWrite: true,
    stencilFunc: AlwaysStencilFunc,
    stencilFail: operation, stencilZFail: operation, stencilZPass: operation,
  });
}

/**
 * Cap closed anatomical surfaces using Three.js's winding-count stencil method.
 *
 * A source's geometry and BVH stay its owner's: the model's meshes are shared
 * with the cut, not copied, so they are never disposed here.
 */
export class SolidSections {
  constructor() {
    this.group = new Group();
    this.group.name = 'Solid anatomical tissue cuts';
    this.plane = new Plane();
    this.geometry = new PlaneGeometry(1, 1);
    this.solids = [];
    this.bounds = new Box3();
    this.insideRay = new Raycaster();
    this.nextSolidId = 1;
    this.generation = 0;
    this.worker = null;
    this.workerFailed = false;
    this.disposed = false;
    this.builds = new Map();
    this.buildToken = 0;
  }

  add(source, material, band) {
    source.updateWorldMatrix(true, false);
    const { geometry } = source;
    geometry.boundsTree ??= computeBoundsTree.call(geometry, { indirect: true });
    // The sectioner walks triangles in source order, which only an indirect BVH keeps.
    if (!geometry.boundsTree.indirect) throw new Error('Solid sources need an indirect BVH.');
    const probe = new Mesh(geometry, PROBE);
    probe.matrixAutoUpdate = false;
    probe.matrix.copy(source.matrixWorld);
    probe.matrixWorld.copy(source.matrixWorld);
    probe.raycast = acceleratedRaycast;
    const group = new Group();
    const back = new Mesh(source.geometry,
      stencilMaterial(this.plane, BackSide, IncrementWrapStencilOp));
    const front = new Mesh(source.geometry,
      stencilMaterial(this.plane, FrontSide, DecrementWrapStencilOp));
    for (const mask of [back, front]) {
      mask.applyMatrix4(source.matrixWorld);
      mask.frustumCulled = false;
    }
    back.renderOrder = 0;
    front.renderOrder = 1;
    Object.assign(material, {
      side: DoubleSide,
      stencilWrite: true, stencilRef: 0, stencilFunc: NotEqualStencilFunc,
      stencilFail: ReplaceStencilOp, stencilZFail: ReplaceStencilOp,
      stencilZPass: ReplaceStencilOp,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const cap = new Mesh(this.geometry, material);
    cap.renderOrder = 2;
    cap.frustumCulled = false;
    cap.onAfterRender = clearStencil;
    group.add(back, front, cap);
    this.group.add(group);
    source.geometry.computeBoundingBox();
    const bounds = source.geometry.boundingBox.clone().applyMatrix4(source.matrixWorld);
    this.solids.push({
      source, probe, bounds, group, back, front, cap, band,
      id: this.nextSolidId++,
      // Until the painter says otherwise: an envelope answers for no region
      // until it is painted as one, and a parcel wedge answers for its own.
      region: source.userData.region_id ?? null, visible: true,
    });
    this.reorder();
  }

  /**
   * Every cap lies on the one plane, so what draws last is what shows.
   *
   * Bands keep that answer independent of load order: an atlas's parcel solids
   * arrive after the envelopes and a detail level's nuclei can arrive after
   * either, but a nucleus still covers the ribbon reconstructed around it.
   *
   * Within the same band, larger enclosing solids draw before smaller nested
   * solids, and each solid receives a tiered polygon offset so co-planar caps
   * never z-fight.
   */
  reorder() {
    this.bounds.makeEmpty();
    for (const solid of this.solids) this.bounds.union(solid.bounds);
    this.solids.sort((a, b) => {
      if (a.band !== b.band) return a.band - b.band;
      const volumeA = a.source.userData?.segmentation_volume_mm3 ?? 0;
      const volumeB = b.source.userData?.segmentation_volume_mm3 ?? 0;
      return volumeB - volumeA;
    });
    for (const [at, solid] of this.solids.entries()) {
      solid.group.renderOrder = at + 1;
      solid.cap.material.polygonOffset = true;
      solid.cap.material.polygonOffsetFactor = -1;
      solid.cap.material.polygonOffsetUnits = -1 - at;
    }
  }

  /**
   * Place each cap on the plane.
   *
   * A manifold solid is drawn as the triangles of its surface cut by the
   * plane. Stencilling the whole mesh — hundreds of parcel solids, twice —
   * is what made exploring a cut drop frames. A non-manifold intersection
   * keeps that stencil cap, which is already the accurate face there.
   *
   * `visible` is whoever painted the solid last saying whether it belongs in
   * this cut; an atlas contributes hundreds of parcel solids, so the ones the
   * plane misses are dropped here rather than drawn empty.
   */
  update(plane) {
    this.generation += 1;
    const moved = plane.constant !== this.plane.constant
      || plane.normal.distanceToSquared(this.plane.normal) > 0;
    this.orient(plane);
    for (const solid of this.solids) {
      const show = solid.visible && plane.intersectsBox(solid.bounds);
      if (!show) {
        solid.group.visible = false;
        solid.cutShow = false;
        // Nothing was cut for this plane, so a solid shown again must be cut then.
        solid.cutReady = false;
        continue;
      }
      if (!moved && solid.cutReady) {
        solid.group.visible = solid.cutShow;
        continue;
      }
      this.place(solid, sectionTriangles(solid.source.geometry, solid.source.matrixWorld, this.plane));
    }
  }

  /**
   * Build caps off the pointer thread. Null means the caller should build here.
   * A drag can then keep the last complete cut on screen until the next one is
   * finished, instead of freezing the page inside the build.
   */
  build(plane) {
    const worker = this.ensureWorker();
    if (!worker) return Promise.resolve(null);
    const jobs = [];
    const local = [];
    for (const solid of this.solids) {
      if (!solid.visible || !plane.intersectsBox(solid.bounds)) continue;
      if (!this.postSolid(solid)) {
        local.push({
          id: solid.id,
          ...sectionTriangles(solid.source.geometry, solid.source.matrixWorld, plane),
        });
        continue;
      }
      jobs.push({ id: solid.id, matrix: Array.from(solid.source.matrixWorld.elements) });
    }
    if (!jobs.length) return Promise.resolve(local);
    const token = ++this.buildToken;
    return new Promise(resolve => {
      this.builds.set(token, { resolve, local });
      worker.postMessage({
        type: 'cut',
        token,
        normal: [plane.normal.x, plane.normal.y, plane.normal.z],
        constant: plane.constant,
        jobs,
      });
    });
  }

  /** Install a build from `build`, dropping it when a synchronous update won. */
  applyBuild(plane, sections, generation) {
    if (generation !== this.generation) return false;
    this.orient(plane);
    const byId = new Map(sections.map(section => [section.id, section]));
    for (const solid of this.solids) {
      const show = solid.visible && plane.intersectsBox(solid.bounds);
      if (!show) {
        solid.group.visible = false;
        solid.cutShow = false;
        solid.cutReady = false;
        continue;
      }
      this.place(solid, byId.get(solid.id) ?? { empty: true });
    }
    return true;
  }

  /** Copy geometry to the worker ahead of the first drag. */
  warm() {
    const run = () => {
      if (!this.ensureWorker()) return;
      for (const solid of this.solids) this.postSolid(solid);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run);
    else setTimeout(run, 0);
  }

  orient(plane) {
    this.plane.copy(plane);
    this.bounds.getCenter(BOUNDS_CENTER);
    this.capDiameter = this.bounds.getSize(BOUNDS_SIZE).length() || 1;
    plane.projectPoint(BOUNDS_CENTER, PLANE_CENTER);
    PLANE_ROTATION.setFromUnitVectors(CAP_NORMAL, plane.normal);
  }

  place(solid, section) {
    solid.cutShow = Boolean(section?.positions || section?.fallback);
    solid.cutReady = true;
    solid.group.visible = solid.cutShow;
    if (section?.positions) this.presentSection(solid, section.positions);
    else if (section?.fallback) this.presentStencil(solid);
  }

  ensureWorker() {
    if (this.workerFailed || this.disposed) return null;
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') {
      this.workerFailed = true;
      return null;
    }
    try {
      this.worker = new Worker(new URL('./section-worker.js', import.meta.url), { type: 'module' });
    } catch {
      this.workerFailed = true;
      return null;
    }
    this.worker.onmessage = event => {
      const pending = this.builds.get(event.data.token);
      if (!pending) return;
      this.builds.delete(event.data.token);
      pending.resolve([...pending.local, ...event.data.results]);
    };
    this.worker.onerror = event => {
      console.error(event.message || 'Cut build failed');
      this.workerFailed = true;
      for (const pending of this.builds.values()) pending.resolve(null);
      this.builds.clear();
      this.worker = null;
    };
    return this.worker;
  }

  /** False when this solid has to be cut on the caller side. */
  postSolid(solid) {
    if (solid.workerPosted) return true;
    const position = solid.source.geometry.getAttribute('position');
    const index = solid.source.geometry.getIndex();
    if (!position?.array || position.itemSize !== 3 || position.isInterleavedBufferAttribute || position.normalized) {
      return false;
    }
    const copy = position.array.slice();
    const indexCopy = index ? index.array.slice() : null;
    const transfers = [copy.buffer];
    if (indexCopy) transfers.push(indexCopy.buffer);
    this.worker.postMessage({
      type: 'store', id: solid.id, position: copy, index: indexCopy,
    }, transfers);
    solid.workerPosted = true;
    return true;
  }

  /** The cut face is the mesh–plane intersection, in world space. */
  presentSection(solid, positions) {
    const vertexCount = positions.length / 3;
    const geometry = solid.section ?? (solid.section = new BufferGeometry());
    let position = geometry.getAttribute('position');
    let normal = geometry.getAttribute('normal');
    if (!position || position.array.length < positions.length) {
      const capacity = Math.max(positions.length, (position?.array.length ?? 0) * 2, 96);
      position = new BufferAttribute(new Float32Array(capacity), 3);
      normal = new BufferAttribute(new Float32Array(capacity), 3);
      geometry.setAttribute('position', position);
      geometry.setAttribute('normal', normal);
    }
    position.array.set(positions);
    const { x, y, z } = this.plane.normal;
    const normals = normal.array;
    for (let i = 0; i < positions.length; i += 3) {
      normals[i] = x;
      normals[i + 1] = y;
      normals[i + 2] = z;
    }
    geometry.setDrawRange(0, vertexCount);
    position.clearUpdateRanges();
    position.addUpdateRange(0, positions.length);
    position.needsUpdate = true;
    normal.clearUpdateRanges();
    normal.addUpdateRange(0, positions.length);
    normal.needsUpdate = true;
    boundDrawn(geometry, vertexCount);
    const cap = solid.cap;
    cap.geometry = geometry;
    cap.position.set(0, 0, 0);
    cap.quaternion.identity();
    cap.scale.set(1, 1, 1);
    cap.frustumCulled = true;
    cap.material.stencilWrite = false;
    cap.material.stencilFunc = AlwaysStencilFunc;
    // Null would hide Object3D's empty method and the renderer calls it unconditionally.
    delete cap.onAfterRender;
    cap.updateMatrix();
    solid.back.visible = false;
    solid.front.visible = false;
    solid.sectioned = true;
  }

  /** The stencil cap remains for a cut the sectioner will not vouch for. */
  presentStencil(solid) {
    solid.back.visible = true;
    solid.front.visible = true;
    const cap = solid.cap;
    cap.geometry = this.geometry;
    cap.position.copy(PLANE_CENTER);
    cap.quaternion.copy(PLANE_ROTATION);
    cap.scale.set(this.capDiameter, this.capDiameter, 1);
    cap.frustumCulled = false;
    cap.material.stencilWrite = true;
    cap.material.stencilRef = 0;
    cap.material.stencilFunc = NotEqualStencilFunc;
    cap.material.stencilFail = ReplaceStencilOp;
    cap.material.stencilZFail = ReplaceStencilOp;
    cap.material.stencilZPass = ReplaceStencilOp;
    cap.onAfterRender = clearStencil;
    cap.updateMatrix();
    solid.sectioned = false;
  }

  /**
   * Light the cut faces the pointer and the selection are on.
   *
   * Kept off the painted colour so a slider drag, which repaints every
   * solid, cannot wipe the lift out from under a stationary pointer.
   */
  highlight(highlight) {
    for (const solid of this.solids) {
      solid.cap.material.userData.highlightLift.value = liftFor(solid.region, highlight);
    }
  }

  /**
   * A stencil cap covers the whole plane, so its hit counts only inside the solid.
   *
   * The hit carries the solid it landed in: that solid is the anatomy the
   * viewer drew there, so it, not a resampled voxel, says what was clicked.
   */
  intersect(raycaster, acceptsHit = () => true) {
    this.group.updateMatrixWorld(true);
    let result = null;
    let bestDistance = Infinity;
    for (const solid of this.solids) {
      if (!solid.group.visible) continue;
      const hit = raycaster.intersectObject(solid.cap)[0];
      if (!hit) continue;
      // A section cap is the face itself. A stencil quad covers the whole
      // plane, so it still has to prove the point lies inside the solid.
      if (!solid.sectioned && !this.pointInside(solid, hit.point, raycaster.ray.direction)) continue;
      if (hit.distance > bestDistance + 1e-5) continue;
      const candidate = { ...hit, source: solid.source, region: solid.region };
      if (!acceptsHit(candidate)) continue;
      bestDistance = Math.min(bestDistance, hit.distance);
      result = candidate;
    }
    return result;
  }

  /**
   * The stencil draws a cap where the faces behind it along the view wind to a
   * nonzero count, exits minus entries; the same count says what was clicked.
   * A first-exit test alone is fooled where a zero-thickness ribbon (pial on
   * white) puts two opposite faces in one place.
   */
  pointInside(solid, point, direction) {
    this.insideRay.ray.set(point, direction);
    const normals = INSIDE_NORMALS.getNormalMatrix(solid.probe.matrixWorld);
    let winding = 0;
    for (const hit of this.insideRay.intersectObject(solid.probe)) {
      winding += Math.sign(INSIDE_NORMAL.copy(hit.face.normal).applyNormalMatrix(normals).dot(direction));
    }
    return winding !== 0;
  }

  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.builds.values()) pending.resolve(null);
    this.builds.clear();
    for (const { source, back, front, cap, section } of this.solids) {
      source.material?.dispose();
      back.material.dispose();
      front.material.dispose();
      cap.material.dispose();
      section?.dispose();
    }
    this.geometry.dispose();
    this.solids.length = 0;
    this.bounds.makeEmpty();
    this.group.removeFromParent();
  }
}
