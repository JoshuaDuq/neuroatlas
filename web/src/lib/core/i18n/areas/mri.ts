/**
 * The diffusion MRI dialog (diffusion/navigation-ui.js:8-29) and the names the linked MRI
 * gives its tissue labels (ui/chrome/sections.js:22-52). The orientation letters it draws
 * are the `orientation` area (sections.js:20 repeated it).
 */
export const en = {
  dialog: {
    close: 'Close',
    hint: 'Click a slice to position the crosshair. Scroll through slices; arrow keys move one voxel.',
    plane: 'View',
    all: 'Linked slices + 3D',
    axial: 'Axial',
    coronal: 'Coronal',
    sagittal: 'Sagittal',
    voxel: 'Source voxel (0-based)',
    go: 'Go to voxel',
    window: 'Window',
    center: 'Level',
    faOpacity: 'FA opacity',
    loading: 'Loading the reference MRI and selected tracts…',
    retry: 'Reload MRI',
    outside:
      'The atlas crosshair lies outside this scan’s field of view; the MRI keeps its position.',
    grid: (dims: readonly number[], spacing: string) =>
      `${dims.join(' × ')} source voxels · ${spacing} spacing`,
    // T2's additions (decision 41 on #4, deviations t2-*).
    ready: 'Reference MRI ready.',
    viewer: 'MRI viewer',
    voxelName: (axis: string) => `Voxel ${axis}`,
    range: (max: number) => `0 to ${max}`,
    moved: (voxel: readonly number[]) => `Crosshair moved to voxel ${voxel.join(', ')}.`,
    hintKeys: 'Page Up and Page Down step through slices.',
    hintClose: 'M closes this view.',
    hintTouch: 'Tap a slice to position the crosshair, or enter a voxel below.',
  },
  tissueNames: {
    Unknown: 'Unlabelled',
    '???': 'Unlabelled',
    'Left-Cerebral-White-Matter': 'Cerebral white matter',
    'Right-Cerebral-White-Matter': 'Cerebral white matter',
    'Left-Cerebral-Cortex': 'Left cerebral cortex',
    'Right-Cerebral-Cortex': 'Right cerebral cortex',
    CSF: 'Cerebrospinal fluid (CSF)',
    'Left-vessel': 'Cerebral vessel',
    'Right-vessel': 'Cerebral vessel',
    'WM-hypointensities': 'White matter hypointensities',
    ctx_lh_Medial_wall: 'Medial wall',
    ctx_rh_Medial_wall: 'Medial wall',
  },
};

export const fr: typeof en = {
  dialog: {
    close: 'Fermer',
    hint: 'Cliquer sur une coupe pour placer le réticule. Faire défiler pour parcourir les coupes ; les touches fléchées déplacent le réticule d’un voxel.',
    plane: 'Vue',
    all: 'Coupes liées + 3D',
    axial: 'Axiale',
    coronal: 'Coronale',
    sagittal: 'Sagittale',
    voxel: 'Voxel source (indices à partir de 0)',
    go: 'Aller au voxel',
    window: 'Fenêtre',
    center: 'Niveau',
    faOpacity: 'Opacité FA',
    loading: 'Chargement de l’IRM de référence et des faisceaux sélectionnés…',
    retry: 'Recharger l’IRM',
    outside: 'Le réticule de l’atlas est hors du champ de cette image ; l’IRM garde sa position.',
    grid: (dims: readonly number[], spacing: string) =>
      `${dims.join(' × ')} voxels source · espacement de ${spacing}`,
    ready: 'IRM de référence prête.',
    viewer: 'Visionneuse IRM',
    voxelName: (axis: string) => `Voxel ${axis}`,
    range: (max: number) => `de 0 à ${max}`,
    moved: (voxel: readonly number[]) => `Réticule déplacé au voxel ${voxel.join(', ')}.`,
    hintKeys: 'Page précédente et Page suivante changent de coupe.',
    hintClose: 'M ferme cette vue.',
    hintTouch: 'Toucher une coupe pour placer le réticule, ou saisir un voxel ci-dessous.',
  },
  tissueNames: {
    Unknown: 'Non étiqueté',
    '???': 'Non étiqueté',
    'Left-Cerebral-White-Matter': 'Substance blanche cérébrale',
    'Right-Cerebral-White-Matter': 'Substance blanche cérébrale',
    'Left-Cerebral-Cortex': 'Cortex cérébral gauche',
    'Right-Cerebral-Cortex': 'Cortex cérébral droit',
    CSF: 'Liquide cérébro-spinal (LCS)',
    'Left-vessel': 'Vaisseau cérébral',
    'Right-vessel': 'Vaisseau cérébral',
    'WM-hypointensities': 'Hypointensités de la substance blanche',
    ctx_lh_Medial_wall: 'Paroi médiale',
    ctx_rh_Medial_wall: 'Paroi médiale',
  },
};
