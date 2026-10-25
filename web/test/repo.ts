import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** The repository root, one level above `web/`. */
export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/** A repository file's text, by path from the repository root. */
function readRepoText(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

/** A repository JSON file, parsed. */
export function readRepoJson<T>(path: string): T {
  return JSON.parse(readRepoText(path)) as T;
}

/** A repository YAML file, parsed. */
export function readRepoYaml<T>(path: string): T {
  return parse(readRepoText(path)) as T;
}
