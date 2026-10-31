export const en = {
  field: 'MNI coordinate, mm',
  example: '−42, 22, 6',
  space: 'Template',
  unstated: 'MNI, template not stated',
  place: 'Place',
  placing: 'Placing…',
  note: 'MNI152 coordinates only; Talairach and other spaces are not accepted.',
  unreadable: 'Enter three numbers, x, y, z, in millimetres.',
  outside: 'This coordinate lies beyond the template’s brain, so it is not placed.',
  failed: 'The coordinate could not be placed.',
  reportTitle: 'Published coordinate',
  entered: (point: string, space: string) => `${point} in ${space}`,
  landed: (point: string) => `Lands at ${point} on this brain (surface RAS)`,
  at: 'At that point',
  readsAs: (space: string) => `Template not stated: read as ${space}.`,
  alternativesNote:
    'Read in another template, the same numbers land elsewhere (offsets measured over template cortex):',
  alternative: (space: string, median: string, p95: string) =>
    `${space} lands a median ${median} (95%: ${p95}) away on this brain`,
  caveat:
    'A template location carried onto this one brain by registration. It is not where this person’s own peak would be, and not what this brain does here.',
  failedMeasure: 'What lies near the coordinate could not be measured.',
  within: (radius: string) => `Within ${radius}`,
  shareNote: 'Share of the sphere in each region; no one region is the coordinate’s label',
  rest: 'In none of these regions',
  networks: 'Yeo 7 networks, from Schaefer’s parcels',
  deep: 'Deep grey (aseg)',
  territoryNote:
    'Typical territories (Liu et al. 2023, registered onto this brain); not this brain’s own vessels',
  download: 'Download CSV',
  restCsv: '(in none of these regions)',
  tracts: {
    tracts: (radius: string) => `Tracts passing within ${radius}`,
    tractsNote: (radius: string) => `Streamlines with a point within ${radius}`,
    tractsChoose: 'Choose a bundle to draw only its streamlines passing near.',
    showTract: (bundle: string, crossing: string) =>
      `Draw the ${crossing} streamlines of ${bundle} that pass near`,
    tractShown: (bundle: string) => `Drawing ${bundle} where it passes near.`,
    tractsCaveat:
      'Reconstructed streamlines from this brain’s diffusion scan, not axons; passing near is not a connection to the coordinate.',
  },
};

export const fr: typeof en = {
  field: 'Coordonnée MNI, mm',
  example: '−42, 22, 6',
  space: 'Gabarit',
  unstated: 'MNI, gabarit non précisé',
  place: 'Placer',
  placing: 'Placement…',
  note: 'Coordonnées MNI152 seulement ; Talairach et les autres espaces ne sont pas acceptés.',
  unreadable: 'Entrez trois nombres, x, y, z, en millimètres.',
  outside: 'Cette coordonnée se trouve hors du cerveau du gabarit ; elle n’est pas placée.',
  failed: 'La coordonnée n’a pas pu être placée.',
  reportTitle: 'Coordonnée publiée',
  entered: (point: string, space: string) => `${point} dans ${space}`,
  landed: (point: string) => `Placée en ${point} sur ce cerveau (RAS de surface)`,
  at: 'À ce point',
  readsAs: (space: string) => `Gabarit non précisé : lue dans ${space}.`,
  alternativesNote:
    'Lus dans un autre gabarit, les mêmes nombres se placent ailleurs (écarts mesurés sur le cortex du gabarit)\u202f:',
  alternative: (space: string, median: string, p95: string) =>
    `${space} se place à une médiane de ${median} (95 % : ${p95}) sur ce cerveau`,
  caveat:
    'Une position du gabarit reportée sur ce seul cerveau par recalage. Ce n’est pas l’endroit où serait le pic propre à cette personne, ni ce que fait ce cerveau à cet endroit.',
  failedMeasure: 'Ce qui se trouve près de la coordonnée n’a pas pu être mesuré.',
  within: (radius: string) => `À moins de ${radius}`,
  shareNote:
    'Part de la sphère dans chaque région ; aucune région n’est à elle seule l’étiquette de la coordonnée',
  rest: 'Dans aucune de ces régions',
  networks: 'Réseaux de Yeo (7), d’après les parcelles de Schaefer',
  deep: 'Gris profond (aseg)',
  territoryNote:
    'Territoires typiques (Liu et al. 2023, recalés sur ce cerveau) ; pas les propres vaisseaux de ce cerveau',
  download: 'Télécharger CSV',
  restCsv: '(dans aucune de ces régions)',
  tracts: {
    tracts: (radius: string) => `Faisceaux passant à moins de ${radius}`,
    tractsNote: (radius: string) => `Trajectoires ayant un point à moins de ${radius}`,
    tractsChoose:
      'Choisissez un faisceau pour n’afficher que ses trajectoires passant à proximité.',
    showTract: (bundle: string, crossing: string) =>
      `Afficher les ${crossing} trajectoires de ${bundle} passant à proximité`,
    tractShown: (bundle: string) => `${bundle} : trajectoires passant à proximité affichées.`,
    tractsCaveat:
      'Trajectoires reconstruites à partir de l’IRM de diffusion de ce cerveau, pas des axones ; passer à proximité n’est pas une connexion à la coordonnée.',
  },
};
