import { Matrix3, Matrix4 } from 'three';

/** Exact scanner RAS → FreeSurfer surface RAS, expressed in R/S/−A meters. */
export function createReferenceTransform(rows) {
  if (!Array.isArray(rows) || rows.length !== 4
    || rows.some(row => !Array.isArray(row) || row.length !== 4 || row.some(value => !Number.isFinite(value)))
    || rows[3].some((value, index) => value !== (index === 3 ? 1 : 0))) {
    throw new TypeError('The reference requires a finite rigid RAS transform.');
  }
  const ras = new Matrix4().set(...rows.flat());
  const rotation = new Matrix3().setFromMatrix4(ras);
  const product = rotation.clone().transpose().multiply(rotation);
  if (Math.abs(rotation.determinant() - 1) > 1e-5
    || product.elements.some((value, index) => Math.abs(value - (index % 4 === 0 ? 1 : 0)) > 1e-5)) {
    throw new RangeError('The reference requires a rigid, orientation-preserving RAS transform.');
  }
  const world = new Matrix4().set(
    0.001, 0, 0, 0,
    0, 0, 0.001, 0,
    0, -0.001, 0, 0,
    0, 0, 0, 1,
  );
  return world.clone().multiply(ras).multiply(world.clone().invert());
}
