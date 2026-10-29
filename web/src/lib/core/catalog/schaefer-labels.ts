import type { Language, Region } from '../../types/index.ts';
import type { RegionLabel } from './labels.ts';
import { networkName } from './networks.ts';

/**
 * Schaefer 2018 publishes each parcel under two names. The 7-network one, `7Networks_LH_Vis_1`,
 * is the atlas's colour and the Yeo network it groups under; the 17-network one of the same
 * parcel, `17Networks_LH_VisCent_ExStr_1`, also says where most parcels lie. Readers see the
 * second, spelled out with CBIG's own abbreviation table (Parcellations/README.md).
 */
const LOCATIONS: Record<string, string> = {
  AntTemp: 'anterior temporal',
  Aud: 'auditory',
  Cent: 'central',
  Cingm: 'mid-cingulate',
  Cingp: 'cingulate posterior',
  ExStr: 'extrastriate cortex',
  ExStrInf: 'extra-striate inferior',
  ExStrSup: 'extra-striate superior',
  FEF: 'frontal eye fields',
  FrMed: 'frontal medial',
  FrOper: 'frontal operculum',
  IPL: 'inferior parietal lobule',
  IPS: 'intraparietal sulcus',
  Ins: 'insula',
  OFC: 'orbital frontal cortex',
  PFCd: 'dorsal prefrontal cortex',
  PFCl: 'lateral prefrontal cortex',
  PFCld: 'lateral dorsal prefrontal cortex',
  PFClv: 'lateral ventral prefrontal cortex',
  PFCm: 'medial prefrontal cortex',
  PFCmp: 'medial posterior prefrontal cortex',
  PFCv: 'ventral prefrontal cortex',
  PHC: 'parahippocampal cortex',
  ParMed: 'parietal medial',
  ParOcc: 'parietal occipital',
  ParOper: 'parietal operculum',
  pCun: 'precuneus',
  pCunPCC: 'precuneus posterior cingulate cortex',
  PostC: 'post central',
  PrC: 'precentral',
  PrCv: 'precentral ventral',
  Rsp: 'retrosplenial',
  S2: 'S2',
  SPL: 'superior parietal lobule',
  StriCal: 'striate calcarine',
  Striate: 'striate cortex',
  Temp: 'temporal',
  TempOcc: 'temporal occipital',
  TempPole: 'temporal pole',
};

const LOCATIONS_FR: typeof LOCATIONS = {
  AntTemp: 'temporal antérieur',
  Aud: 'auditif',
  Cent: 'central',
  Cingm: 'cingulaire moyen',
  Cingp: 'cingulaire postérieur',
  ExStr: 'cortex extrastrié',
  ExStrInf: 'extrastrié inférieur',
  ExStrSup: 'extrastrié supérieur',
  FEF: 'champs oculomoteurs frontaux',
  FrMed: 'frontal médial',
  FrOper: 'opercule frontal',
  IPL: 'lobule pariétal inférieur',
  IPS: 'sillon intrapariétal',
  Ins: 'insula',
  OFC: 'cortex orbitofrontal',
  PFCd: 'cortex préfrontal dorsal',
  PFCl: 'cortex préfrontal latéral',
  PFCld: 'cortex préfrontal latéral dorsal',
  PFClv: 'cortex préfrontal latéral ventral',
  PFCm: 'cortex préfrontal médial',
  PFCmp: 'cortex préfrontal médial postérieur',
  PFCv: 'cortex préfrontal ventral',
  PHC: 'cortex parahippocampique',
  ParMed: 'pariétal médial',
  ParOcc: 'pariéto-occipital',
  ParOper: 'opercule pariétal',
  pCun: 'précunéus',
  pCunPCC: 'précunéus et cortex cingulaire postérieur',
  PostC: 'postcentral',
  PrC: 'précentral',
  PrCv: 'précentral ventral',
  Rsp: 'rétrosplénial',
  S2: 'S2',
  SPL: 'lobule pariétal supérieur',
  StriCal: 'strié calcarin',
  Striate: 'cortex strié',
  Temp: 'temporal',
  TempOcc: 'temporo-occipital',
  TempPole: 'pôle temporal',
};

/** 17-network names that are not a Yeo network plus a letter. */
const SUBNETWORKS: Record<string, Record<Language, string>> = {
  VisCent: { en: 'Visual central', fr: 'Visuel central' },
  VisPeri: { en: 'Visual peripheral', fr: 'Visuel périphérique' },
  TempPar: { en: 'Temporal parietal', fr: 'Temporo-pariétal' },
};

function subnetworkName(key: string, lang: Language): string | null {
  if (SUBNETWORKS[key]) return SUBNETWORKS[key][lang];
  const lettered = /^(SomMot|DorsAttn|SalVentAttn|Limbic|Cont|Default)([ABC])$/.exec(key);
  return lettered ? `${networkName(lettered[1], lang)} ${lettered[2]}` : null;
}

/** A Schaefer parcel's label, or null for a name outside the published tables. */
export function schaeferLabel(
  region: Pick<Region, 'source_name' | 'source_17_network_name'>,
  lang: Language,
): RegionLabel | null {
  const network = /^7Networks_[LR]H_([A-Za-z]+)_/.exec(region.source_name ?? '')?.[1];
  const parcel = /^17Networks_[LR]H_([A-Za-z]+)_(?:([A-Za-z0-9]+)_)?(\d+)$/.exec(
    region.source_17_network_name ?? '',
  );
  if (!network || !parcel) return null;
  const [, key, location, index] = parcel;
  const subnetwork = subnetworkName(key, lang);
  const place = location === undefined ? '' : (lang === 'fr' ? LOCATIONS_FR : LOCATIONS)[location];
  if (!subnetwork || place === undefined) return null;
  return {
    name: place ? `${subnetwork}, ${place} ${index}` : `${subnetwork} ${index}`,
    code: null,
    group: networkName(network, lang),
    aliases: [region.source_name!, region.source_17_network_name!],
  };
}
