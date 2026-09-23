import { Matrix4 } from 'three';
import { fetchPublished } from '../model/published-assets.js';

/** Native array, x-fastest; inverse affine maps source RAS to voxel centers. */
export class Volume {
  constructor(metadata, data) {
    const { shape, order, voxel_to_surface_ras_mm: affine } = metadata;
    if (!Array.isArray(shape) || shape.length !== 3 || !shape.every(n => Number.isInteger(n) && n > 0) || order !== 'F') {
      throw new Error('Unsupported volume shape or storage order.');
    }
    if (data.length !== shape.reduce((a,b) => a*b)) throw new Error('Volume data length mismatch.');
    if (!Array.isArray(affine) || affine.length !== 4 ||
        affine.some(row => row.length !== 4 || !row.every(Number.isFinite))) throw new Error('Invalid volume affine.');
    const matrix = new Matrix4().set(...affine.flat());
    if (matrix.determinant() === 0) throw new Error('Singular volume affine.');
    this.inverse = matrix.invert().elements;
    this.shape = shape;
    this.data = data;
  }

  voxel([r,a,s]) {
    const m = this.inverse;
    return [m[0]*r+m[4]*a+m[8]*s+m[12], m[1]*r+m[5]*a+m[9]*s+m[13], m[2]*r+m[6]*a+m[10]*s+m[14]];
  }

  /**
   * The label whose trilinear weight over the eight surrounding voxels is
   * largest (ANTs' genericLabel rule). Exact at every voxel centre and never a
   * label absent from those eight; outside the grid weighs as background.
   * LABEL_AT in tissues/label-sampling.js is this rule on the GPU, with the
   * same corner order so that ties break alike.
   */
  label(point) {
    const [x,y,z] = this.voxel(point), [nx,ny,nz] = this.shape;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x-ix, fy = y-iy, fz = z-iz;
    const labels = this.candidates ??= new Float64Array(8);
    const weights = this.weights ??= new Float64Array(8);
    let count = 0;
    for (let corner=0; corner<8; corner++) {
      const i = corner & 1, j = (corner >> 1) & 1, k = (corner >> 2) & 1;
      const cx = ix+i, cy = iy+j, cz = iz+k;
      const inside = cx >= 0 && cy >= 0 && cz >= 0 && cx < nx && cy < ny && cz < nz;
      const value = inside ? this.data[cx + nx*(cy + ny*cz)] : 0;
      const weight = (i ? fx : 1-fx)*(j ? fy : 1-fy)*(k ? fz : 1-fz);
      let seen = 0;
      while (seen < count && labels[seen] !== value) seen++;
      if (seen === count) { labels[count] = value; weights[count++] = weight; }
      else weights[seen] += weight;
    }
    let best = 0;
    for (let n=1; n<count; n++) if (weights[n] > weights[best]) best = n;
    return labels[best];
  }

  linear(point) {
    const [x,y,z] = this.voxel(point), [nx,ny,nz] = this.shape;
    if (x < 0 || y < 0 || z < 0 || x > nx-1 || y > ny-1 || z > nz-1) return 0;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const dx = x-ix, dy = y-iy, dz = z-iz;
    let value = 0;
    for (let k=0; k<2; k++) for (let j=0; j<2; j++) for (let i=0; i<2; i++) {
      const index = Math.min(ix+i,nx-1) + nx*(Math.min(iy+j,ny-1) + ny*Math.min(iz+k,nz-1));
      value += this.data[index]*(i ? dx : 1-dx)*(j ? dy : 1-dy)*(k ? dz : 1-dz);
    }
    return value;
  }
}

async function digest(buffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map(value => value.toString(16).padStart(2,'0')).join('');
}

export async function loadVolume(metadata, baseUrl) {
  const response = await fetchPublished(new URL(metadata.file, baseUrl));
  if (!response.ok) throw new Error(`Volume download failed: HTTP ${response.status}`);
  const compressed = await response.arrayBuffer();
  if (await digest(compressed) !== metadata.sha256) throw new Error('Volume file checksum mismatch.');
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  if (buffer.byteLength !== metadata.byte_length || await digest(buffer) !== metadata.decoded_sha256) {
    throw new Error('Decoded volume integrity check failed.');
  }
  let data;
  if (metadata.dtype === '|u1') data = new Uint8Array(buffer);
  else if (metadata.dtype === '<u2') {
    const view = new DataView(buffer);
    data = new Uint16Array(buffer.byteLength / 2);
    for (let i=0; i<data.length; i++) data[i] = view.getUint16(i*2, true);
  } else throw new Error(`Unsupported volume data type: ${metadata.dtype}`);
  return new Volume(metadata, data);
}

export async function loadVolumes(url) {
  const response = await fetchPublished(url);
  if (!response.ok) throw new Error(`Volume metadata failed: HTTP ${response.status}`);
  const metadata = await response.json();
  if (metadata.schema_version !== 1) throw new Error('Unsupported volume schema.');
  const [mri, segmentation] = await Promise.all([
    loadVolume(metadata.mri, url), loadVolume(metadata.segmentation, url),
  ]);
  return { metadata, mri, segmentation };
}
