import {
  AlwaysStencilFunc, BackSide, Box3, DecrementWrapStencilOp, DoubleSide, FrontSide, Group,
  IncrementWrapStencilOp, Matrix3, Mesh, MeshBasicMaterial, NotEqualStencilFunc,
  Plane, PlaneGeometry, Raycaster, ReplaceStencilOp, Vector3,
} from 'three';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import { liftFor } from './highlight.js';

const CAP_NORMAL = new Vector3(0, 0, 1);

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
    this.geometry = new PlaneGeometry(0.5, 0.5);
    this.solids = [];
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
    cap.onAfterRender = renderer => renderer.clearStencil();
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
   */
  reorder() {
    this.solids.sort((a, b) => a.band - b.band);
    for (const [at, solid] of this.solids.entries()) solid.group.renderOrder = at + 1;
  }

  /**
   * Place the caps on the plane.
   *
   * `visible` is whoever painted the solid last saying whether it belongs in
   * this cut; an atlas contributes hundreds of parcel solids, so the ones the
   * plane misses are dropped here rather than drawn empty.
   */
  update(plane) {
    this.plane.copy(plane);
    for (const { visible, bounds, group, cap } of this.solids) {
      group.visible = visible && plane.intersectsBox(bounds);
      if (!group.visible) continue;
      plane.coplanarPoint(cap.position);
      cap.quaternion.setFromUnitVectors(CAP_NORMAL, plane.normal);
    }
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
    for (const { source, group, cap, region } of this.solids) {
      if (!group.visible) continue;
      const hit = raycaster.intersectObject(cap)[0];
      if (!hit) continue;
      this.probe.ray.set(hit.point, raycaster.ray.direction);
      const exit = this.probe.intersectObject(source)[0];
      if (exit && exit.face.normal.clone().applyNormalMatrix(new Matrix3().getNormalMatrix(source.matrixWorld))
        .dot(raycaster.ray.direction) > 0) result = { ...hit, source, region };
    }
    return result;
  }

  dispose() {
    for (const { source, back, front, cap } of this.solids) {
      source.geometry.dispose();
      source.material.dispose();
      back.material.dispose();
      front.material.dispose();
      cap.material.dispose();
    }
    this.geometry.dispose();
    this.solids.length = 0;
    this.group.removeFromParent();
  }
}
