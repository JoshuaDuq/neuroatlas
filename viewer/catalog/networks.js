import { NETWORK_NAMES_FR } from './networks.fr.js';

/**
 * Yeo's seven networks: the names readers see, and what a region belongs to.
 *
 * The keys are the published abbreviations the manifest carries. Spelled out
 * here so a reader meets "Somatomotor" rather than "SomMot"; these are the
 * published names, not expansions invented for this viewer.
 */
export const NETWORK_NAMES = {
  Vis: 'Visual',
  SomMot: 'Somatomotor',
  DorsAttn: 'Dorsal attention',
  SalVentAttn: 'Salience / ventral attention',
  Limbic: 'Limbic',
  Cont: 'Frontoparietal control',
  Default: 'Default mode',
};

/*
 * Under this a share is registration spill across a boundary rather than
 * membership: the networks are a group average projected through two
 * registrations, and a percent or two of a parcel means nothing at that
 * resolution. Dropped, never renormalised — the remaining shares still say
 * what fraction of the region they are, so they need not total 100%.
 */
export const MINIMUM_SHARE = 0.05;

export function networkName(key, lang = 'en') {
  const table = lang === 'fr' ? NETWORK_NAMES_FR : NETWORK_NAMES;
  return table[key] ?? NETWORK_NAMES[key] ?? key;
}

/** A region's networks, largest share first, spill removed. */
export function networksOf(region, minimum = MINIMUM_SHARE) {
  return (region?.networks ?? []).filter(share => share.fraction >= minimum);
}

/** The network a region mostly belongs to, or null if it belongs to none. */
export function dominantNetwork(region) {
  return networksOf(region)[0]?.network ?? null;
}

/** The published colour as CSS. The manifest holds sRGB, which is what CSS wants. */
export const networkCss = channels => `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
