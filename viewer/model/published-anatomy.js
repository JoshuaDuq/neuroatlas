import { fetchPublished } from './published-assets.js';

export async function loadAnatomies(url) {
  const response = await fetchPublished(url);
  if (!response.ok) throw new Error(`Anatomy index request failed: HTTP ${response.status}`);
  return response.json();
}

/** An omitted choice uses the index default; an explicit choice must be published. */
export function resolveAnatomy(published, requested) {
  const id = requested === undefined ? published.default : requested;
  if (!published.anatomies.some(anatomy => anatomy.id === id)) {
    throw new Error(`Unknown anatomy: ${id}`);
  }
  return id;
}
