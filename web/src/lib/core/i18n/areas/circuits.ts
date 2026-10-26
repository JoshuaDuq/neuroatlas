export const en = {
  heading: 'Guided learning',
  landmarks: 'Landmarks',
  landmark: 'Landmark',
  visited: 'seen',
  landmarkCount: (count: number) => `${count} ${count === 1 ? 'landmark' : 'landmarks'}`,
  coverage: (circuits: number, landmarks: number) =>
    `${circuits} guided ${circuits === 1 ? 'circuit' : 'circuits'} · ${landmarks} ${landmarks === 1 ? 'landmark' : 'landmarks'}`,
  schematic: 'Schematic relationships · not measured connectivity or tractography',
  connections: 'Connections and scope',
  previousLandmark: 'Previous landmark',
  nextLandmark: 'Next landmark',
  returnToLandmark: 'Return to landmark',
  otherSelection: 'You are exploring another region.',
  mapping: 'What this atlas shows',
  clinical: 'Clinical context',
  clinicalLink: 'Open deficit evidence',
  clinicalNote:
    'Reference anatomy; these associations do not predict an individual patient’s deficit.',
  evidence: 'Sources',
  revised: 'Content checked',
  loading: 'Opening landmark…',
  mriNote:
    'In the linked MRI, the crosshair marks the 3D landmark’s centroid, which may fall outside a curved structure. MRI labels can use a different atlas.',
  step: (index: number, total: number) => `Landmark ${index + 1} of ${total}`,
  stepShort: (index: number, total: number) => `${index + 1} of ${total}`,
  inCircuits: 'In guided circuits',
};

export const fr: typeof en = {
  heading: 'Apprentissage guidé',
  landmarks: 'Repères',
  landmark: 'Repère',
  visited: 'vu',
  landmarkCount: (count: number) => `${count} ${count > 1 ? 'repères' : 'repère'}`,
  coverage: (circuits: number, landmarks: number) =>
    `${circuits} ${circuits > 1 ? 'parcours guidés' : 'parcours guidé'} · ${landmarks} ${landmarks > 1 ? 'repères' : 'repère'}`,
  schematic: 'Relations schématiques · sans mesure de connectivité ni tractographie',
  connections: 'Connexions et portée',
  previousLandmark: 'Repère précédent',
  nextLandmark: 'Repère suivant',
  returnToLandmark: 'Revenir au repère',
  otherSelection: 'Vous explorez une autre région.',
  mapping: 'Ce que montre cet atlas',
  clinical: 'Contexte clinique',
  clinicalLink: 'Ouvrir les données sur le déficit',
  clinicalNote:
    'Anatomie de référence ; ces associations ne prédisent pas le déficit d’un patient individuel.',
  evidence: 'Sources',
  revised: 'Contenu vérifié',
  loading: 'Ouverture du repère…',
  mriNote:
    'Dans l’IRM liée, le réticule marque le centroïde du repère 3D, qui peut se situer hors d’une structure courbe. Les étiquettes IRM peuvent utiliser un autre atlas.',
  step: (index: number, total: number) => `Repère ${index + 1} sur ${total}`,
  stepShort: (index: number, total: number) => `${index + 1} sur ${total}`,
  inCircuits: 'Dans les parcours guidés',
};
