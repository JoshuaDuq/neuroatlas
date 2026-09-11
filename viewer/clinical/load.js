import { parse } from 'yaml';
import source from '../../data/neuropsychology.yaml?raw';
import { createClinicalCatalog } from './catalog.js';

export const loadClinicalCatalog = manifest => createClinicalCatalog(parse(source), manifest);
