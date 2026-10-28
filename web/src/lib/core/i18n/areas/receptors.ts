export const en = {
  heading: 'Receptor densities',
  parts: 'Sampled part',
  dorsal: 'Dorsal',
  ventral: 'Ventral',
  noSd: 'no SD',
  notMeasured: (list: string) => `Not measured: ${list}.`,
  noSdPublished: (list: string) => `No SD published for ${list}.`,
  withheld: (receptor: string, published: string, reason: string) =>
    `${receptor} SD withheld (published as ${published}): ${reason}`,
  note: (unit: string, hemispheres: number, donors: number, ages: string, count: number) =>
    `Mean ± SD in ${unit}, by in vitro receptor autoradiography of ${hemispheres} hemispheres from ${donors} post-mortem brains aged ${ages}; some receptors may have been measured in fewer. Each bar is the share of that receptor’s highest mean among the ${count} published fingerprints.`,
  measuredIn: (name: string) =>
    `Measured in: ${name}. Carried to this brain by name and not measured in it; both hemispheres show the same values.`,
  dataset: 'EBRAINS dataset',
};

export const fr: typeof en = {
  heading: 'Densités de récepteurs',
  parts: 'Partie échantillonnée',
  dorsal: 'Dorsale',
  ventral: 'Ventrale',
  noSd: 'sans écart-type',
  notMeasured: (list: string) => `Non mesurés\u202f: ${list}.`,
  noSdPublished: (list: string) => `Aucun écart-type publié pour ${list}.`,
  withheld: (receptor: string, published: string, reason: string) =>
    `Écart-type de ${receptor} retenu (publié à ${published})\u202f: ${reason}`,
  note: (unit: string, hemispheres: number, donors: number, ages: string, count: number) =>
    `Moyenne ± écart-type en ${unit}, par autoradiographie quantitative in vitro des récepteurs de ${hemispheres} hémisphères issus de ${donors} cerveaux post mortem âgés de ${ages}\u202f; certains récepteurs ont pu être mesurés dans moins d’hémisphères. Chaque barre est la part de la moyenne la plus élevée de ce récepteur parmi les ${count} empreintes publiées.`,
  measuredIn: (name: string) =>
    `Mesuré dans\u202f: ${name}. Porté sur ce cerveau par son nom, sans mesure dans ce cerveau\u202f; les deux hémisphères montrent les mêmes valeurs.`,
  dataset: 'Jeu de données EBRAINS',
};
