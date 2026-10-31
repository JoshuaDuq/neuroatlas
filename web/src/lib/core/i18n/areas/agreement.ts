export const en = {
  heading: 'Segmentation agreement',
  compared: (union: string) => `Compared as part of NextBrain’s ${union}.`,
  category: {
    both: 'Both segmentations',
    'aseg-only': 'aseg only',
    'nextbrain-only': 'NextBrain only',
  },
  dice: (value: string) => `Dice ${value}`,
  show: 'Show on linked MRI',
  hide: 'Hide agreement',
  legend: (structure: string) => `Agreement: ${structure}`,
  note: (union: string) =>
    `On aseg’s 1 mm grid, with NextBrain’s ${union} voxelised there: a voxel counts when over half of the 0.4 mm voxels that fall in it belong to it. How far two segmentations of one scan agree shows how much a boundary depends on the method; it is not accuracy, and neither is the reference. Validation scores the same structures on NextBrain’s 0.4 mm grid.`,
};

export const fr: typeof en = {
  heading: 'Accord des segmentations',
  compared: (union: string) => `Comparée au sein de l’ensemble « ${union} » de NextBrain.`,
  category: {
    both: 'Les deux segmentations',
    'aseg-only': 'aseg seule',
    'nextbrain-only': 'NextBrain seule',
  },
  dice: (value: string) => `Dice ${value}`,
  show: 'Afficher sur l’IRM liée',
  hide: 'Masquer l’accord',
  legend: (structure: string) => `Accord : ${structure}`,
  note: (union: string) =>
    `Sur la grille de 1 mm d’aseg, où l’ensemble « ${union} » de NextBrain est voxelisé : un voxel en fait partie quand plus de la moitié des voxels de 0,4 mm qui y tombent en font partie. L’accord entre deux segmentations d’un même examen montre à quel point une limite dépend de la méthode ; ce n’est pas une mesure d’exactitude, et aucune des deux n’est la référence. La validation évalue les mêmes structures sur la grille de 0,4 mm de NextBrain.`,
};
