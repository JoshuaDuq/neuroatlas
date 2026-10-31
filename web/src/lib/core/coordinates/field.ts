import type { CoordinateField as FieldRecord } from '../../types/index.ts';
import { fetchAsset, sha256Hex } from '../assets/asset-cache.ts';
import type { Coordinate } from './parse.ts';

/** A template's field, decoded: where a point in its millimetres lands on this brain. */
export interface Field {
  /** Surface RAS mm, or null where a node it needs lies beyond the template's brain. */
  map(point: Readonly<Coordinate>): Coordinate | null;
}

/** A diagonal node-to-template affine as numpy inverts it: node = scale·p + offset. */
function inverseAxes(affine: FieldRecord['node_to_template_mm']) {
  const valid =
    affine.length === 4 &&
    affine.every((row) => row.length === 4 && row.every(Number.isFinite)) &&
    affine[3]!.every((value, column) => value === (column === 3 ? 1 : 0)) &&
    [0, 1, 2].every((row) =>
      [0, 1, 2].every((column) => (row === column) === (affine[row]![column] !== 0)),
    );
  if (!valid) throw new Error('A coordinate field needs an axis-aligned node affine.');
  const scale = [0, 1, 2].map((axis) => 1 / affine[axis]![axis]!);
  return { scale, offset: [0, 1, 2].map((axis) => -affine[axis]![3]! * scale[axis]!) };
}

/** The field over `data`, int16 node displacements with x fastest and the three components interleaved. */
export function createField(record: FieldRecord, data: Int16Array): Field {
  const { shape, components, dtype, order, interleaved, unit_mm: unit, outside } = record;
  if (
    shape.length !== 3 ||
    !shape.every((n) => Number.isInteger(n) && n >= 2) ||
    components !== 3 ||
    dtype !== '<i2' ||
    order !== 'F' ||
    !interleaved
  ) {
    throw new Error('Unsupported coordinate field layout.');
  }
  if (data.length !== shape[0]! * shape[1]! * shape[2]! * 3) {
    throw new Error('Coordinate field data length mismatch.');
  }
  if (!(unit > 0) || !Number.isInteger(outside)) {
    throw new Error('Invalid coordinate field unit or outside value.');
  }
  const [nx, ny, nz] = shape as [number, number, number];
  const { scale, offset } = inverseAxes(record.node_to_template_mm);
  return {
    // brain_model/layers/coordinate_spaces.py `map_points`, in its corner order.
    map(point) {
      const node = point.map((value, axis) => scale[axis]! * value + offset[axis]!);
      const base = node.map(Math.floor) as Coordinate;
      const [bx, by, bz] = base;
      if (bx < 0 || by < 0 || bz < 0 || bx > nx - 2 || by > ny - 2 || bz > nz - 2) return null;
      const fraction = node.map((value, axis) => value - base[axis]!);
      const sum = [0, 0, 0];
      for (let corner = 0; corner < 8; corner++) {
        const i = (corner >> 2) & 1,
          j = (corner >> 1) & 1,
          k = corner & 1;
        const index = 3 * (bx + i + nx * (by + j + ny * (bz + k)));
        const weight =
          (i ? fraction[0]! : 1 - fraction[0]!) *
          (j ? fraction[1]! : 1 - fraction[1]!) *
          (k ? fraction[2]! : 1 - fraction[2]!);
        for (let c = 0; c < 3; c++) {
          const value = data[index + c]!;
          if (value === outside) return null;
          sum[c]! += weight * value;
        }
      }
      return point.map((value, axis) => value + sum[axis]! * unit) as Coordinate;
    },
  };
}

/** Download, verify and decode a template's field, as `loadVolume` does a label volume. */
export async function loadField(record: FieldRecord, baseUrl: string | URL): Promise<Field> {
  if (record.compression !== 'gzip') {
    throw new Error(`Unsupported coordinate field compression: ${record.compression}`);
  }
  const compressed = await fetchAsset(new URL(record.file, baseUrl));
  if ((await sha256Hex(compressed)) !== record.sha256) {
    throw new Error('Coordinate field checksum mismatch.');
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  if (
    buffer.byteLength !== record.byte_length ||
    (await sha256Hex(buffer)) !== record.decoded_sha256
  ) {
    throw new Error('Decoded coordinate field integrity check failed.');
  }
  const view = new DataView(buffer);
  const data = new Int16Array(buffer.byteLength / 2);
  for (let i = 0; i < data.length; i++) data[i] = view.getInt16(i * 2, true);
  return createField(record, data);
}
