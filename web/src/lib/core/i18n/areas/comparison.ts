export const en = {
  heading: (target: string) => `Overlap with ${target}`,
  partner: 'Compare with',
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
  // Spoken when the panel loads and after the CSV export (r2-status-live).
  ready: 'Atlas comparison loaded.',
  exported: 'Atlas comparison CSV downloaded.',
  viewNote:
    'Turn off sections to outline overlaps. Measurements use the full region, including hidden parts.',
  methodHeading: 'Method and sources',
  method:
    'Surface area on this subject’s original pial triangles, using the same midpoint/centroid boundaries as the viewer. Percentages include unassigned area and are not rescaled. Small overlaps remain in the table and export. Values shown are rounded; CSV retains full precision.',
  /** How each group atlas reaches this brain, said for the atlases a comparison pairs. */
  projected: {
    'hcp-mmp':
      'HCP-MMP labels are projected from a group atlas through registered spheres, not measured boundaries in this individual.',
    julich:
      'Julich-Brain areas are projected from a group maximum-probability map through registered spheres, not measured boundaries in this individual; its gap maps, cortex not yet mapped, count as unassigned. An overlap does not carry an area’s receptor measurements to another region.',
    schaefer:
      'Schaefer parcels are a group resting-state parcellation on fsaverage, projected through registered spheres, not measured boundaries in this individual; its medial wall counts as unassigned.',
  } as Record<string, string>,
  correspondence: 'This is spatial correspondence, not functional equivalence.',
};

export const fr: typeof en = {
  heading: (target: string) => `Recouvrement avec ${target}`,
  partner: 'Comparer avec',
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
  ready: 'Comparaison des atlas chargée.',
  exported: 'Fichier CSV de la comparaison des atlas téléchargé.',
  viewNote:
    'Désactivez les coupes pour tracer les recouvrements. Les mesures portent sur toute la région, y compris les parties masquées.',
  methodHeading: 'Méthode et sources',
  method:
    'Surface des triangles piaux originaux de ce sujet, avec les mêmes limites par milieux et centroïdes que dans le modèle. Les pourcentages incluent la surface non assignée et ne sont pas renormalisés. Les petits recouvrements restent dans le tableau et l’export. Les valeurs affichées sont arrondies\u202f; le CSV conserve toute la précision.',
  projected: {
    'hcp-mmp':
      'Les étiquettes HCP-MMP sont projetées depuis un atlas de groupe par les sphères recalées, sans mesure des limites chez cet individu.',
    julich:
      'Les aires de Julich-Brain sont projetées depuis une carte de probabilité maximale de groupe par les sphères recalées, sans mesure des limites chez cet individu\u202f; ses cartes lacunaires, cortex non encore cartographié, comptent comme non assignées. Un recouvrement ne transfère pas les mesures de récepteurs d’une aire à une autre région.',
    schaefer:
      'Les parcelles de Schaefer sont une parcellisation de groupe au repos sur fsaverage, projetée par les sphères recalées, sans mesure des limites chez cet individu\u202f; sa paroi médiane compte comme non assignée.',
  },
  correspondence: 'Il s’agit d’une correspondance spatiale, sans équivalence fonctionnelle.',
};
