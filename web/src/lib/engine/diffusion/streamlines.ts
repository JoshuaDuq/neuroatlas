import { DiffusionInputError } from '../../core/diffusion/validation.ts';
import type { DiffusionInputCode } from '../../core/diffusion/validation.ts';

/** The code legacy gave streamline failures; C3's union does not list it, and only `instanceof` is read downstream. */
const STREAMLINES = 'streamlines' as DiffusionInputCode;

export interface LengthSummary {
  total: number;
  shown: number;
  mean: number | null;
  min: number | null;
  max: number | null;
}

export function streamlineLengths(points: Float32Array, offsets: Uint32Array): Float64Array {
  if (
    !points?.length ||
    points.length % 3 ||
    !offsets ||
    offsets.length < 2 ||
    offsets[0] !== 0 ||
    offsets.at(-1) !== points.length / 3
  ) {
    throw new DiffusionInputError(STREAMLINES, 'Invalid streamline points or offsets.');
  }
  const lengths = new Float64Array(offsets.length - 1);
  for (let tract = 0; tract < lengths.length; tract++) {
    const start = offsets[tract]!;
    const end = offsets[tract + 1]!;
    if (!Number.isInteger(start) || !Number.isInteger(end) || end - start < 2) {
      throw new DiffusionInputError(
        STREAMLINES,
        'Each streamline must contain at least two points.',
      );
    }
    let length = 0;
    for (let point = start * 3; point < (end - 1) * 3; point += 3) {
      const segment = Math.hypot(
        points[point + 3]! - points[point]!,
        points[point + 4]! - points[point + 1]!,
        points[point + 5]! - points[point + 2]!,
      );
      if (!Number.isFinite(segment)) {
        throw new DiffusionInputError(STREAMLINES, 'Streamline coordinates must be finite.');
      }
      length += segment;
    }
    if (length === 0) {
      throw new DiffusionInputError(STREAMLINES, 'A streamline must have nonzero length.');
    }
    lengths[tract] = length;
  }
  return lengths;
}

export function summarizeLengths(lengths: Float64Array, minimum: number): LengthSummary {
  if (!Number.isFinite(minimum) || minimum < 0) throw new RangeError('Invalid minimum length.');
  let shown = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const length of lengths) {
    if (length < minimum) continue;
    shown++;
    sum += length;
    min = Math.min(min, length);
    max = Math.max(max, length);
  }
  return {
    total: lengths.length,
    shown,
    mean: shown ? sum / shown : null,
    min: shown ? min : null,
    max: shown ? max : null,
  };
}
