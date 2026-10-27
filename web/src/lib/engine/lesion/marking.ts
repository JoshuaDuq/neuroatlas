import {
  Box3,
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineDashedMaterial,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { Camera, Object3D, Plane } from 'three';
import { token } from '../render/tokens.ts';
import { rasToWorld } from '../slices/coordinates.ts';
import type { LesionSphere } from '../api.ts';

type SurfaceMesh = Pick<Mesh, 'geometry' | 'matrixWorld'>;

/**
 * Every triangle whose centroid lies within `radius` of `centre`, three points each, in world space,
 * with the surface's own normals so the paint shades as the cortex beneath it does.
 */
export function footprint(
  meshes: readonly SurfaceMesh[],
  centre: Vector3,
  radius: number,
): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = [];
  const normals: number[] = [];
  const corners = [new Vector3(), new Vector3(), new Vector3()];
  const turned = [new Vector3(), new Vector3(), new Vector3()];
  const centroid = new Vector3();
  const normalMatrix = new Matrix3();
  const r2 = radius * radius;
  const box = new Box3();
  for (const mesh of meshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (
      box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld).distanceToPoint(centre) >
      radius
    ) {
      continue;
    }
    const position = mesh.geometry.getAttribute('position');
    const normal = mesh.geometry.getAttribute('normal');
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : position.count;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let t = 0; t + 2 < count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const vertex = index ? index.getX(t + k) : t + k;
        corners[k]!.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);
        if (normal)
          turned[k]!.fromBufferAttribute(normal, vertex).applyMatrix3(normalMatrix).normalize();
      }
      centroid.copy(corners[0]!).add(corners[1]!).add(corners[2]!).divideScalar(3);
      if (centroid.distanceToSquared(centre) > r2) continue;
      for (let k = 0; k < 3; k++) {
        positions.push(corners[k]!.x, corners[k]!.y, corners[k]!.z);
        if (normal) normals.push(turned[k]!.x, turned[k]!.y, turned[k]!.z);
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

const RING_SEGMENTS = 128;
const DASH_FRACTION_OF_RADIUS = 0.11;
const DOT_RADIUS_M = 0.0009;

/** Turn a stage marking to face the camera, as the orientation letters do. */
const facing = (object: Object3D) => (_: unknown, __: unknown, camera: Camera) =>
  object.quaternion.copy(camera.quaternion);

/**
 * The lesion on the stage: where it meets the drawn cortex, painted in the overlay ink, and a dashed
 * ring for its full extent, seen through the brain like the stage's other markings.
 */
export function createLesionMarking() {
  const group = new Group();
  group.name = 'Lesion';
  const ink = new Color();
  const paint = new MeshStandardMaterial({
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const ringMaterial = new LineDashedMaterial({ depthTest: false, transparent: true });
  const dotMaterial = new MeshBasicMaterial({ depthTest: false, transparent: true });
  const surface = new Mesh(new BufferGeometry(), paint);
  const ring = new Line(new BufferGeometry(), ringMaterial);
  const dot = new Mesh(new CircleGeometry(DOT_RADIUS_M, 24), dotMaterial);
  ring.renderOrder = dot.renderOrder = 1000;
  ring.onBeforeRender = facing(ring);
  dot.onBeforeRender = facing(dot);
  group.add(surface, ring, dot);
  group.visible = false;

  function applyTheme(): void {
    ink.set(token('--overlay-ink'));
    paint.color.copy(ink);
    ringMaterial.color.copy(ink);
    dotMaterial.color.copy(ink);
  }
  applyTheme();

  return {
    group,
    applyTheme,
    /** Draw `sphere` against the drawn cortex, clipped as the cortex is; null removes it. */
    show(
      sphere: LesionSphere | null,
      cortex: readonly SurfaceMesh[],
      planes: readonly Plane[],
    ): void {
      surface.geometry.dispose();
      ring.geometry.dispose();
      if (!sphere) {
        surface.geometry = new BufferGeometry();
        ring.geometry = new BufferGeometry();
        group.visible = false;
        return;
      }
      const centre = rasToWorld(sphere.centre);
      const radius = sphere.radius / 1000;
      const { positions, normals } = footprint(cortex, centre, radius);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      if (normals.length) geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      else geometry.computeVertexNormals();
      surface.geometry = geometry;
      paint.clippingPlanes = [...planes];
      paint.needsUpdate = true;

      const points = Array.from({ length: RING_SEGMENTS + 1 }, (_, i) => {
        const angle = (i / RING_SEGMENTS) * Math.PI * 2;
        return new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      });
      ring.geometry = new BufferGeometry().setFromPoints(points);
      ringMaterial.dashSize = radius * DASH_FRACTION_OF_RADIUS;
      ringMaterial.gapSize = radius * DASH_FRACTION_OF_RADIUS * 0.7;
      ring.computeLineDistances();
      ring.position.copy(centre);
      dot.position.copy(centre);
      group.visible = true;
    },
    dispose(): void {
      surface.geometry.dispose();
      ring.geometry.dispose();
      dot.geometry.dispose();
      paint.dispose();
      ringMaterial.dispose();
      dotMaterial.dispose();
    },
  };
}
