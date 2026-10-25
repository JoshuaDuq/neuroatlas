import type { Manifest } from '../../types/index.ts';
import data from '../../../../../data/circuits.yaml';
import type { ClinicalCatalog } from '../clinical/catalog.ts';
import { createCircuitCatalog } from './catalog.ts';
import type { CircuitData } from './catalog.ts';

export const loadCircuitCatalog = (
  manifest: Pick<Manifest, 'regions'>,
  clinical: Pick<ClinicalCatalog, 'search'>,
) =>
  createCircuitCatalog(
    data as CircuitData,
    manifest,
    clinical.search('', 'en').map((deficit) => deficit.id),
  );
