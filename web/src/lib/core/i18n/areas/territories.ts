export const en = {
  heading: 'Typical arterial supply',
  basis: {
    vertices: 'Share of this region’s pial vertices in each territory.',
    voxels: 'Share of this region’s voxels in each territory.',
  },
  unassigned: (share: string) => `${share} lies in no territory the atlas draws.`,
  caveat:
    'Typical territories from where infarcts fell in 1,298 stroke patients (Liu et al. 2023), registered onto this brain: not this brain’s own vessels. Collateral flow and variant anatomy move real territories by centimetres.',
};

export const fr: typeof en = {
  heading: 'Vascularisation artérielle typique',
  basis: {
    vertices: 'Part des sommets piaux de cette région dans chaque territoire.',
    voxels: 'Part des voxels de cette région dans chaque territoire.',
  },
  unassigned: (share: string) => `${share} ne se trouve dans aucun territoire de l’atlas.`,
  caveat:
    'Territoires typiques, d’après la localisation des infarctus de 1\u202f298 patients victimes d’AVC (Liu et al. 2023), recalés sur ce cerveau\u202f: pas ses propres vaisseaux. La circulation collatérale et les variantes anatomiques déplacent les territoires réels de plusieurs centimètres.',
};
