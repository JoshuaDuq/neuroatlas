import { Vector3 } from 'three';

/** Fit a perspective camera to unchanged world bounds, with a small screen margin. */
export function frameBounds(camera, bounds, direction) {
  const center = bounds.getCenter(new Vector3());
  const right = new Vector3().crossVectors(camera.up, direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const verticalSlope = Math.tan(camera.fov * Math.PI / 360) * 0.92;
  const horizontalSlope = verticalSlope * camera.aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new Vector3(x, y, z).sub(center);
        const depth = corner.dot(direction);
        distance = Math.max(distance,
          depth + Math.abs(corner.dot(right)) / horizontalSlope,
          depth + Math.abs(corner.dot(up)) / verticalSlope);
      }
    }
  }
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  return center;
}
