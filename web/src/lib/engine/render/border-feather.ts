import { BufferAttribute, DataTexture, FloatType, RGBAFormat } from 'three';
import type {
  BufferGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from 'three';

/**
 * How far along the surface a parcel's colour fades into its neighbour's, in metres.
 *
 * Parcels are cut through triangle midpoints and centres, so a hard border
 * zig-zags at the ~0.8 mm vertex spacing. A fade over about two vertex spacings
 * hides the teeth; parcels narrower than twice this never reach full colour.
 */
export const FEATHER_RADIUS = 0.0015;

/** Up to two neighbour slots and their weights: three parcels meet at most. */
export const FEATHER_ITEM_SIZE = 4;

/**
 * For every mesh, the global ids of its vertices that sit on another mesh's
 * vertex, with the other meshes there. The partition writes one point for both
 * sides of a border, so equal float bits are the test, not a tolerance.
 */
function sharedVertices(meshes: readonly Mesh[]) {
  const offsets = [0];
  for (const mesh of meshes) {
    offsets.push(offsets.at(-1)! + mesh.geometry.attributes.position!.count);
  }
  const total = offsets.at(-1)!;
  const positions = new Float32Array(total * 3);
  meshes.forEach((mesh, index) => {
    const attribute = mesh.geometry.attributes.position!;
    for (let vertex = 0; vertex < attribute.count; vertex++) {
      const at = (offsets[index]! + vertex) * 3;
      positions[at] = attribute.getX(vertex);
      positions[at + 1] = attribute.getY(vertex);
      positions[at + 2] = attribute.getZ(vertex);
    }
  });
  const bits = new Uint32Array(positions.buffer);
  const owner = new Int32Array(total);
  meshes.forEach((_, index) => owner.fill(index, offsets[index], offsets[index + 1]));

  // Open addressing on the position bits: each slot holds the first vertex seen there.
  const mask = 2 ** Math.ceil(Math.log2(total * 2 + 1)) - 1;
  const table = new Int32Array(mask + 1).fill(-1);
  const first = new Int32Array(total);
  // The distinct meshes meeting at each first vertex.
  const meeting = new Int32Array(total * 3).fill(-1);
  for (let vertex = 0; vertex < total; vertex++) {
    const x = bits[vertex * 3]!;
    const y = bits[vertex * 3 + 1]!;
    const z = bits[vertex * 3 + 2]!;
    let slot =
      (Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ Math.imul(z, 0xc2b2ae3d)) & mask;
    while (table[slot] !== -1) {
      const other = table[slot]!;
      if (bits[other * 3] === x && bits[other * 3 + 1] === y && bits[other * 3 + 2] === z) break;
      slot = (slot + 1) & mask;
    }
    if (table[slot] === -1) table[slot] = vertex;
    const root = table[slot]!;
    first[vertex] = root;
    for (let k = 0; k < 3; k++) {
      const at = root * 3 + k;
      if (meeting[at] === owner[vertex]) break;
      if (meeting[at] === -1) {
        meeting[at] = owner[vertex]!;
        break;
      }
      if (k === 2) throw new Error('More than three parcels meet at one surface point.');
    }
  }
  return { offsets, first, meeting };
}

/** Each vertex's neighbours: both directions of every triangle edge. */
function adjacency(index: ArrayLike<number>, count: number) {
  const degree = new Int32Array(count + 1);
  for (let i = 0; i < index.length; i++) degree[index[i]! + 1]! += 2;
  for (let vertex = 0; vertex < count; vertex++) degree[vertex + 1]! += degree[vertex]!;
  const next = degree.slice(0, count);
  const targets = new Int32Array(degree[count]!);
  for (let i = 0; i < index.length; i += 3) {
    for (let corner = 0; corner < 3; corner++) {
      const a = index[i + corner]!;
      const b = index[i + ((corner + 1) % 3)]!;
      targets[next[a]!++] = b;
      targets[next[b]!++] = a;
    }
  }
  return { starts: degree, targets };
}

/**
 * Surface distance from each vertex to its nearest seed within `radius`, by
 * Dijkstra along triangle edges, and which seed that is (-1 beyond the radius).
 */
function nearestSeeds(geometry: BufferGeometry, seeds: readonly number[], radius: number) {
  const position = geometry.attributes.position!;
  const count = position.count;
  const { starts, targets } = adjacency(geometry.index!.array, count);
  const distance = new Float64Array(count).fill(Infinity);
  const seed = new Int32Array(count).fill(-1);
  // A binary heap of (distance, vertex) with stale entries skipped on pop.
  let heapKeys = new Float64Array(Math.max(16, seeds.length * 2));
  let heapValues = new Int32Array(heapKeys.length);
  let size = 0;
  const push = (key: number, value: number) => {
    if (size === heapKeys.length) {
      const keys = new Float64Array(size * 2);
      keys.set(heapKeys);
      heapKeys = keys;
      const values = new Int32Array(size * 2);
      values.set(heapValues);
      heapValues = values;
    }
    let at = size++;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (heapKeys[parent]! <= key) break;
      heapKeys[at] = heapKeys[parent]!;
      heapValues[at] = heapValues[parent]!;
      at = parent;
    }
    heapKeys[at] = key;
    heapValues[at] = value;
  };
  const pop = () => {
    const value = heapValues[0]!;
    const key = heapKeys[--size]!;
    const last = heapValues[size]!;
    let at = 0;
    for (;;) {
      let child = at * 2 + 1;
      if (child >= size) break;
      if (child + 1 < size && heapKeys[child + 1]! < heapKeys[child]!) child += 1;
      if (heapKeys[child]! >= key) break;
      heapKeys[at] = heapKeys[child]!;
      heapValues[at] = heapValues[child]!;
      at = child;
    }
    heapKeys[at] = key;
    heapValues[at] = last;
    return value;
  };
  for (const vertex of seeds) {
    distance[vertex] = 0;
    seed[vertex] = vertex;
    push(0, vertex);
  }
  while (size > 0) {
    const key = heapKeys[0]!;
    const vertex = pop();
    if (key > distance[vertex]!) continue;
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    for (let i = starts[vertex]!; i < starts[vertex + 1]!; i++) {
      const other = targets[i]!;
      const reach =
        key +
        Math.hypot(position.getX(other) - x, position.getY(other) - y, position.getZ(other) - z);
      if (reach >= radius || reach >= distance[other]!) continue;
      distance[other] = reach;
      seed[other] = seed[vertex]!;
      push(reach, other);
    }
  }
  return { distance, seed };
}

/**
 * Attach `_feather` to every mesh: the slots (indices into `meshes`) of the up
 * to two parcels across the nearest border, and how much of each to mix in.
 *
 * On a shared vertex the parcels meeting there split it evenly, so both sides
 * draw the same colour and the border is continuous; the share falls linearly
 * to zero `radius` in. Meshes that share no vertex get zero weights.
 */
export function featherBorders(meshes: readonly Mesh[], radius = FEATHER_RADIUS): void {
  if (!(radius > 0)) throw new RangeError('The feather radius must be positive.');
  for (const mesh of meshes) {
    if (!mesh.geometry.index) throw new Error(`Feathering needs indexed geometry: ${mesh.name}`);
  }
  const { offsets, first, meeting } = sharedVertices(meshes);
  meshes.forEach((mesh, slot) => {
    const count = mesh.geometry.attributes.position!.count;
    const others = new Map<number, number[]>();
    for (let vertex = 0; vertex < count; vertex++) {
      const root = first[offsets[slot]! + vertex]!;
      const across = [0, 1, 2]
        .map((k) => meeting[root * 3 + k]!)
        .filter((other) => other !== -1 && other !== slot);
      if (across.length) others.set(vertex, across);
    }
    const { distance, seed } = nearestSeeds(mesh.geometry, [...others.keys()], radius);
    const values = new Float32Array(count * FEATHER_ITEM_SIZE);
    for (let vertex = 0; vertex < count; vertex++) {
      if (seed[vertex] === -1) continue;
      const across = others.get(seed[vertex]!)!;
      const weight = (1 - distance[vertex]! / radius) / (across.length + 1);
      across.forEach((other, k) => {
        values[vertex * FEATHER_ITEM_SIZE + k * 2] = other;
        values[vertex * FEATHER_ITEM_SIZE + k * 2 + 1] = weight;
      });
    }
    mesh.geometry.setAttribute('_feather', new BufferAttribute(values, FEATHER_ITEM_SIZE));
  });
}

/** One texel per slot: the linear colour each parcel is drawn in, alpha 0 while it is hidden. */
export function createFeatherPalette(count: number): DataTexture {
  return new DataTexture(new Float32Array(count * 4), count, 1, RGBAFormat, FloatType);
}

/** Copy each mesh's current colour and visibility into its slot. */
export function writeFeatherPalette(
  texture: DataTexture,
  meshes: readonly Mesh<BufferGeometry, MeshStandardMaterial>[],
): void {
  const data = texture.image.data as Float32Array;
  meshes.forEach((mesh, slot) => {
    const { r, g, b } = mesh.material.color;
    data.set([r, g, b, mesh.visible ? 1 : 0], slot * 4);
  });
  texture.needsUpdate = true;
}

/**
 * Mix the parcels across each border into this material's colour. Chained like
 * the MRI appearance, so it composes with whatever the material already draws.
 * The vertex stage looks the colours up, because a slot cannot be interpolated.
 */
export function addBorderFeather(material: Material, palette: DataTexture): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  const uniform = { value: palette };
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    shader.uniforms.featherPalette = uniform;
    shader.vertexShader = `attribute vec4 _feather;
uniform highp sampler2D featherPalette;
varying vec4 vFeather;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vec4 featherA = texelFetch(featherPalette, ivec2(int(_feather.x + 0.5), 0), 0);
vec4 featherB = texelFetch(featherPalette, ivec2(int(_feather.z + 0.5), 0), 0);
float weightA = _feather.y * featherA.a;
float weightB = _feather.w * featherB.a;
vFeather = vec4(featherA.rgb * weightA + featherB.rgb * weightB, weightA + weightB);`,
    );
    shader.fragmentShader = `varying vec4 vFeather;
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb = diffuseColor.rgb * (1.0 - vFeather.a) + vFeather.rgb;`,
    );
  };
  material.customProgramCacheKey = () => `${key}-feather`;
  material.needsUpdate = true;
}
