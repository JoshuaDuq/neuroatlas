import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { streamlineLengths } from './streamlines.ts';

/** RAS millimeters → the normal viewer's R/S/−A meters; no registration. Applied as the lines' matrix. */
export const RAS_MM_TO_WORLD = new Matrix4().set(
  0.001,
  0,
  0,
  0,
  0,
  0,
  0.001,
  0,
  0,
  -0.001,
  0,
  0,
  0,
  0,
  0,
  1,
);

export function filterTractGeometry(
  geometry: BufferGeometry,
  offsets: Uint32Array,
  lengths: Float64Array,
  minimum: number,
): void {
  if (!Number.isFinite(minimum) || minimum < 1) {
    throw new RangeError('Minimum streamline length must be at least 1 mm.');
  }
  const index = geometry.index!;
  const indices = index.array as Uint32Array;
  let count = 0;
  for (let line = 0; line < lengths.length; line++) {
    if (lengths[line]! < minimum) continue;
    for (let point = offsets[line]!; point < offsets[line + 1]! - 1; point++) {
      indices[count++] = point;
      indices[count++] = point + 1;
    }
  }
  index.needsUpdate = true;
  geometry.setDrawRange(0, count);
}

// Direction colours are display values, as in NiiVue; three.js reads vertex colours as linear and
// encodes them to sRGB on output, so each 8-bit display level is stored as its linear value.
const LINEAR_LEVELS = Uint16Array.from({ length: 256 }, (_, level) => {
  const value = level / 255;
  return Math.round(65535 * (value < 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
});

function directionColors(points: Float32Array, offsets: Uint32Array): Uint16Array {
  const colors = new Uint16Array(points.length);
  for (let line = 0; line < offsets.length - 1; line++) {
    const start = offsets[line]!;
    const end = offsets[line + 1]! - 1;
    for (let point = start; point <= end; point++) {
      const before = Math.max(start, point - 1) * 3;
      const after = Math.min(end, point + 1) * 3;
      const right = points[after]! - points[before]!;
      const anterior = points[after + 1]! - points[before + 1]!;
      const superior = points[after + 2]! - points[before + 2]!;
      const magnitude = Math.hypot(right, anterior, superior);
      if (magnitude === 0) continue;
      colors[point * 3] = LINEAR_LEVELS[Math.round((255 * Math.abs(right)) / magnitude)]!;
      colors[point * 3 + 1] = LINEAR_LEVELS[Math.round((255 * Math.abs(anterior)) / magnitude)]!;
      colors[point * 3 + 2] = LINEAR_LEVELS[Math.round((255 * Math.abs(superior)) / magnitude)]!;
    }
  }
  return colors;
}

/**
 * Lines over the source points themselves, in RAS millimeters: draw them with RAS_MM_TO_WORLD as
 * their matrix. The points are shared, never copied, so the MRI navigator can read the same decode.
 */
export function createTractGeometry(
  points: Float32Array,
  offsets: Uint32Array,
  lengths: Float64Array = streamlineLengths(points, offsets),
): { geometry: BufferGeometry; lengths: Float64Array } {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(points, 3));
  geometry.setAttribute('color', new BufferAttribute(directionColors(points, offsets), 3, true));
  const segments = points.length / 3 - lengths.length;
  geometry.setIndex(new BufferAttribute(new Uint32Array(segments * 2), 1));
  filterTractGeometry(geometry, offsets, lengths, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, lengths };
}
