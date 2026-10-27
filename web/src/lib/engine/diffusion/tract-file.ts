import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import type { TractBundle } from '../../core/diffusion/catalogs.ts';
import { streamlineLengths } from './streamlines.ts';

/** What NiiVue's `readTRK` returns, plus the length of every streamline. */
export type LoadedTract = Awaited<ReturnType<typeof decodeTractAsset>> & { lengths: Float64Array };

export type TractLoader = (bundle: Pick<TractBundle, 'file'>) => Promise<LoadedTract>;

export async function decodeTractAsset(buffer: ArrayBuffer) {
  const { NVMeshLoaders } = await import('@niivue/niivue');
  return NVMeshLoaders.readTRK(buffer);
}

/**
 * One download and decode per tract file, shared by the 3D lines and the MRI navigator. The decoded
 * points are also the lines' position buffer, so the record is the only copy of them. A failed load
 * is dropped and retried.
 */
export function createTractLoader(
  read: (file: string) => Promise<{ buffer: ArrayBuffer }> = readDiffusionAsset,
): TractLoader {
  const tracts = new Map<string, Promise<LoadedTract>>();
  return (bundle) => {
    let loading = tracts.get(bundle.file);
    if (!loading) {
      loading = read(bundle.file).then(async ({ buffer }) => {
        const tract = await decodeTractAsset(buffer);
        return { ...tract, lengths: streamlineLengths(tract.pts, tract.offsetPt0) };
      });
      tracts.set(bundle.file, loading);
      loading.catch(() => tracts.delete(bundle.file));
    }
    return loading;
  };
}
