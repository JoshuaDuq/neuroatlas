import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export function publishedVersion(publicDirectory) {
  const digest = createHash('sha256');
  function walk(directory) {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else digest.update(relative(publicDirectory, path)).update(readFileSync(path));
    }
  }
  walk(resolve(publicDirectory, 'models'));
  walk(resolve(publicDirectory, 'diffusion'));
  return digest.digest('hex').slice(0, 16);
}
