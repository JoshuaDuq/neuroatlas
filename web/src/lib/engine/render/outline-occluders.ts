import {
  Box3,
  Frustum,
  Matrix4,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  Vector3,
} from 'three';
import type { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

// `box` is reused for the selection's bounds and then for each candidate occluder; the selection
// bounds are consumed (the frustum is built from them) before the per-object tests overwrite it.
const box = new Box3();
const point = new Vector3();
const projection = new Matrix4();
const frustum = new Frustum();

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

/**
 * OutlinePass needs occluder depth only underneath the selected objects.
 * Narrow its culling volume to their projected bounds, retaining the original
 * camera, resolution, materials and depth comparison. Bounding volumes and a
 * pixel of padding keep this conservative at silhouettes and grazing angles.
 */
export function withOutlineOccluders<T>(pass: OutlinePass, render: () => T): T {
  const scene = pass.renderScene;
  const camera = pass.renderCamera;
  scene.updateMatrixWorld();
  camera.updateWorldMatrix(true, false);
  const selected = new Set<Object3D>();
  box.makeEmpty();
  for (const object of pass.selectedObjects) {
    object.traverse((child) => {
      if (isMesh(child)) selected.add(child);
    });
    box.expandByObject(object);
  }
  if (box.isEmpty()) return render();

  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  for (let corner = 0; corner < 8; corner++) {
    point.set(
      corner & 1 ? box.max.x : box.min.x,
      corner & 2 ? box.max.y : box.min.y,
      corner & 4 ? box.max.z : box.min.z,
    );
    point.applyMatrix4(camera.matrixWorldInverse);
    // A box crossing the near plane cannot be bounded by projecting its
    // corners. Keep the full depth scene in this case, including when inside.
    if (point.z >= -(camera as PerspectiveCamera).near) return render();
    point.applyMatrix4(camera.projectionMatrix);
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    bottom = Math.min(bottom, point.y);
    top = Math.max(top, point.y);
  }
  const padX = 2 / pass.renderTargetMaskBuffer.width;
  const padY = 2 / pass.renderTargetMaskBuffer.height;
  left -= padX;
  right += padX;
  bottom -= padY;
  top += padY;
  projection
    .set(
      2 / (right - left),
      0,
      0,
      -(right + left) / (right - left),
      0,
      2 / (top - bottom),
      0,
      -(top + bottom) / (top - bottom),
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
    )
    .multiply(camera.projectionMatrix)
    .multiply(camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projection, camera.coordinateSystem);

  const hidden: Object3D[] = [];
  scene.traverseVisible((object) => {
    // Hiding a parent could remove a child whose bounds overlap the selection.
    if (!isMesh(object) || object.children.length || selected.has(object)) return;
    // Spheres cheaply reject distant objects; boxes also reject elongated
    // structures whose sphere reaches the outline but whose geometry cannot.
    if (frustum.intersectsObject(object) && frustum.intersectsBox(box.setFromObject(object)))
      return;
    hidden.push(object);
  });
  for (const object of hidden) object.visible = false;
  try {
    return render();
  } finally {
    for (const object of hidden) object.visible = true;
  }
}
