import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** The published trees the viewer reads; everything under them gets its own version. */
export const PUBLISHED_TREES = ['models', 'diffusion'];

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * One published file: its sha256, the 16-hex-digit version its URL carries and
 * its byte size, which is the decoded size a gzip-encoded response streams.
 * A `.gz` file also records its contents: a server may send it with
 * `Content-Encoding: gzip` (Vite's does), and the browser then hands those over.
 */
export function publishedRecord(publicDirectory, path) {
  const bytes = readFileSync(resolve(publicDirectory, path));
  const sha256 = digest(bytes);
  const record = { version: sha256.slice(0, 16), sha256, size: bytes.byteLength };
  if (path.endsWith('.gz')) {
    const contents = gunzipSync(bytes);
    record.gunzipped = { sha256: digest(contents), size: contents.byteLength };
  }
  return record;
}

/** Every published file keyed by its path from `public/`, with `/` separators. */
export function publishedFiles(publicDirectory) {
  const files = {};
  function walk(directory) {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        const key = relative(publicDirectory, path).split(sep).join('/');
        files[key] = publishedRecord(publicDirectory, key);
      }
    }
  }
  for (const tree of PUBLISHED_TREES) walk(resolve(publicDirectory, tree));
  return files;
}
