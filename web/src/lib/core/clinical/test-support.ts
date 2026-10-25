import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Manifest } from '../../types/index.ts';
import { anatomies, readModel } from '../catalog/test-support.ts';

const repository = new URL('../../../../../', import.meta.url);

/** A file under the repository root, as text. */
export const readRepository = (path: string) => readFileSync(new URL(path, repository), 'utf8');

/** A YAML file under the repository root, parsed. */
export const readYaml = <T>(path: string): T => parse(readRepository(path)) as T;

/** Every published anatomy's manifest, by anatomy id. */
export const manifests: [string, Manifest][] = anatomies.anatomies.map(({ id }) => [
  id,
  readModel<Manifest>(`${id}/manifest.json`),
]);
