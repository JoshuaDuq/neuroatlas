import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BoxGeometry, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, Plane, Raycaster, Vector3,
} from 'three';
import { ExtrudeGeometry } from 'three/src/geometries/ExtrudeGeometry.js';
import { Path } from 'three';
import { Shape } from 'three';
import { sectionTriangles } from './plane-section.js';

const identity = new Matrix4();

function cuttingPlane(x, y, z, constant) {
  return new Plane(new Vector3(x, y, z), constant);
}

function extruded(build) {
  const shape = new Shape();
  build(shape);
  return new ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
}

/**
 * A point on the cutting plane is inside the solid when a ray along the plane
 * normal, started outside, crosses an odd number of faces before it arrives.
 * Traveling on the normal keeps the ray from grazing a face the sample does
 * not sit under.
 */
function insideSolid(mesh, plane, point) {
  const origin = point.clone().addScaledVector(plane.normal, 1);
  const ray = new Raycaster(origin, plane.normal.clone().negate(), 0, 1 - 1e-5);
  // A ray that lands on a shared edge is reported twice. Those are one crossing.
  const crossings = [];
  for (const hit of ray.intersectObject(mesh)) {
    if (!crossings.length || Math.abs(hit.distance - crossings.at(-1)) > 1e-6) crossings.push(hit.distance);
  }
  return crossings.length % 2 === 1;
}

function onSurface(mesh, point) {
  for (const direction of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    for (const sign of [1, -1]) {
      const ray = new Raycaster(point, new Vector3(...direction).multiplyScalar(sign), 0, 2e-4);
      if (ray.intersectObject(mesh).length) return true;
    }
  }
  return false;
}

function covers(positions, plane, point) {
  const axisU = Math.abs(plane.normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  axisU.addScaledVector(plane.normal, -axisU.dot(plane.normal)).normalize();
  const axisV = new Vector3().crossVectors(plane.normal, axisU);
  const origin = plane.coplanarPoint(new Vector3());
  const px = axisU.dot(point) - axisU.dot(origin);
  const py = axisV.dot(point) - axisV.dot(origin);
  const corner = new Vector3();
  const projected = [];
  for (let i = 0; i < positions.length; i += 3) {
    corner.set(positions[i], positions[i + 1], positions[i + 2]);
    projected.push(axisU.dot(corner) - axisU.dot(origin), axisV.dot(corner) - axisV.dot(origin));
  }
  for (let i = 0; i < projected.length; i += 6) {
    const [ax, ay, bx, by, cx, cy] = projected.slice(i, i + 6);
    const c1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const c2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
    const c3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
    if ((c1 >= -1e-9 && c2 >= -1e-9 && c3 >= -1e-9) ||
        (c1 <= 1e-9 && c2 <= 1e-9 && c3 <= 1e-9)) return true;
  }
  return false;
}

function placed(geometry, matrix) {
  const mesh = new Mesh(geometry);
  mesh.matrix.copy(matrix);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrixWorld(true);
  return mesh;
}

function assertMatchesSolid(geometry, matrix, plane) {
  const result = sectionTriangles(geometry, matrix, plane);
  assert.equal(result.fallback, undefined);
  assert.ok(result.positions?.length >= 9);
  for (let i = 0; i < result.positions.length; i += 3) {
    const point = new Vector3(result.positions[i], result.positions[i + 1], result.positions[i + 2]);
    assert.ok(Math.abs(plane.distanceToPoint(point)) < 1e-6, 'a cap vertex left the plane');
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox.clone().applyMatrix4(matrix);
  const origin = plane.coplanarPoint(new Vector3());
  const axisU = Math.abs(plane.normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  axisU.addScaledVector(plane.normal, -axisU.dot(plane.normal)).normalize();
  const axisV = new Vector3().crossVectors(plane.normal, axisU);
  const minU = box.min.dot(axisU);
  const maxU = box.max.dot(axisU);
  const minV = box.min.dot(axisV);
  const maxV = box.max.dot(axisV);
  const mesh = placed(geometry, matrix);
  let compared = 0;
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const point = origin.clone()
        .addScaledVector(axisU, minU + (maxU - minU) * i / 8 - origin.dot(axisU))
        .addScaledVector(axisV, minV + (maxV - minV) * j / 8 - origin.dot(axisV));
      if (onSurface(mesh, point)) continue;
      const inside = insideSolid(mesh, plane, point);
      const covered = covers(result.positions, plane, point);
      assert.equal(covered, inside,
        `coverage at ${point.toArray().map(n => n.toFixed(4)).join(',')}`);
      compared += 1;
    }
  }
  assert.ok(compared > 16, `only compared ${compared} samples`);
}

test('a box section is the square the plane cuts, from either side', () => {
  const geometry = new BoxGeometry(0.1, 0.1, 0.1);
  for (const side of [1, -1]) {
    assertMatchesSolid(geometry, identity, cuttingPlane(0, 0, side, 0));
  }
});

test('a concave section leaves the notch empty', () => {
  const geometry = extruded(shape => {
    shape.moveTo(0, 0);
    shape.lineTo(0.06, 0);
    shape.lineTo(0.06, 0.02);
    shape.lineTo(0.02, 0.02);
    shape.lineTo(0.02, 0.06);
    shape.lineTo(0, 0.06);
    shape.closePath();
  });
  assertMatchesSolid(geometry, identity, cuttingPlane(0, 0, 1, -0.025));
});

test('a section keeps a hole that the solid keeps', () => {
  const geometry = extruded(shape => {
    shape.moveTo(-0.04, -0.04);
    shape.lineTo(0.04, -0.04);
    shape.lineTo(0.04, 0.04);
    shape.lineTo(-0.04, 0.04);
    shape.closePath();
    const hole = new Path();
    hole.moveTo(-0.015, -0.015);
    hole.lineTo(0.015, -0.015);
    hole.lineTo(0.015, 0.015);
    hole.lineTo(-0.015, 0.015);
    hole.closePath();
    shape.holes.push(hole);
  });
  assertMatchesSolid(geometry, identity, cuttingPlane(0, 0, 1, -0.025));
});

test('a translated solid is cut in world space', () => {
  const geometry = new BoxGeometry(0.04, 0.04, 0.04);
  const matrix = new Matrix4().makeTranslation(0.1, -0.2, 0.05);
  assertMatchesSolid(geometry, matrix, cuttingPlane(1, 0, 0, -0.1));
});

test('a non-manifold cut is reported instead of filled wrongly', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, 1, 0, 0, 0, -1, 0,
    0, 0, 0, 1, 0, 0, 0, 0, 1,
  ], 3));
  geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const result = sectionTriangles(geometry, identity, cuttingPlane(1, 0, 0, -0.4));
  assert.equal(result.fallback, true);
});

test('a plane that misses returns no triangles', () => {
  const result = sectionTriangles(new BoxGeometry(0.1, 0.1, 0.1), identity, cuttingPlane(0, 0, 1, -2));
  assert.deepEqual(result, { empty: true });
});
