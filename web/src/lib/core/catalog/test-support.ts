/// <reference types="node" />
import { readFileSync } from 'node:fs';
import type { DisplaySettings, Region } from '../../types/index.ts';
import type { CatalogSettings } from './catalog.ts';

const models = new URL('../../../../../public/models/', import.meta.url);

/** A published file under `public/models/`, parsed. */
export const readModel = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, models), 'utf8')) as T;

/** The default anatomy's id and the id of every published anatomy. */
export const anatomies = readModel<{ default: string; anatomies: { id: string }[] }>(
  'anatomies.json',
);

/** Test fixtures carry only the fields the code under test reads. */
export const asRegion = (fields: object): Region => fields as Region;
export const asSettings = (fields: object): CatalogSettings => fields as CatalogSettings;
export const asDisplaySettings = (fields: object): DisplaySettings => fields as DisplaySettings;
