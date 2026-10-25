export const en = {
  heading: (target: string) => `Overlap with ${target}`,
  denominator: 'Shares of this region’s full pial surface.',
  highlight: (name: string, area: string, share: string) =>
    `Highlight overlap with ${name}, ${area}, ${share} of this region`,
  more: (count: number) => `${count} more overlapping ${count === 1 ? 'region' : 'regions'}`,
  columns: ['Region', 'Area (mm²)', 'Share (%)'],
  unassigned: 'Unassigned',
  export: 'Download CSV',
  loading: 'Loading atlas comparison…',
  highlightLoading: 'Loading overlap outline…',
  retry: 'Retry comparison',
  viewNote:
    'Turn off sections to outline overlaps. Measurements use the full region, including hidden parts.',
  methodHeading: 'Method and sources',
  method:
    'Surface area on this subject’s original pial triangles, using the same midpoint/centroid boundaries as the viewer. Percentages include unassigned area and are not rescaled. Small overlaps remain in the table and export. Values shown are rounded; CSV retains full precision. HCP-MMP labels are projected from a group atlas through registered spheres, not measured boundaries in this individual. This is spatial correspondence, not functional equivalence.',
};

export const fr: typeof en = {
  heading: (target: string) => `Recouvrement avec ${target}`,
  denominator: 'Parts de toute la surface piale de cette région.',
  highlight: (name: string, area: string, share: string) =>
    `Tracer le recouvrement avec ${name}, ${area}, ${share} de cette région`,
  more: (count: number) =>
    count === 1 ? '1 autre région en recouvrement' : `${count} autres régions en recouvrement`,
  columns: ['Région', 'Surface (mm²)', 'Part (%)'],
  unassigned: 'Non assigné',
  export: 'Télécharger CSV',
  loading: 'Chargement de la comparaison des atlas…',
  highlightLoading: 'Chargement du contour de recouvrement…',
  retry: 'Réessayer la comparaison',
  viewNote:
    'Désactivez les coupes pour tracer les recouvrements. Les mesures portent sur toute la région, y compris les parties masquées.',
  methodHeading: 'Méthode et sources',
  method:
    'Surface des triangles piaux originaux de ce sujet, avec les mêmes limites par milieux et centroïdes que dans le modèle. Les pourcentages incluent la surface non assignée et ne sont pas renormalisés. Les petits recouvrements restent dans le tableau et l’export. Les valeurs affichées sont arrondies\u202f; le CSV conserve toute la précision. Les étiquettes HCP-MMP sont projetées depuis un atlas de groupe par les sphères recalées, sans mesure des limites chez cet individu. Il s’agit d’une correspondance spatiale, sans équivalence fonctionnelle.',
};
