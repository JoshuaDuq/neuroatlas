import { readDiffusionAsset } from './assets.js';
import { streamlineLengths } from './streamlines.js';

export async function decodeTractAsset(buffer) {
  const { NVMeshLoaders } = await import('@niivue/niivue');
  return NVMeshLoaders.readTRK(buffer);
}

/**
 * One download and decode per tract file, shared by the 3D lines and the MRI
 * navigator. The decoded points are also the lines' position buffer, so the
 * record is the only copy of them. A failed load is dropped and retried.
 */
export function createTractLoader(read = readDiffusionAsset) {
  const tracts = new Map();
  return bundle => {
    if (!tracts.has(bundle.file)) {
      const loading = read(bundle.file).then(async ({ buffer }) => {
        const tract = await decodeTractAsset(buffer);
        return { ...tract, lengths: streamlineLengths(tract.pts, tract.offsetPt0) };
      });
      tracts.set(bundle.file, loading);
      loading.catch(() => tracts.delete(bundle.file));
    }
    return tracts.get(bundle.file);
  };
}
