import type { Language, Region, Rgb } from '../../types/index.ts';
import { CAB_NP_NAMES_FR, NETWORK_NAMES_FR } from './networks.fr.ts';

/** The published CAB-NP partition (`cab-np.json`). */
export interface CabNpPartition {
  id: string;
  atlas: string;
  networks: string[];
  colors: Record<string, Rgb>;
  regions: Record<string, string>;
}

/**
 * Yeo's seven networks: the names readers see, and what a region belongs to.
 *
 * The keys are the published abbreviations the manifest carries. Spelled out
 * here so a reader meets "Somatomotor" rather than "SomMot"; these are the
 * published names, not expansions invented for this viewer.
 */
const NETWORK_NAMES: Record<string, string> = {
  Vis: 'Visual',
  SomMot: 'Somatomotor',
  DorsAttn: 'Dorsal attention',
  SalVentAttn: 'Salience / ventral attention',
  Limbic: 'Limbic',
  Cont: 'Frontoparietal control',
  Default: 'Default mode',
};

/**
 * CAB-NP's twelve networks as Ji et al. (2019) name them. Keys are the
 * network names in its published label key, which the partition file carries.
 */
const CAB_NP_NAMES: Record<string, string> = {
  Visual1: 'Primary visual',
  Visual2: 'Secondary visual',
  Somatomotor: 'Somatomotor',
  'Cingulo-Opercular': 'Cingulo-opercular',
  'Dorsal-Attention': 'Dorsal attention',
  Language: 'Language',
  Frontoparietal: 'Frontoparietal',
  Auditory: 'Auditory',
  Default: 'Default mode',
  'Posterior-Multimodal': 'Posterior multimodal',
  'Ventral-Multimodal': 'Ventral multimodal',
  'Orbito-Affective': 'Orbito-affective',
};

/*
 * Hide small contributions to keep the chart readable. This display threshold
 * does not establish whether a contribution is registration error. Shares are
 * never renormalised, so the displayed contributions need not total 100%.
 */
export const MINIMUM_SHARE = 0.05;

export function networkName(key: string, lang: Language = 'en'): string {
  const table = lang === 'fr' ? NETWORK_NAMES_FR : NETWORK_NAMES;
  return table[key] ?? NETWORK_NAMES[key] ?? key;
}

export function cabNpName(key: string, lang: Language = 'en'): string {
  const name = (lang === 'fr' ? CAB_NP_NAMES_FR : CAB_NP_NAMES)[key];
  if (!name) throw new Error(`Unknown CAB-NP network: ${key}`);
  return name;
}

/** The published CAB-NP partition, checked against the regions it assigns. */
export function validateCabNp(
  partition: CabNpPartition,
  regions: ReadonlyMap<string, Region>,
): CabNpPartition {
  if (partition?.id !== 'cab-np' || !Array.isArray(partition.networks)) {
    throw new Error('Invalid CAB-NP partition.');
  }
  for (const network of partition.networks) {
    cabNpName(network);
    if (partition.colors?.[network]?.length !== 3)
      throw new Error(`CAB-NP network has no colour: ${network}`);
  }
  for (const [id, network] of Object.entries(partition.regions ?? {})) {
    if (regions.get(id)?.atlas !== partition.atlas || !partition.networks.includes(network)) {
      throw new Error(`Invalid CAB-NP assignment: ${id}`);
    }
  }
  return partition;
}

/** A region's networks, largest share first, below-threshold shares hidden. */
export function networksOf(
  region: Pick<Region, 'networks'> | null | undefined,
  minimum = MINIMUM_SHARE,
) {
  return (region?.networks ?? []).filter((share) => share.fraction >= minimum);
}

/** The samples counted by the build, excluding samples assigned to no network. */
export function networkBasis(region: {
  id?: string;
  atlas?: string;
  kind?: string;
}): 'vertices' | 'voxels' {
  if (['destrieux', 'hcp-mmp', 'julich', 'schaefer'].includes(region.atlas ?? ''))
    return 'vertices';
  if (region.atlas === 'nextbrain' && region.kind === 'tissue-region') return 'voxels';
  throw new Error(`Unknown network composition basis for ${region.id ?? region.atlas}.`);
}

/** The network a region mostly belongs to, or null if it belongs to none. */
export function dominantNetwork(region: Pick<Region, 'networks'>): string | null {
  return networksOf(region)[0]?.network ?? null;
}

/** The published colour as CSS. The manifest holds sRGB, which is what CSS wants. */
export const networkCss = (channels: Rgb) => `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
