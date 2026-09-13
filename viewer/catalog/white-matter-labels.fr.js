/** FreeSurfer wmparc parcels in French anatomical nomenclature, with French lobe groups. */
const FRONTALE = 'Substance blanche frontale';
const CENTRALE = 'Substance blanche centrale';
const PARIETALE = 'Substance blanche pariétale';
const TEMPORALE = 'Substance blanche temporale';
const OCCIPITALE = 'Substance blanche occipitale';
const CINGULAIRE = 'Substance blanche cingulaire';
const LIMBIQUE = 'Substance blanche limbique';
const INSULAIRE = 'Substance blanche insulaire';

const parcel = (structure, group, aliases = []) =>
  ({ name: `Substance blanche ${structure}`, group, aliases });

export const WHITE_MATTER_LABELS_FR = {
  bankssts: parcel('des berges du sillon temporal supérieur', TEMPORALE),
  caudalanteriorcingulate: parcel('du cortex cingulaire antérieur caudal', CINGULAIRE),
  caudalmiddlefrontal: parcel('de la partie caudale du gyrus frontal moyen', FRONTALE),
  cuneus: parcel('du cunéus', OCCIPITALE),
  entorhinal: parcel('du cortex entorhinal', LIMBIQUE),
  frontalpole: parcel('du pôle frontal', FRONTALE),
  fusiform: parcel('du gyrus fusiforme', TEMPORALE),
  inferiorparietal: parcel('du cortex pariétal inférieur', PARIETALE),
  inferiortemporal: parcel('du gyrus temporal inférieur', TEMPORALE),
  insula: parcel('de l’insula', INSULAIRE),
  isthmuscingulate: parcel('de l’isthme du gyrus cingulaire', CINGULAIRE),
  lateraloccipital: parcel('du cortex occipital latéral', OCCIPITALE),
  lateralorbitofrontal: parcel('du cortex orbitofrontal latéral', FRONTALE),
  lingual: parcel('du gyrus lingual', OCCIPITALE),
  medialorbitofrontal: parcel('du cortex orbitofrontal médial', FRONTALE),
  middletemporal: parcel('du gyrus temporal moyen', TEMPORALE),
  paracentral: parcel('du lobule paracentral', CENTRALE),
  parahippocampal: parcel('du gyrus parahippocampique', LIMBIQUE),
  parsopercularis: parcel('de la partie operculaire du gyrus frontal inférieur', FRONTALE, ['pars opercularis']),
  parsorbitalis: parcel('de la partie orbitaire du gyrus frontal inférieur', FRONTALE, ['pars orbitalis']),
  parstriangularis: parcel('de la partie triangulaire du gyrus frontal inférieur', FRONTALE, ['pars triangularis']),
  pericalcarine: parcel('du cortex péricalcarin', OCCIPITALE),
  postcentral: parcel('du gyrus postcentral', CENTRALE),
  posteriorcingulate: parcel('du cortex cingulaire postérieur', CINGULAIRE),
  precentral: parcel('du gyrus précentral', CENTRALE),
  precuneus: parcel('du précunéus', PARIETALE),
  rostralanteriorcingulate: parcel('du cortex cingulaire antérieur rostral', CINGULAIRE),
  rostralmiddlefrontal: parcel('de la partie rostrale du gyrus frontal moyen', FRONTALE),
  superiorfrontal: parcel('du gyrus frontal supérieur', FRONTALE),
  superiorparietal: parcel('du lobule pariétal supérieur', PARIETALE),
  superiortemporal: parcel('du gyrus temporal supérieur', TEMPORALE),
  supramarginal: parcel('du gyrus supramarginal', PARIETALE),
  temporalpole: parcel('du pôle temporal', TEMPORALE),
  transversetemporal: parcel('du gyrus temporal transverse', TEMPORALE, ['Heschl']),
};
