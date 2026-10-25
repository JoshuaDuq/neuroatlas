/** One published file: its sha256, the 16-hex-digit version its URL carries and its decoded byte size. */
export interface PublishedRecord {
  version: string;
  sha256: string;
  size: number;
  /** A `.gz` file's contents: a server may send it with `Content-Encoding: gzip`, and the browser then hands those over. */
  gunzipped?: { sha256: string; size: number };
}

export interface PublishedFiles {
  base: string;
  files: Record<string, PublishedRecord> | null;
}

/**
 * Every published file's version, sha256 and decoded size, keyed by its path
 * from `public/`. The build (build/published-files.ts) replaces this module with
 * the map; without it (Node tests, an embedder's own bundler) `files` stays null
 * and requests go out unversioned and unverified.
 */
const PUBLISHED: PublishedFiles = { base: '/', files: null };

export default PUBLISHED;
