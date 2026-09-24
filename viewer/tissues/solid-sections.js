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

function stencilMaterial(plane, side, operation) {
  return new MeshBasicMaterial({
    side, clippingPlanes: [plane], colorWrite: false,
    depthWrite: false, depthTest: false, stencilWrite: true,
    stencilFunc: AlwaysStencilFunc,
    stencilFail: operation, stencilZFail: operation, stencilZPass: operation,
  });
}

/** Cap closed anatomical surfaces using Three.js's winding-count stencil method. */
export class SolidSections {
  constructor() {
    this.group = new Group();
    this.group.name = 'Solid anatomical tissue cuts';
    this.plane = new Plane();
    this.geometry = new PlaneGeometry(1, 1);
    this.solids = [];
    this.bounds = new Box3();
    this.probe = new Raycaster();
    this.probe.firstHitOnly = true;
  }

  add(source, material, band) {
    source.updateWorldMatrix(true, false);
    source.geometry.boundsTree = computeBoundsTree.call(source.geometry, { indirect: true });
    source.raycast = acceleratedRaycast;
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
      source, bounds, group, back, front, cap, band,
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
    const moved = plane.constant !== this.plane.constant
      || plane.normal.distanceToSquared(this.plane.normal) > 0;
    this.plane.copy(plane);
    this.bounds.getCenter(BOUNDS_CENTER);
    this.capDiameter = this.bounds.getSize(BOUNDS_SIZE).length() || 1;
    plane.projectPoint(BOUNDS_CENTER, PLANE_CENTER);
    PLANE_ROTATION.setFromUnitVectors(CAP_NORMAL, plane.normal);
    for (const solid of this.solids) {
      const show = solid.visible && plane.intersectsBox(solid.bounds);
      if (!show) {
        solid.group.visible = false;
        continue;
      }
      if (!moved && solid.cutReady) {
        solid.group.visible = solid.cutShow;
        continue;
      }
      const section = sectionTriangles(solid.source.geometry, solid.source.matrixWorld, this.plane);
      solid.cutShow = Boolean(section.positions || section.fallback);
      solid.cutReady = true;
      solid.group.visible = solid.cutShow;
      if (section.positions) this.presentSection(solid, section.positions);
      else if (section.fallback) this.presentStencil(solid);
    }
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
   * An outward-facing first exit means the cut point lies inside the solid.
   *
   * The hit carries the solid it landed in: that solid is the anatomy the
   * viewer drew there, so it, not a resampled voxel, says what was clicked.
   */
  intersect(raycaster) {
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
      bestDistance = Math.min(bestDistance, hit.distance);
      result = { ...hit, source: solid.source, region: solid.region };
    }
    return result;
  }

  /** An outward-facing first exit means the point lies inside the solid. */
  pointInside(solid, point, direction) {
    this.probe.ray.set(point, direction);
    const exit = this.probe.intersectObject(solid.source)[0];
    return Boolean(exit && exit.face.normal.clone()
      .applyNormalMatrix(new Matrix3().getNormalMatrix(solid.source.matrixWorld))
      .dot(direction) > 0);
  }

  dispose() {
    for (const { source, back, front, cap, section } of this.solids) {
      source.geometry.dispose();
      source.material.dispose();
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
