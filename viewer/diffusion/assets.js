import { fetchPublished } from '../model/published-assets.js';

export async function readDiffusionAsset(file) {
  const url = `${import.meta.env.BASE_URL}diffusion/${file}`;
  return fetchDiffusionAsset(url);
}

export async function fetchDiffusionAsset(url) {
  let response;
  try {
    response = await fetchPublished(url);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new Error(`Could not fetch ${url}: ${error.message}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  return { url, buffer: await response.arrayBuffer() };
}
