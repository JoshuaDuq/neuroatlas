import { BufferAttribute, BufferGeometry } from 'three';
import { streamlineLengths } from './streamlines.js';

export function filterTractGeometry(geometry, offsets, lengths, minimum) {
  if (!Number.isFinite(minimum) || minimum < 1) {
    throw new RangeError('Minimum streamline length must be at least 1 mm.');
  }
  const indices = geometry.index.array;
  let count = 0;
  for (let line = 0; line < lengths.length; line++) {
    if (lengths[line] < minimum) continue;
    for (let point = offsets[line]; point < offsets[line + 1] - 1; point++) {
      indices[count++] = point;
      indices[count++] = point + 1;
    }
  }
  geometry.index.needsUpdate = true;
  geometry.setDrawRange(0, count);
}

function directionColors(points, offsets) {
  const colors = new Uint8Array(points.length);
  for (let line = 0; line < offsets.length - 1; line++) {
    const start = offsets[line];
    const end = offsets[line + 1] - 1;
    for (let point = start; point <= end; point++) {
      const before = Math.max(start, point - 1) * 3;
      const after = Math.min(end, point + 1) * 3;
      const right = points[after] - points[before];
      const anterior = points[after + 1] - points[before + 1];
      const superior = points[after + 2] - points[before + 2];
      const magnitude = Math.hypot(right, anterior, superior);
      if (magnitude === 0) continue;
      colors[point * 3] = Math.round(255 * Math.abs(right) / magnitude);
      colors[point * 3 + 1] = Math.round(255 * Math.abs(anterior) / magnitude);
      colors[point * 3 + 2] = Math.round(255 * Math.abs(superior) / magnitude);
    }
  }
  return colors;
}

/** RAS millimeters → the normal viewer's R/S/−A meters; no registration. */
export function createTractGeometry(points, offsets) {
  const lengths = streamlineLengths(points, offsets);
  const positions = new Float32Array(points.length);
  for (let index = 0; index < points.length; index += 3) {
    positions[index] = points[index] / 1000;
    positions[index + 1] = points[index + 2] / 1000;
    positions[index + 2] = -points[index + 1] / 1000;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(directionColors(points, offsets), 3, true));
  const segments = points.length / 3 - lengths.length;
  geometry.setIndex(new BufferAttribute(new Uint32Array(segments * 2), 1));
  filterTractGeometry(geometry, offsets, lengths, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, lengths };
}
