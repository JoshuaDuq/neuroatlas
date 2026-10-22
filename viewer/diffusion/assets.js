import { fetchAsset } from '../model/asset-cache.js';

export async function readDiffusionAsset(file) {
  const url = `${import.meta.env.BASE_URL}diffusion/${file}`;
  return fetchDiffusionAsset(url);
}

export async function fetchDiffusionAsset(url) {
  return { url, buffer: await fetchAsset(url) };
}
