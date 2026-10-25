import { ASSET_BASE } from '../../../../build/site.ts';
import { fetchAsset } from './asset-cache.ts';

export async function readDiffusionAsset(file: string) {
  return fetchDiffusionAsset(`${ASSET_BASE}diffusion/${file}`);
}

export async function fetchDiffusionAsset(url: string) {
  return { url, buffer: await fetchAsset(url) };
}
