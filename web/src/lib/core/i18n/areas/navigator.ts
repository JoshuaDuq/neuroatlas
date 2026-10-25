export const en = {
  title: 'Atlas explorer',
  findRegion: 'Find a region',
  clearSearch: 'Clear search',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  searchPlaceholder: 'Search regions',
  searchResults: 'Search results',
  browseAnatomy: 'Browse anatomy',
  cortex: 'Cortex',
  subcortical: 'Subcortical',
  cutOnly: 'Cut labels only',
  // Destrieux lobes, HCP-MMP networks and structure systems can share a name.
  groupIn: {
    lobe: (name: string) => `${name} lobe`,
    network: (name: string) => `${name} network`,
    system: (name: string) => `${name} system`,
  },
  scope: 'Browse',
  scopeWhole: 'Whole brain',
  scopeSystem: 'By system',
  system: 'System',
  allSystems: 'All internal structures',
  noMatch: (q: string) => `No match for “${q}”`,
  noMatchHint:
    'Try another spelling, an abbreviation or a synonym. Symptoms and syndromes are under Deficits.',
  showingCapped: (shown: number, total: string) =>
    `Showing ${shown} of ${total}. Refine the search to narrow it.`,
  matchesInOther: (countText: string, atlas: string) => `${countText} in ${atlas}. `,
  switchAtlas: 'Switch atlas',
  matchesInOtherCut: (countText: string, atlas: string) =>
    `${countText} in ${atlas}, which labels cuts only. `,
  switchCutAtlas: 'Switch cut labels',
  rowHiddenAria: (name: string, side: string, reason: string) =>
    `${name}, ${side}: ${reason}. Activate to reveal.`,
  rowUnavailableAria: (name: string, side: string, reason: string) =>
    `${name}, ${side}, not shown: ${reason}.`,
};

export const fr: typeof en = {
  title: 'Explorateur d’atlas',
  findRegion: 'Trouver une région',
  clearSearch: 'Effacer la recherche',
  expandAll: 'Tout déplier',
  collapseAll: 'Tout replier',
  searchPlaceholder: 'Rechercher des régions',
  searchResults: 'Résultats de recherche',
  browseAnatomy: 'Parcourir l’anatomie',
  cortex: 'Cortex',
  subcortical: 'Sous-cortical',
  cutOnly: 'Étiquettes de coupe seulement',
  groupIn: {
    lobe: (name: string) => `Lobe ${name.toLocaleLowerCase('fr')}`,
    network: (name: string) => `Réseau ${name.toLocaleLowerCase('fr')}`,
    system: (name: string) => `Système ${name.toLocaleLowerCase('fr')}`,
  },
  scope: 'Parcourir',
  scopeWhole: 'Cerveau entier',
  scopeSystem: 'Par système',
  system: 'Système',
  allSystems: 'Toutes les structures internes',
  noMatch: (q: string) => `Aucun résultat pour « ${q} »`,
  noMatchHint:
    'Essayez une autre orthographe, une abréviation ou un synonyme. Les symptômes et syndromes sont sous Déficits.',
  showingCapped: (shown: number, total: string) =>
    `Affichage de ${shown} sur ${total}. Affinez la recherche pour restreindre.`,
  matchesInOther: (countText: string, atlas: string) => `${countText} dans ${atlas}. `,
  switchAtlas: 'Changer d’atlas',
  matchesInOtherCut: (countText: string, atlas: string) =>
    `${countText} dans ${atlas}, qui n’étiquette que les coupes. `,
  switchCutAtlas: 'Changer les étiquettes de coupe',
  rowHiddenAria: (name: string, side: string, reason: string) =>
    `${name}, ${side} : ${reason}. Activer pour afficher.`,
  rowUnavailableAria: (name: string, side: string, reason: string) =>
    `${name}, ${side}, non affiché : ${reason}.`,
};
