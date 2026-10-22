import { fetchAsset } from './asset-cache.js';

/** The anatomy index, taken from the head script's early request when it started one. */
export async function loadAnatomies(url) {
  return JSON.parse(new TextDecoder().decode(await fetchAsset(url)));
}

/** An omitted choice uses the index default; an explicit choice must be published. */
export function resolveAnatomy(published, requested) {
  const id = requested === undefined ? published.default : requested;
  if (!published.anatomies.some(anatomy => anatomy.id === id)) {
    throw new Error(`Unknown anatomy: ${id}`);
  }
  return id;
}
