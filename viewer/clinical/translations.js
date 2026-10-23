export const CLINICAL_TEXT = {
  en: {
    deficits: 'Deficits',
    search: 'Search deficits',
    searchLabel: 'Search deficits or cognitive functions',
    coverage: '{count} profiles · adult acquired deficits',
    noResults: 'Try another term or a cognitive function.',
    related: 'Neuropsychology', associations: 'Associations', findings: 'Evidence',
    studyFinding: 'Reported finding', limits: 'Interpretation',
    mapping: 'Approximate anatomical mapping', openRegion: 'Open region',
    // Outlined unless a cut is on, which turns the outlines off.
    regionsMarked: (shown, total, coloured) => {
      const count = shown === total ? `${total}` : `${shown} of ${total}`;
      return `${count} ${total === 1 ? 'region' : 'regions'} ${coloured ? 'coloured' : 'visible'}`;
    },
    // What revealing a deficit's regions changed in the reader's own settings, one clause each.
    changed: {
      cut: 'section closed', isolation: 'isolation cleared', hemisphere: 'both hemispheres shown',
      cortexHidden: 'cortex hidden', cortexShown: 'cortex shown',
      atlas: name => `atlas set to ${name}`, detail: name => `internal anatomy set to ${name}`,
      colour: name => `colour set to ${name}`, cutAtlas: name => `cut labels set to ${name}`,
    },
    restore: 'Restore previous view', restoring: 'Restoring the previous view…',
    stageRestored: 'Previous view restored.', restoreFailed: 'The previous view could not be fully restored.',
    evidence: 'Publications', supporting: 'Supporting study', qualifying: 'Contrasting evidence',
    population: 'Study population', abstract: 'Source inspected: abstract',
    correction: 'Correction published',
    'full-text': 'Source inspected: full text',
    sources: 'Selected literature · not a systematic review',
    revised: 'Content checked', referenceOnly: 'Reference anatomy; associations do not predict an individual patient’s deficit.',
    mappingEmpty: 'No atlas mapping available.', loading: 'Opening anatomy…',
    methods: { 'lesion-mapping': 'Lesion–symptom mapping', 'meta-analysis': 'Meta-analysis of lesion mapping',
      'case-report': 'Case report', 'case-series': 'Case series' },
    laterality: { left: 'Left hemisphere', right: 'Right hemisphere', bilateral: 'Bilateral landmarks' },
    lateralityShort: { left: 'Left', right: 'Right', bilateral: 'Bilateral' },
  },
  fr: {
    deficits: 'Déficits',
    search: 'Rechercher un déficit',
    searchLabel: 'Rechercher un déficit ou une fonction cognitive',
    coverage: '{count} profils · déficits acquis de l’adulte',
    noResults: 'Essayez un autre terme ou une fonction cognitive.',
    related: 'Neuropsychologie', associations: 'Associations', findings: 'Données probantes',
    studyFinding: 'Résultat rapporté', limits: 'Interprétation',
    mapping: 'Correspondance anatomique approximative', openRegion: 'Voir la région',
    // French agrees with the count shown: « 10 régions sur 11 », « 1 région sur 3 ».
    regionsMarked: (shown, total, coloured) => {
      const plural = shown > 1 ? 's' : '';
      const count = shown === total ? `${shown} région${plural}` : `${shown} région${plural} sur ${total}`;
      return `${count} ${coloured ? 'colorée' : 'visible'}${plural}`;
    },
    changed: {
      cut: 'coupe fermée', isolation: 'isolement retiré', hemisphere: 'deux hémisphères affichés',
      cortexHidden: 'cortex masqué', cortexShown: 'cortex affiché',
      atlas: name => `atlas réglé sur ${name}`, detail: name => `anatomie interne réglée sur ${name}`,
      colour: name => `coloration réglée sur ${name}`, cutAtlas: name => `étiquettes de coupe réglées sur ${name}`,
    },
    restore: 'Rétablir la vue précédente', restoring: 'Rétablissement de la vue précédente…',
    stageRestored: 'Vue précédente rétablie.', restoreFailed: 'La vue précédente n’a pas pu être entièrement rétablie.',
    evidence: 'Publications', supporting: 'Étude à l’appui', qualifying: 'Données contradictoires',
    population: 'Population étudiée', abstract: 'Source consultée : résumé',
    correction: 'Correction publiée',
    'full-text': 'Source consultée : texte intégral',
    sources: 'Sélection de publications · pas une revue systématique',
    revised: 'Contenu vérifié', referenceOnly: 'Anatomie de référence\u202f; les associations ne prédisent pas le déficit d’un patient individuel.',
    mappingEmpty: 'Aucune correspondance disponible dans l’atlas.', loading: 'Ouverture de l’anatomie…',
    methods: { 'lesion-mapping': 'Cartographie lésion–symptôme', 'meta-analysis': 'Méta-analyse de cartographie lésionnelle',
      'case-report': 'Étude de cas', 'case-series': 'Série de cas' },
    laterality: { left: 'Hémisphère gauche', right: 'Hémisphère droit', bilateral: 'Repères bilatéraux' },
    lateralityShort: { left: 'Gauche', right: 'Droite', bilateral: 'Bilatéral' },
  },
};
