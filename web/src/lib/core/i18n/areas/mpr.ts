export const en = {
  title: 'Linked MRI sections',
  subtitle: 'Click to position the shared crosshair. Arrows move one source millimetre.',
  close: 'Close',
  savePng: 'Save PNG',
  contrastWindow: 'Window',
  windowCenter: 'Level',
  segmentationOverlay: 'Segmentation overlay',
  labels: { sagittal: 'Sagittal', coronal: 'Coronal', axial: 'Axial' },
  planes: 'Section plane',
  positionLabel: (name: string) => `${name} position`,
  sliceAria: (name: string) => `${name} MRI. Click to place crosshair; arrow keys change slice.`,
  sliderAria: (name: string) => `${name} MRI position`,
  note: (anatomy: { individual: boolean }) =>
    `1 mm ${anatomy.individual ? 'single-subject' : 'averaged-template'} grid · surface RAS coordinates · L/R explicitly marked. MRI shows the full volume independently of surface visibility. Cortical atlas areas remain surface labels.`,
  readout: (ras: string, name: string, labelId: number) => `${ras} — ${name} (label ${labelId})`,
};

export const fr: typeof en = {
  title: 'Coupes IRM liées',
  subtitle:
    'Cliquez pour positionner le réticule partagé. Les flèches déplacent d’un millimètre source.',
  close: 'Fermer',
  savePng: 'Enregistrer PNG',
  contrastWindow: 'Fenêtre',
  windowCenter: 'Niveau',
  segmentationOverlay: 'Superposition de segmentation',
  labels: { sagittal: 'Sagittal', coronal: 'Coronal', axial: 'Axial' },
  planes: 'Plan de coupe',
  positionLabel: (name: string) => {
    const adj = { Sagittal: 'sagittale', Coronal: 'coronale', Axial: 'axiale' }[name] ?? name;
    return `Position ${adj}`;
  },
  sliceAria: (name: string) => {
    const adj = { Sagittal: 'sagittale', Coronal: 'coronale', Axial: 'axiale' }[name] ?? name;
    return `Coupe IRM ${adj}. Cliquez pour placer le réticule ; les touches fléchées changent de coupe.`;
  },
  sliderAria: (name: string) => {
    const adj = { Sagittal: 'sagittale', Coronal: 'coronale', Axial: 'axiale' }[name] ?? name;
    return `Position IRM ${adj}`;
  },
  note: (anatomy: { individual: boolean }) =>
    `Grille 1 mm ${anatomy.individual ? 'd’un sujet unique' : 'd’un gabarit moyenné'} · coordonnées RAS de surface · G/D explicitement marqués. L’IRM montre le volume complet indépendamment de la visibilité de surface. Les aires corticales de l’atlas restent des étiquettes de surface.`,
  readout: (ras: string, name: string, labelId: number) =>
    `${ras} — ${name} (étiquette ${labelId})`,
};
