import { Matrix4, Plane, Vector3 } from 'three';
import { earcut } from './earcut.js';

const _inverse = new Matrix4();
const _local = new Plane();
const _axisU = new Vector3();
const _axisV = new Vector3();

const EDGE_EMPTY = -1;
let edgeCap = 1 << 16;
let edgeTable = new Int32Array(edgeCap);
edgeTable.fill(EDGE_EMPTY);
let recCap = 4096;
let edgeSlot = new Int32Array(recCap);
let k0 = new Int32Array(recCap);
let k1 = new Int32Array(recCap);
let k2 = new Int32Array(recCap);
let k3 = new Int32Array(recCap);
let k4 = new Int32Array(recCap);
let k5 = new Int32Array(recCap);
let edgeIds = new Int32Array(recCap);
let edgeN = 0;

let xyz = new Float64Array(4096);
let xyzCount = 0;
let stamp = 1;
let nextStamp = new Int32Array(2048);
let nextTo = new Int32Array(2048);

const ctx = {
  nx: 0, ny: 0, nz: 0, constant: 0,
  identity: true,
  e0: 1, e1: 0, e2: 0, e4: 0, e5: 1, e6: 0, e8: 0, e9: 0, e10: 1, e12: 0, e13: 0, e14: 0,
  pos: null, indexed: null, indirect: null,
  manifold: true,
};

/**
 * Triangles of a closed mesh cut by a plane.
 *
 * The cap is the mesh–plane intersection, so a cut draws the face it opens
 * rather than rasterizing every triangle of every solid. `matrixWorld` maps
 * the geometry into the plane's frame. A non-manifold intersection returns
 * `{ fallback: true }` and the caller keeps the stencil cap, which already
 * agrees with the mesh there.
 *
 * Scratch buffers live for the whole page. The walk is synchronous, so one
 * section never overlaps another, and a drag does not allocate a map per solid.
 */
export function sectionTriangles(geometry, matrixWorld, plane) {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  if (!position) return { empty: true };
  begin(matrixWorld, plane);

  const fastPositions = position.array
    && position.itemSize === 3
    && !position.normalized
    && !position.isInterleavedBufferAttribute;
  if (geometry.boundsTree && fastPositions && index?.array) {
    ctx.pos = position.array;
    ctx.indexed = index.array;
    ctx.indirect = geometry.boundsTree._indirectBuffer ?? null;
    geometry.boundsTree.shapecast({
      intersectsBounds: boundsHit,
      intersectsRange: rangeHit,
    });
  } else if (geometry.boundsTree) {
    geometry.boundsTree.shapecast({
      intersectsBounds: boundsHit,
      intersectsTriangle: triangleHit,
    });
  } else {
    const count = index ? index.count / 3 : position.count / 3;
    for (let triangle = 0; triangle < count; triangle++) {
      const base = triangle * 3;
      const ia = index ? index.getX(base) : base;
      const ib = index ? index.getX(base + 1) : base + 1;
      const ic = index ? index.getX(base + 2) : base + 2;
      cut(
        position.getX(ia), position.getY(ia), position.getZ(ia),
        position.getX(ib), position.getY(ib), position.getZ(ib),
        position.getX(ic), position.getY(ic), position.getZ(ic),
      );
    }
  }
  return finish(plane);
}

function begin(matrixWorld, plane) {
  resetEdges();
  xyzCount = 0;
  stamp = (stamp + 1) >>> 0;
  if (stamp === 0) {
    nextStamp.fill(0);
    stamp = 1;
  }
  ctx.manifold = true;
  const e = matrixWorld.elements;
  ctx.identity = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[15] === 1
    && e[1] === 0 && e[2] === 0 && e[3] === 0
    && e[4] === 0 && e[6] === 0 && e[7] === 0
    && e[8] === 0 && e[9] === 0 && e[11] === 0
    && e[12] === 0 && e[13] === 0 && e[14] === 0;
  if (ctx.identity) _local.copy(plane);
  else {
    _inverse.copy(matrixWorld).invert();
    _local.copy(plane).applyMatrix4(_inverse);
    ctx.e0 = e[0]; ctx.e1 = e[1]; ctx.e2 = e[2];
    ctx.e4 = e[4]; ctx.e5 = e[5]; ctx.e6 = e[6];
    ctx.e8 = e[8]; ctx.e9 = e[9]; ctx.e10 = e[10];
    ctx.e12 = e[12]; ctx.e13 = e[13]; ctx.e14 = e[14];
  }
  ctx.nx = _local.normal.x;
  ctx.ny = _local.normal.y;
  ctx.nz = _local.normal.z;
  ctx.constant = _local.constant;
}

function boundsHit(box) {
  return _local.intersectsBox(box);
}

function rangeHit(offset, count) {
  const pos = ctx.pos;
  const indexed = ctx.indexed;
  const indirect = ctx.indirect;
  const end = offset + count;
  for (let i = offset; i < end; i++) {
    const tri = (indirect ? indirect[i] : i) * 3;
    const a = indexed[tri] * 3;
    const b = indexed[tri + 1] * 3;
    const c = indexed[tri + 2] * 3;
    cut(
      pos[a], pos[a + 1], pos[a + 2],
      pos[b], pos[b + 1], pos[b + 2],
      pos[c], pos[c + 1], pos[c + 2],
    );
  }
  return false;
}

function triangleHit(tri) {
  cut(tri.a.x, tri.a.y, tri.a.z, tri.b.x, tri.b.y, tri.b.z, tri.c.x, tri.c.y, tri.c.z);
}

function signed(x, y, z) {
  const raw = ctx.nx * x + ctx.ny * y + ctx.nz * z + ctx.constant;
  if (raw !== 0) return raw;
  // An exact zero is shared by every copy of that vertex. Nudge it so the
  // cut never sits on a vertex, by much less than a mesh edge.
  const qx = Math.round(x * 1e8);
  const qy = Math.round(y * 1e8);
  const qz = Math.round(z * 1e8);
  const nudge = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) || 1;
  return nudge * 1e-15;
}

function cut(ax, ay, az, bx, by, bz, cx, cy, cz) {
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
}

function pointOnEdge(ax, ay, az, bx, by, bz, da, db) {
  let aqx = Math.round(ax * 1e8);
  let aqy = Math.round(ay * 1e8);
  let aqz = Math.round(az * 1e8);
  let bqx = Math.round(bx * 1e8);
  let bqy = Math.round(by * 1e8);
  let bqz = Math.round(bz * 1e8);
  if (aqx > bqx || (aqx === bqx && (aqy > bqy || (aqy === bqy && aqz > bqz)))) {
    const swapX = aqx; aqx = bqx; bqx = swapX;
    const swapY = aqy; aqy = bqy; bqy = swapY;
    const swapZ = aqz; aqz = bqz; bqz = swapZ;
  }
  if (edgeN * 2 > edgeCap) growEdgeTable();
  const mask = edgeCap - 1;
  let slot = edgeHash(aqx, aqy, aqz, bqx, bqy, bqz) & mask;
  while (true) {
    const at = edgeTable[slot];
    if (at === EDGE_EMPTY) break;
    if (k0[at] === aqx && k1[at] === aqy && k2[at] === aqz
      && k3[at] === bqx && k4[at] === bqy && k5[at] === bqz) return edgeIds[at];
    slot = (slot + 1) & mask;
  }
  if (edgeN === recCap) growEdgeRecs();
  const at = edgeN;
  const t = da / (da - db);
  const x = ax + (bx - ax) * t;
  const y = ay + (by - ay) * t;
  const z = az + (bz - az) * t;
  const id = pushPoint(x, y, z);
  k0[at] = aqx; k1[at] = aqy; k2[at] = aqz;
  k3[at] = bqx; k4[at] = bqy; k5[at] = bqz;
  edgeIds[at] = id;
  edgeSlot[at] = slot;
  edgeTable[slot] = at;
  edgeN += 1;
  return id;
}

function edgeHash(a, b, c, d, e, f) {
  let h = Math.imul(a, 0x9e3779b1);
  h = Math.imul(h ^ b, 0x85ebca6b);
  h = Math.imul(h ^ c, 0xc2b2ae35);
  h = Math.imul(h ^ d, 0x27d4eb2f);
  h = Math.imul(h ^ e, 0x165667b1);
  return (Math.imul(h ^ f, 0x9e3779b1)) >>> 0;
}

function pushPoint(x, y, z) {
  const id = xyzCount / 3;
  if (xyzCount + 3 > xyz.length) {
    const grown = new Float64Array(xyz.length * 2);
    grown.set(xyz);
    xyz = grown;
  }
  if (ctx.identity) {
    xyz[xyzCount++] = x;
    xyz[xyzCount++] = y;
    xyz[xyzCount++] = z;
  } else {
    xyz[xyzCount++] = ctx.e0 * x + ctx.e4 * y + ctx.e8 * z + ctx.e12;
    xyz[xyzCount++] = ctx.e1 * x + ctx.e5 * y + ctx.e9 * z + ctx.e13;
    xyz[xyzCount++] = ctx.e2 * x + ctx.e6 * y + ctx.e10 * z + ctx.e14;
  }
  if (id >= nextStamp.length) {
    const n = nextStamp.length * 2;
    const stamps = new Int32Array(n);
    const tos = new Int32Array(n);
    stamps.set(nextStamp);
    tos.set(nextTo);
    nextStamp = stamps;
    nextTo = tos;
  }
  return id;
}

function link(from, to) {
  if (from === to) return;
  if (nextStamp[from] !== stamp) {
    nextStamp[from] = stamp;
    nextTo[from] = to;
  } else if (nextTo[from] !== to) ctx.manifold = false;
}

function resetEdges() {
  for (let i = 0; i < edgeN; i++) edgeTable[edgeSlot[i]] = EDGE_EMPTY;
  edgeN = 0;
}

function growEdgeRecs() {
  recCap *= 2;
  const copy = source => {
    const dest = new Int32Array(recCap);
    dest.set(source);
    return dest;
  };
  edgeSlot = copy(edgeSlot);
  k0 = copy(k0); k1 = copy(k1); k2 = copy(k2);
  k3 = copy(k3); k4 = copy(k4); k5 = copy(k5);
  edgeIds = copy(edgeIds);
}

function growEdgeTable() {
  edgeCap *= 2;
  edgeTable = new Int32Array(edgeCap);
  edgeTable.fill(EDGE_EMPTY);
  const mask = edgeCap - 1;
  for (let i = 0; i < edgeN; i++) {
    let slot = edgeHash(k0[i], k1[i], k2[i], k3[i], k4[i], k5[i]) & mask;
    while (edgeTable[slot] !== EDGE_EMPTY) slot = (slot + 1) & mask;
    edgeTable[slot] = i;
    edgeSlot[i] = slot;
  }
}

function finish(plane) {
  const pointCount = xyzCount / 3;
  if (!pointCount) return { empty: true };
  if (!ctx.manifold) return { fallback: true, reason: 'branch' };
  for (let id = 0; id < pointCount; id++) {
    if (nextStamp[id] !== stamp) return { fallback: true, reason: 'open' };
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
      at = nextTo[at];
      guard += 1;
    }
    if (at !== start || loop.length < 3) return { fallback: true, reason: 'cycle' };
    loops.push(loop);
  }

  const normal = plane.normal;
  if (Math.abs(normal.x) < 0.9) _axisU.set(1, 0, 0);
  else _axisU.set(0, 1, 0);
  _axisU.addScaledVector(normal, -_axisU.dot(normal)).normalize();
  _axisV.crossVectors(normal, _axisU);
  const uv = new Float64Array(pointCount * 2);
  const ux = _axisU.x, uy = _axisU.y, uz = _axisU.z;
  const vx = _axisV.x, vy = _axisV.y, vz = _axisV.z;
  for (let id = 0; id < pointCount; id++) {
    const x = xyz[id * 3];
    const y = xyz[id * 3 + 1];
    const z = xyz[id * 3 + 2];
    uv[id * 2] = ux * x + uy * y + uz * z;
    uv[id * 2 + 1] = vx * x + vy * y + vz * z;
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
    if (!seed || !ringContains(ids, uv, seed[0], seed[1])) return { fallback: true, reason: 'seed' };
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

  const output = [];
  for (const root of rings) {
    if (root.depth % 2 === 1) continue;
    const holes = [];
    for (const ring of rings) {
      if (ring.depth !== root.depth + 1) continue;
      if (!ringContains(root.ids, uv, ring.seed[0], ring.seed[1])) continue;
      let nearer = false;
      for (const other of rings) {
        if (other === root || other.depth !== root.depth) continue;
        if (Math.abs(other.area) < Math.abs(root.area)
          && ringContains(other.ids, uv, ring.seed[0], ring.seed[1])) nearer = true;
      }
      if (!nearer) holes.push(ring);
    }
    if (!appendRing(root, holes, uv, output)) return { fallback: true, reason: 'earcut' };
  }
  if (!output.length) return { empty: true };
  return { positions: Float32Array.from(output) };
}

function interiorPoint(ids, uv, positive) {
  const steps = ids.length < 8 ? ids.length : 8;
  for (let edge = 0; edge < steps; edge++) {
    for (const scale of [1e-6, 1e-8, 1e-4]) {
      const a = ids[edge] * 2;
      const b = ids[(edge + 1) % ids.length] * 2;
      const dx = uv[b] - uv[a];
      const dy = uv[b + 1] - uv[a + 1];
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const side = positive ? 1 : -1;
      const x = (uv[a] + uv[b]) / 2 + side * (-dy / length) * scale;
      const y = (uv[a + 1] + uv[b + 1]) / 2 + side * (dx / length) * scale;
      if (ringContains(ids, uv, x, y)) return [x, y];
    }
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
    if ((yi > y) !== (yj > y) && yj !== yi && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function appendRing(outer, holes, uv, output) {
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
    const a = ids[indices[i]] * 3;
    const b = ids[indices[i + 1]] * 3;
    const c = ids[indices[i + 2]] * 3;
    output.push(
      xyz[a], xyz[a + 1], xyz[a + 2],
      xyz[b], xyz[b + 1], xyz[b + 2],
      xyz[c], xyz[c + 1], xyz[c + 2],
    );
  }
  return true;
}
