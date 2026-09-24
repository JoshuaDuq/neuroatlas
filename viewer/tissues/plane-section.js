import { Matrix4, Plane, Vector3 } from 'three';
import { earcut } from './earcut.js';

const _inverse = new Matrix4();
const _local = new Plane();
const _axisU = new Vector3();
const _axisV = new Vector3();

/**
 * Triangles of a closed mesh cut by a plane.
 *
 * The cap is the mesh–plane intersection, so a cut draws the face it opens
 * rather than rasterising every triangle of every solid. `matrixWorld` maps
 * the geometry into the plane's frame. A non-manifold intersection returns
 * `{ fallback: true }` and the caller keeps the stencil cap, which already
 * agrees with the mesh there.
 */
export function sectionTriangles(geometry, matrixWorld, plane) {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  if (!position) return { empty: true };
  _inverse.copy(matrixWorld).invert();
  _local.copy(plane).applyMatrix4(_inverse);

  const elements = matrixWorld.elements;
  const xyz = [];
  const next = [];
  const edges = new Map();
  let manifold = true;
  const nx = _local.normal.x;
  const ny = _local.normal.y;
  const nz = _local.normal.z;
  const planeConstant = _local.constant;
  // Duplicate vertices (a box face does not share indices with its neighbour)
  // are the same point. 1e-8 m is far below the mesh tolerance and far above
  // float noise, so welded and unwelded edges meet on one intersection.
  const quant = value => Math.round(value * 1e8);

  const signed = (x, y, z) => {
    const raw = nx * x + ny * y + nz * z + planeConstant;
    if (raw !== 0) return raw;
    // An exact zero is shared by every copy of that vertex. Nudge it so the
    // cut never sits on a vertex, by much less than a mesh edge.
    const nudge = (Math.imul(quant(x), 73856093) ^ Math.imul(quant(y), 19349663) ^ Math.imul(quant(z), 83492791)) || 1;
    return nudge * 1e-15;
  };

  const pointOnEdge = (ax, ay, az, bx, by, bz, da, db) => {
    let aqx = quant(ax), aqy = quant(ay), aqz = quant(az);
    let bqx = quant(bx), bqy = quant(by), bqz = quant(bz);
    if (aqx > bqx || (aqx === bqx && (aqy > bqy || (aqy === bqy && aqz > bqz)))) {
      const swapX = aqx; aqx = bqx; bqx = swapX;
      const swapY = aqy; aqy = bqy; bqy = swapY;
      const swapZ = aqz; aqz = bqz; bqz = swapZ;
    }
    const key = `${aqx},${aqy},${aqz}|${bqx},${bqy},${bqz}`;
    let id = edges.get(key);
    if (id === undefined) {
      const t = da / (da - db);
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const z = az + (bz - az) * t;
      id = xyz.length / 3;
      xyz.push(
        elements[0] * x + elements[4] * y + elements[8] * z + elements[12],
        elements[1] * x + elements[5] * y + elements[9] * z + elements[13],
        elements[2] * x + elements[6] * y + elements[10] * z + elements[14],
      );
      edges.set(key, id);
    }
    return id;
  };

  const link = (from, to) => {
    if (from === to) return;
    if (next[from] === undefined) next[from] = to;
    else if (next[from] !== to) manifold = false;
  };

  const cutTriangle = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const da = signed(ax, ay, az);
    const db = signed(bx, by, bz);
    const dc = signed(cx, cy, cz);
    if ((da > 0 && db > 0 && dc > 0) || (da < 0 && db < 0 && dc < 0)) return;
    let exit = -1;
    let enter = -1;
    if (da * db < 0) {
      const id = pointOnEdge(ax, ay, az, bx, by, bz, da, db);
      if (da < 0) exit = id;
      else enter = id;
    }
    if (db * dc < 0) {
      const id = pointOnEdge(bx, by, bz, cx, cy, cz, db, dc);
      if (db < 0) exit = id;
      else enter = id;
    }
    if (dc * da < 0) {
      const id = pointOnEdge(cx, cy, cz, ax, ay, az, dc, da);
      if (dc < 0) exit = id;
      else enter = id;
    }
    if (exit >= 0 && enter >= 0) link(exit, enter);
  };

  const fastPositions = position.array
    && position.itemSize === 3
    && !position.normalized
    && !position.isInterleavedBufferAttribute;
  if (geometry.boundsTree && fastPositions && index?.array) {
    const pos = position.array;
    const indexed = index.array;
    const resolve = geometry.boundsTree.resolveTriangleIndex;
    geometry.boundsTree.shapecast({
      intersectsBounds: box => _local.intersectsBox(box),
      intersectsRange: (offset, count) => {
        const end = offset + count;
        for (let i = offset; i < end; i++) {
          const tri = resolve(i) * 3;
          const a = indexed[tri] * 3;
          const b = indexed[tri + 1] * 3;
          const c = indexed[tri + 2] * 3;
          cutTriangle(
            pos[a], pos[a + 1], pos[a + 2],
            pos[b], pos[b + 1], pos[b + 2],
            pos[c], pos[c + 1], pos[c + 2],
          );
        }
        return false;
      },
    });
  } else if (geometry.boundsTree) {
    geometry.boundsTree.shapecast({
      intersectsBounds: box => _local.intersectsBox(box),
      intersectsTriangle: tri => {
        cutTriangle(tri.a.x, tri.a.y, tri.a.z, tri.b.x, tri.b.y, tri.b.z, tri.c.x, tri.c.y, tri.c.z);
      },
    });
  } else {
    const count = index ? index.count / 3 : position.count / 3;
    for (let triangle = 0; triangle < count; triangle++) {
      const base = triangle * 3;
      const ia = index ? index.getX(base) : base;
      const ib = index ? index.getX(base + 1) : base + 1;
      const ic = index ? index.getX(base + 2) : base + 2;
      cutTriangle(
        position.getX(ia), position.getY(ia), position.getZ(ia),
        position.getX(ib), position.getY(ib), position.getZ(ib),
        position.getX(ic), position.getY(ic), position.getZ(ic),
      );
    }
  }

  const pointCount = xyz.length / 3;
  if (!pointCount) return { empty: true };
  if (!manifold) return { fallback: true };
  for (let id = 0; id < pointCount; id++) {
    if (next[id] === undefined) return { fallback: true };
  }

  const seen = new Uint8Array(pointCount);
  const loops = [];
  for (let start = 0; start < pointCount; start++) {
    if (seen[start]) continue;
    const loop = [];
    let at = start;
    let guard = 0;
    while (seen[at] === 0 && guard <= pointCount) {
      seen[at] = 1;
      loop.push(at);
      at = next[at];
      guard += 1;
    }
    if (at !== start || loop.length < 3) return { fallback: true };
    loops.push(loop);
  }

  const normal = plane.normal;
  if (Math.abs(normal.x) < 0.9) _axisU.set(1, 0, 0);
  else _axisU.set(0, 1, 0);
  _axisU.addScaledVector(normal, -_axisU.dot(normal)).normalize();
  _axisV.crossVectors(normal, _axisU);
  const uv = new Float64Array(pointCount * 2);
  for (let id = 0; id < pointCount; id++) {
    const x = xyz[id * 3];
    const y = xyz[id * 3 + 1];
    const z = xyz[id * 3 + 2];
    uv[id * 2] = _axisU.x * x + _axisU.y * y + _axisU.z * z;
    uv[id * 2 + 1] = _axisV.x * x + _axisV.y * y + _axisV.z * z;
  }

  const rings = [];
  for (const ids of loops) {
    let area = 0;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i] * 2;
      const b = ids[(i + 1) % ids.length] * 2;
      area += uv[a] * uv[b + 1] - uv[b] * uv[a + 1];
    }
    area /= 2;
    if (Math.abs(area) < 1e-14) continue;
    const seed = interiorPoint(ids, uv, area > 0);
    if (!seed || !ringContains(ids, uv, seed[0], seed[1])) return { fallback: true };
    rings.push({ ids, area, seed });
  }
  if (!rings.length) return { empty: true };

  for (const ring of rings) {
    let depth = 0;
    for (const other of rings) {
      if (other !== ring && ringContains(other.ids, uv, ring.seed[0], ring.seed[1])) depth += 1;
    }
    ring.depth = depth;
  }

  const parentOf = hole => {
    let parent = null;
    for (const ring of rings) {
      if (ring.depth !== hole.depth - 1) continue;
      if (!ringContains(ring.ids, uv, hole.seed[0], hole.seed[1])) continue;
      if (!parent || Math.abs(ring.area) < Math.abs(parent.area)) parent = ring;
    }
    return parent;
  };

  const output = [];
  for (const root of rings) {
    if (root.depth % 2 === 1) continue;
    const holes = rings.filter(ring => parentOf(ring) === root);
    if (!appendRing(root, holes, uv, xyz, output)) return { fallback: true };
  }
  if (!output.length) return { empty: true };
  return { positions: Float32Array.from(output) };
}

function interiorPoint(ids, uv, positive) {
  for (const scale of [1e-6, 1e-8, 1e-4]) {
    const a = ids[0] * 2;
    const b = ids[1] * 2;
    const dx = uv[b] - uv[a];
    const dy = uv[b + 1] - uv[a + 1];
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const side = positive ? 1 : -1;
    const x = (uv[a] + uv[b]) / 2 + side * (-dy / length) * scale;
    const y = (uv[a + 1] + uv[b + 1]) / 2 + side * (dx / length) * scale;
    if (ringContains(ids, uv, x, y)) return [x, y];
  }
  return null;
}

function ringContains(ids, uv, x, y) {
  let inside = false;
  for (let i = 0, j = ids.length - 1; i < ids.length; j = i++) {
    const yi = uv[ids[i] * 2 + 1];
    const yj = uv[ids[j] * 2 + 1];
    const xi = uv[ids[i] * 2];
    const xj = uv[ids[j] * 2];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function appendRing(outer, holes, uv, xyz, output) {
  const ids = [];
  const flat = [];
  const holeIndices = [];
  const push = ring => {
    for (const id of ring.ids) {
      ids.push(id);
      flat.push(uv[id * 2], uv[id * 2 + 1]);
    }
  };
  push(outer);
  for (const hole of holes) {
    holeIndices.push(ids.length);
    push(hole);
  }
  const holesOrNull = holeIndices.length ? holeIndices : null;
  const indices = earcut(flat, holesOrNull, 2);
  if (indices.length < 3) return false;
  const deviation = earcut.deviation(flat, holesOrNull, 2, indices);
  if (!Number.isFinite(deviation) || deviation > 1e-3) return false;
  for (let i = 0; i < indices.length; i += 3) {
    for (const corner of [0, 1, 2]) {
      const id = ids[indices[i + corner]];
      output.push(xyz[id * 3], xyz[id * 3 + 1], xyz[id * 3 + 2]);
    }
  }
  return true;
}
