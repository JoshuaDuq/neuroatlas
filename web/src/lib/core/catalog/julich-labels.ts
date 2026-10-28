import type { Language } from '../../types/index.ts';
import type { RegionLabel } from './labels.ts';

/**
 * Julich-Brain names each area with where it lies, as in "Area 3b (PostCG)". The first
 * location tag places the area in the lobe Destrieux groups the same cortex under, so the
 * two atlases share their groups.
 */
const LOBE_OF_TAG: Record<string, string> = {
  FPole: 'Frontal',
  'Frontal Operculum': 'Frontal',
  IFG: 'Frontal',
  IFS: 'Frontal',
  MFG: 'Frontal',
  OFC: 'Frontal',
  SFG: 'Frontal',
  SFS: 'Frontal',
  SMA: 'Frontal',
  preSMA: 'Frontal',
  PreCG: 'Central',
  PostCG: 'Central',
  PostCS: 'Parietal',
  IPL: 'Parietal',
  IPS: 'Parietal',
  SPL: 'Parietal',
  POperc: 'Parietal',
  HESCHL: 'Temporal',
  STG: 'Temporal',
  STS: 'Temporal',
  FusG: 'Temporal',
  OTS: 'Temporal',
  CoS: 'Temporal',
  V1: 'Occipital',
  V2: 'Occipital',
  Cuneus: 'Occipital',
  LingG: 'Occipital',
  LOC: 'Occipital',
  POS: 'Occipital',
  Insula: 'Insula',
  ACC: 'Cingulate',
  pACC: 'Cingulate',
  sACC: 'Cingulate',
  Hippocampus: 'Limbic',
  'Hippocampal Region': 'Limbic',
  PhG: 'Limbic',
};

/** The French lobe names Destrieux's French table uses. */
const LOBE_FR: Record<string, string> = {
  Frontal: 'Frontal',
  Central: 'Central',
  Parietal: 'Pariétal',
  Temporal: 'Temporal',
  Occipital: 'Occipital',
  Insula: 'Insula',
  Cingulate: 'Cingulaire',
  Limbic: 'Limbique',
};

/** A Julich-Brain area's label, or null for a name without a known location tag. */
export function julichLabel(sourceName: string, lang: Language): RegionLabel | null {
  const tag = /\(([^,)]+)[^)]*\)$/.exec(sourceName)?.[1]?.trim();
  const lobe = tag === undefined ? undefined : LOBE_OF_TAG[tag];
  if (!lobe) return null;
  const isFr = lang === 'fr';
  return {
    name: isFr ? sourceName.replace(/^Area /, 'Aire ') : sourceName,
    code: null,
    group: isFr ? LOBE_FR[lobe]! : lobe,
    aliases: [],
  };
}
