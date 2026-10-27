export const en = {
  hemisphere: 'Hemisphere',
  seeThrough: 'See through the cortex',
  seenThrough: 'Cortex made see-through; its painted areas stay opaque. Display sets the opacity.',
  opaqueAgain: 'Cortex made opaque again.',
  both: 'Both',
  left: 'Left',
  right: 'Right',
  internalAnatomy: 'Internal anatomy',
  showCortex: 'Show cortex',
  cortexOpacity: 'Cortex opacity',
  showInternal: 'Show internal anatomy',
  showSpinalCord: 'Show spinal cord',
  spinalCordUnavailable: 'No spinal cord is published for this subject.',
  // The masthead's Colour options; the field's note gives the full sense.
  surfaceColors: {
    tissue: 'Tissue',
    mri: 'T1 MRI',
    atlas: 'Regions',
    network: 'Yeo 7 networks',
    'cab-np': 'CAB-NP networks',
    functional: 'Functional divisions',
  },
  // The Colour field's value while a tab paints the brain; it is never offered as a choice.
  paints: { function: 'Functions', deficit: 'Deficit', lesion: 'Lesion findings' },
  paintTitles: {
    function:
      'Set by the Functions tab: neuropsychological functions on HCP-MMP areas, where studies consistently report activation (Neurosynth). Choose a colour here to show it instead.',
    deficit:
      'Set by the Deficits tab: the regions the open deficit’s findings cite, one colour per finding. Choose a colour here to show it instead.',
    lesion:
      'Set by the lesion’s report: the regions cited by the findings near the lesion, one colour per finding. Choose a colour here to show it instead.',
  },
  surfaceColorTitles: {
    tissue: 'Tissue colours, shaded by T1 brightness',
    mri: 'Registered T1 MRI intensity in greyscale · selected region tinted',
    atlas: 'Atlas region colours',
    network: 'Functional networks (Yeo 7)',
    'cab-np': 'Functional networks (CAB-NP, 12) on HCP-MMP areas',
    functional:
      'Functional divisions on HCP-MMP areas: Glasser 2016 sections and named regions from Glasser 2016 and Rolls 2022, 2023',
  },
  resetView: 'Reset view',
};

export const fr: typeof en = {
  hemisphere: 'Hémisphère',
  seeThrough: 'Voir à travers le cortex',
  seenThrough:
    'Cortex rendu transparent\u202f; ses aires colorées restent opaques. Affichage règle l’opacité.',
  opaqueAgain: 'Cortex rendu de nouveau opaque.',
  both: 'Les deux',
  left: 'Gauche',
  right: 'Droite',
  internalAnatomy: 'Anatomie interne',
  showCortex: 'Afficher le cortex',
  cortexOpacity: 'Opacité du cortex',
  showInternal: 'Afficher l’anatomie interne',
  showSpinalCord: 'Afficher la moelle épinière',
  spinalCordUnavailable: 'Aucune moelle épinière n’est publiée pour ce sujet.',
  surfaceColors: {
    tissue: 'Tissu',
    mri: 'IRM T1',
    atlas: 'Régions',
    network: 'Réseaux Yeo 7',
    'cab-np': 'Réseaux CAB-NP',
    functional: 'Divisions fonctionnelles',
  },
  paints: { function: 'Fonctions', deficit: 'Déficit', lesion: 'Constats de la lésion' },
  paintTitles: {
    function:
      'Choisi dans l’onglet Fonctions\u202f: fonctions neuropsychologiques sur les aires HCP-MMP, là où les études rapportent régulièrement une activation (Neurosynth). Choisissez une couleur ici pour l’afficher à la place.',
    deficit:
      'Choisi dans l’onglet Déficits\u202f: les régions citées par les constats du déficit ouvert, une couleur par constat. Choisissez une couleur ici pour l’afficher à la place.',
    lesion:
      'Choisi dans le rapport de la lésion\u202f: les régions citées par les constats proches de la lésion, une couleur par constat. Choisissez une couleur ici pour l’afficher à la place.',
  },
  surfaceColorTitles: {
    tissue: 'Couleurs des tissus, nuancées par la luminosité T1',
    mri: 'Intensité IRM T1 recalée en niveaux de gris · région sélectionnée teintée',
    atlas: 'Couleurs des régions de l’atlas',
    network: 'Réseaux fonctionnels (Yeo 7)',
    'cab-np': 'Réseaux fonctionnels (CAB-NP, 12) sur les aires HCP-MMP',
    functional:
      'Divisions fonctionnelles sur les aires HCP-MMP : sections de Glasser 2016 et régions nommées de Glasser 2016 et Rolls 2022, 2023',
  },
  resetView: 'Réinitialiser la vue',
};
