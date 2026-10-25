export const en = {
  heading: 'Neuropsychological functions',
  // Numbers arrive formatted (format.js decimal).
  score: (term: string, z: string) => `“${term}” · z\u00a0${z}`,
  none: (threshold: string) => `No function reaches z\u00a0${threshold} here.`,
  noteStructure: (source: string) =>
    `Mean meta-analytic consistency over this whole structure on fsaverage’s segmentation for each term, from ${source}. Weaker evidence than a cortical area: the 6 mm kernel is large beside a nucleus, and studies report fewer coordinates here. Not what this brain does, and not what damage here would impair.`,
  note: (source: string) =>
    `Mean meta-analytic consistency over this whole HCP-MMP area for each term, from ${source}: where studies using the term reliably report activation, not what this brain does, and not what damage here would impair.`,
  keyTitle: 'Neuropsychological functions',
  // Numbers arrive formatted (format.js decimal); `to` is null for the open top band.
  band: (from: string, to: string | null) =>
    (to ? `z ${from} to ${to}` : `z ≥ ${from}`).replaceAll(' ', '\u00a0'),
  keyScale:
    'Mean consistency z per area; darker is more consistent. Tissue-coloured areas fall below 3.',
  keyScaleTerm:
    'Neurosynth term. Mean consistency z per area; darker is more consistent. Tissue-coloured areas fall below 3.',
  keyAll:
    'Each area shows its strongest function; tissue-coloured areas reach none. Choose one to see all its areas.',
  termOf: (name: string, term: string) => `${name}: “${term}”`,
  lesionCheck: (items: string[]) => `Lesion check: ${items.join('; ')}.`,
  lesionItem: (deficit: string, references: string, parcels: string) =>
    `${deficit} (${references}): ${parcels}`,
  parcelCoverage: (parcel: string, share: string) => `${parcel} ${share} coloured`,
  parcelOffSurface: (parcel: string) => `${parcel}, not measured`,
  noLesionCheck: 'No lesion study in Planum’s deficit evidence checks this domain.',
};

export const fr: typeof en = {
  heading: 'Fonctions neuropsychologiques',
  score: (term: string, z: string) => `« ${term} » · z\u00a0${z}`,
  none: (threshold: string) => `Aucune fonction n’atteint z\u00a0${threshold} ici.`,
  noteStructure: (source: string) =>
    `Constance méta-analytique moyenne sur toute la structure de la segmentation de fsaverage pour chaque terme, d’après ${source}. Données plus faibles que pour une aire corticale\u202f: le noyau de lissage de 6\u00a0mm est grand à côté d’un noyau, et les études y rapportent moins de coordonnées. Ni ce que fait ce cerveau, ni ce qu’une lésion ici altérerait.`,
  note: (source: string) =>
    `Constance méta-analytique moyenne sur l’aire HCP-MMP entière pour chaque terme, d’après ${source}\u202f: là où les études qui emploient le terme rapportent régulièrement une activation, et non ce que fait ce cerveau ni ce qu’une lésion ici altérerait.`,
  keyTitle: 'Fonctions neuropsychologiques',
  band: (from: string, to: string | null) =>
    (to ? `z ${from} à ${to}` : `z ≥ ${from}`).replaceAll(' ', '\u00a0'),
  keyScale:
    'Constance z moyenne par aire\u202f; plus foncé, plus constant. Les aires couleur tissu sont sous 3.',
  keyScaleTerm:
    'Terme Neurosynth. Constance z moyenne par aire\u202f; plus foncé, plus constant. Les aires couleur tissu sont sous 3.',
  keyAll:
    'Chaque aire montre sa fonction la plus forte\u202f; les aires couleur tissu n’en atteignent aucune. Choisissez-en une pour voir toutes ses aires.',
  termOf: (name: string, term: string) => `${name}\u202f: « ${term} »`,
  lesionCheck: (items: string[]) => `Vérification lésionnelle\u202f: ${items.join('\u202f; ')}.`,
  lesionItem: (deficit: string, references: string, parcels: string) =>
    `${deficit} (${references})\u202f: ${parcels}`,
  parcelCoverage: (parcel: string, share: string) => `${parcel} colorée à ${share}`,
  parcelOffSurface: (parcel: string) => `${parcel}, non mesurée`,
  noLesionCheck:
    'Aucune étude lésionnelle des données de déficits de Planum ne vérifie ce domaine.',
};
