import type { Manifest } from '../../types/index.ts';
import data from '../../../../../data/circuits.yaml';
import type { ClinicalCatalog } from '../clinical/catalog.ts';
import { ownTractIds } from '../diffusion/catalogs.ts';
import { createCircuitCatalog } from './catalog.ts';
import type { CircuitData } from './catalog.ts';

// A landmark draws only the anatomy's own streamlines, never another subject's.
export const loadCircuitCatalog = (
  manifest: Pick<Manifest, 'regions' | 'anatomy'>,
  clinical: Pick<ClinicalCatalog, 'search'>,
) =>
  createCircuitCatalog(
    data as CircuitData,
    manifest,
    clinical.search('', 'en').map((deficit) => deficit.id),
    ownTractIds(manifest.anatomy.id),
  );
