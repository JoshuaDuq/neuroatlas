import { readRepoJson } from '../../../../test/repo.ts';
import type { DisplaySettings, Region } from '../../types/index.ts';
import type { CatalogSettings } from './catalog.ts';

/** A published file under `public/models/`, parsed. */
export const readModel = <T>(path: string): T => readRepoJson<T>(`public/models/${path}`);

/** The default anatomy's id and the id of every published anatomy. */
export const anatomies = readModel<{ default: string; anatomies: { id: string }[] }>(
  'anatomies.json',
);

/** Test fixtures carry only the fields the code under test reads. */
export const asRegion = (fields: object): Region => fields as Region;
export const asSettings = (fields: object): CatalogSettings => fields as CatalogSettings;
export const asDisplaySettings = (fields: object): DisplaySettings => fields as DisplaySettings;
