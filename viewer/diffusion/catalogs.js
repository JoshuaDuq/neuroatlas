import cdmd from '../../data/diffusion-cdmd.yaml';

/** Every tract catalog; config/model.yaml's tract_catalogs names the same files. */
export const TRACT_CATALOGS = [cdmd];

/** An anatomy's own tracts, or CDMD's as an independent reference for one without. */
export function tractCatalog(anatomy) {
  return TRACT_CATALOGS.find(catalog => catalog.anatomy === anatomy) ?? cdmd;
}
