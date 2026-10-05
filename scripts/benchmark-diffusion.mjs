import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { NVMesh, NVMeshLoaders } from '@niivue/niivue';
import { parse } from 'yaml';
import { createTractGeometry } from '../viewer/diffusion/native-geometry.js';

const directory = new URL('../public/diffusion/', import.meta.url);
const catalog = parse(await readFile(new URL('../data/diffusion.yaml', import.meta.url), 'utf8'));

function measureGeometry(data, radius) {
  let uploadedBytes = 0;
  // Measure CPU preparation and buffer sizes; this is not a GPU frame-rate test.
  const graphics = { bindBuffer() {}, bufferData(target, buffer) { uploadedBytes += buffer.byteLength; } };
  const mesh = Object.assign(Object.create(NVMesh.prototype), data, {
    fiberLength: 1, fiberSides: 5, fiberRadius: radius, fiberColor: 'Local',
    fiberDither: 0, fiberDecimationStride: 1, fiberOcclusion: 0, f32PerVertex: 5,
    groups: null, fiberGroupColormap: null,
  });
  const started = performance.now();
  mesh.updateFibers(graphics);
  return { radius_mm: radius, geometry_ms: Math.round(performance.now() - started),
    buffer_mb: Number((uploadedBytes / 1e6).toFixed(1)), indices: mesh.indexCount };
}

function measureNativeGeometry(data) {
  const started = performance.now();
  const { geometry } = createTractGeometry(data.pts, data.offsetPt0);
  const elapsed = performance.now() - started;
  const bytes = geometry.index.array.byteLength
    + geometry.attributes.position.array.byteLength
    + geometry.attributes.color.array.byteLength;
  const result = { geometry_ms: Math.round(elapsed),
    buffer_mb: Number((bytes / 1e6).toFixed(1)), indices: geometry.drawRange.count };
  geometry.dispose();
  return result;
}

for (const id of ['cst-right', 'cc-3']) {
  const bundle = catalog.bundles.find(bundle => bundle.id === id);
  const bytes = gunzipSync(await readFile(new URL(bundle.file, directory)));
  const data = await NVMeshLoaders.readTRK(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  console.log(JSON.stringify({ bundle: id, streamlines: data.offsetPt0.length - 1,
    points: data.pts.length / 3, tubes: measureGeometry(data, 0.3),
    niivue_lines: measureGeometry(data, 0), native_lines: measureNativeGeometry(data) }));
}
