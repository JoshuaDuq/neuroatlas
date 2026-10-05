import data from '../../data/circuits.yaml';
import { createCircuitCatalog } from './catalog.js';

export function loadCircuitCatalog(manifest, clinical) {
  return createCircuitCatalog(data, manifest, clinical.search('', 'en').map(deficit => deficit.id));
}
