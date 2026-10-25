import { fetchAsset } from './asset-cache.ts';

export interface PublishedAnatomies {
  default: string;
  anatomies: { id: string }[];
}

/** The anatomy index, taken from the head script's early request when it started one. */
export async function loadAnatomies(url: string | URL): Promise<PublishedAnatomies> {
  return JSON.parse(new TextDecoder().decode(await fetchAsset(url)));
}

/** An omitted choice uses the index default; an explicit choice must be published. */
export function resolveAnatomy(published: PublishedAnatomies, requested?: string): string {
  const id = requested === undefined ? published.default : requested;
  if (!published.anatomies.some((anatomy) => anatomy.id === id)) {
    throw new Error(`Unknown anatomy: ${id}`);
  }
  return id;
}
