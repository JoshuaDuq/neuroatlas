import type { Manifest } from '../../types/index.ts';
import data from '../../../../../data/neuropsychology.yaml';
import { createClinicalCatalog } from './catalog.ts';
import type { ClinicalData } from './types.ts';

/** The records are parsed at build time; nothing reads YAML in the browser. */
export const loadClinicalCatalog = (
  manifest: Pick<Manifest, 'regions'>,
  units: Readonly<Record<string, string>>,
) => createClinicalCatalog(data as ClinicalData, manifest, units);
