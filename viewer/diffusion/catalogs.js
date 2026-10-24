import snail from '../../data/diffusion.yaml';
import cdmd from '../../data/diffusion-cdmd.yaml';

/** Every tract catalog; config/model.yaml's tract_catalogs names the same files. */
export const TRACT_CATALOGS = [snail, cdmd];

/** An anatomy's own tracts, or SNAIL's as an independent reference for one without. */
export function tractCatalog(anatomy) {
  return TRACT_CATALOGS.find(catalog => catalog.anatomy === anatomy) ?? snail;
}
