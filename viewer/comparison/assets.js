import { fetchPublished } from '../model/published-assets.js';

async function readVerified(url, sha256) {
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error('Atlas comparison assets require a SHA-256 checksum.');
  }
  const response = await fetchPublished(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  const buffer = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const actual = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error(`Atlas comparison checksum mismatch: ${url}`);
  return buffer;
}

/** The requesting controller owns its successful and in-flight comparison loads. */
export async function readComparison(url, sha256) {
  const buffer = await readVerified(url, sha256);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
}

export const readComparisonGeometry = (url, sha256) => readVerified(url, sha256);
