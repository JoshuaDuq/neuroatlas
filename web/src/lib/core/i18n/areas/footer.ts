export const en = {
  referenceColophon: (name: string) => `${name} · reference data`,
  colophon: (name: string, individual: boolean) =>
    `${name} · ${individual ? 'one individual’s MRI reconstruction' : 'averaged reference template'}`,
  statementAlone: 'Not clinical anatomy',
  visibleRegions: (n: number) => `${n} visible ${n === 1 ? 'region' : 'regions'}`,
  provenance: 'Provenance',
  close: 'Close',
  subject: 'Subject',
  kind: (individual: boolean): string =>
    individual ? 'One individual’s MRI reconstruction' : 'Averaged reference template',
  sourceData: 'Source data',
  reconstruction: 'Reconstruction',
  atlases: 'Cortical atlases',
  projectedFrom: (template: string) => `Projected from ${template}`,
  networks: 'Functional networks',
  functional: 'Functional divisions',
  receptors: 'Receptor fingerprints',
  domains: 'Neuropsychological domains',
  supplemental: 'Supplemental layers',
  files: 'Published files',
  sourceFiles: (n: number, checksummed: boolean) =>
    `${n} source ${n === 1 ? 'file' : 'files'}${checksummed ? `, ${n === 1 ? 'with a' : 'each with a'} SHA-256 checksum` : ''}`,
  index: 'Index of the published anatomies',
  tractReference: 'Tract reference',
  sources: 'Sources',
  intendedUse:
    'For research and education. Planum is not a medical device and must not be used for diagnosis, treatment or any other clinical decision.',
};

export const fr: typeof en = {
  referenceColophon: (name: string) => `${name} · données de référence`,
  colophon: (name: string, individual: boolean) =>
    `${name} · ${individual ? 'reconstruction IRM d’un individu' : 'gabarit de référence moyenné'}`,
  statementAlone: 'Pas une anatomie clinique',
  visibleRegions: (n: number) => `${n} ${n === 1 ? 'région visible' : 'régions visibles'}`,
  provenance: 'Provenance',
  close: 'Fermer',
  subject: 'Sujet',
  kind: (individual: boolean): string =>
    individual ? 'Reconstruction IRM d’un individu' : 'Gabarit de référence moyenné',
  sourceData: 'Données sources',
  reconstruction: 'Reconstruction',
  atlases: 'Atlas corticaux',
  projectedFrom: (template: string) => `Projeté depuis ${template}`,
  networks: 'Réseaux fonctionnels',
  functional: 'Divisions fonctionnelles',
  receptors: 'Empreintes de récepteurs',
  domains: 'Domaines neuropsychologiques',
  supplemental: 'Couches complémentaires',
  files: 'Fichiers publiés',
  sourceFiles: (n: number, checksummed: boolean) =>
    `${n} ${n > 1 ? 'fichiers sources' : 'fichier source'}${checksummed ? `, ${n > 1 ? 'chacun avec' : 'avec'} une somme SHA-256` : ''}`,
  index: 'Index des anatomies publiées',
  tractReference: 'Référence des faisceaux',
  sources: 'Sources',
  intendedUse:
    'Pour la recherche et l’enseignement. Planum n’est pas un dispositif médical et ne doit pas servir au diagnostic, au traitement ni à aucune autre décision clinique.',
};
