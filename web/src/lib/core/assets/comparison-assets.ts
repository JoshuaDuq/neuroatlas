import { fetchAsset, sha256Hex } from './asset-cache.ts';
import { AssetError } from './published-assets.ts';

async function readVerified(url: string, sha256: unknown): Promise<ArrayBuffer> {
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error('Atlas comparison assets require a SHA-256 checksum.');
  }
  const buffer = await fetchAsset(url);
  if ((await sha256Hex(buffer)) !== sha256) {
    throw new AssetError('asset-updated', `Atlas comparison checksum mismatch: ${url}`);
  }
  return buffer;
}

/** The requesting controller owns its successful comparison loads; only a request in flight is shared. */
export async function readComparison(url: string, sha256: unknown): Promise<unknown> {
  const buffer = await readVerified(url, sha256);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
}

export const readComparisonGeometry = (url: string, sha256: unknown): Promise<ArrayBuffer> =>
  readVerified(url, sha256);
