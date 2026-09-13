/**
 * FreeSurfer wmparc parcels: the white matter nearest each Desikan cortical
 * region, named for that region. The lobe groups are a navigation aid.
 */
const FRONTAL = 'Frontal white matter';
const CENTRAL = 'Central white matter';
const PARIETAL = 'Parietal white matter';
const TEMPORAL = 'Temporal white matter';
const OCCIPITAL = 'Occipital white matter';
const CINGULATE = 'Cingulate white matter';
const LIMBIC = 'Limbic white matter';
const INSULAR = 'Insular white matter';

const parcel = (structure, group, aliases = []) =>
  ({ name: `White matter of the ${structure}`, group, aliases });

export const WHITE_MATTER_LABELS = {
  bankssts: parcel('banks of the superior temporal sulcus', TEMPORAL),
  caudalanteriorcingulate: parcel('caudal anterior cingulate cortex', CINGULATE),
  caudalmiddlefrontal: parcel('caudal middle frontal gyrus', FRONTAL),
  cuneus: parcel('cuneus', OCCIPITAL),
  entorhinal: parcel('entorhinal cortex', LIMBIC),
  frontalpole: parcel('frontal pole', FRONTAL),
  fusiform: parcel('fusiform gyrus', TEMPORAL),
  inferiorparietal: parcel('inferior parietal cortex', PARIETAL),
  inferiortemporal: parcel('inferior temporal gyrus', TEMPORAL),
  insula: parcel('insula', INSULAR),
  isthmuscingulate: parcel('isthmus of the cingulate gyrus', CINGULATE),
  lateraloccipital: parcel('lateral occipital cortex', OCCIPITAL),
  lateralorbitofrontal: parcel('lateral orbitofrontal cortex', FRONTAL),
  lingual: parcel('lingual gyrus', OCCIPITAL),
  medialorbitofrontal: parcel('medial orbitofrontal cortex', FRONTAL),
  middletemporal: parcel('middle temporal gyrus', TEMPORAL),
  paracentral: parcel('paracentral lobule', CENTRAL),
  parahippocampal: parcel('parahippocampal gyrus', LIMBIC),
  parsopercularis: parcel('opercular part of the inferior frontal gyrus', FRONTAL, ['pars opercularis']),
  parsorbitalis: parcel('orbital part of the inferior frontal gyrus', FRONTAL, ['pars orbitalis']),
  parstriangularis: parcel('triangular part of the inferior frontal gyrus', FRONTAL, ['pars triangularis']),
  pericalcarine: parcel('pericalcarine cortex', OCCIPITAL),
  postcentral: parcel('postcentral gyrus', CENTRAL),
  posteriorcingulate: parcel('posterior cingulate cortex', CINGULATE),
  precentral: parcel('precentral gyrus', CENTRAL),
  precuneus: parcel('precuneus', PARIETAL),
  rostralanteriorcingulate: parcel('rostral anterior cingulate cortex', CINGULATE),
  rostralmiddlefrontal: parcel('rostral middle frontal gyrus', FRONTAL),
  superiorfrontal: parcel('superior frontal gyrus', FRONTAL),
  superiorparietal: parcel('superior parietal lobule', PARIETAL),
  superiortemporal: parcel('superior temporal gyrus', TEMPORAL),
  supramarginal: parcel('supramarginal gyrus', PARIETAL),
  temporalpole: parcel('temporal pole', TEMPORAL),
  transversetemporal: parcel('transverse temporal gyrus', TEMPORAL, ['Heschl']),
};
