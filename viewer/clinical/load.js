import data from '../../data/neuropsychology.yaml';
import { createClinicalCatalog } from './catalog.js';

/** The records are parsed at build time; nothing reads YAML in the browser. */
export const loadClinicalCatalog = manifest => createClinicalCatalog(data, manifest);
