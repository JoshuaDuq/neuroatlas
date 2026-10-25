import type { Manifest } from '../../types/index.ts';
import { anatomies, readModel } from '../catalog/test-support.ts';

/** Every published anatomy's manifest, by anatomy id. */
export const manifests: [string, Manifest][] = anatomies.anatomies.map(({ id }) => [
  id,
  readModel<Manifest>(`${id}/manifest.json`),
]);
