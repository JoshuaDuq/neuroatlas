export const en = {
  modes: {
    anatomy: 'Anatomy',
    functions: 'Functions',
    deficits: 'Deficits',
    circuits: 'Circuits',
    diffusion: 'Tracts',
  },
  tabsAria: 'Explore the atlas',
  inspect: (name: string) => `Inspect ${name}`,
  back: (name: string) => `Back to ${name}`,
  path: 'Breadcrumb',
  showInList: (name: string) => `${name}, show in the list`,
};

export const fr: typeof en = {
  modes: {
    anatomy: 'Anatomie',
    functions: 'Fonctions',
    deficits: 'Déficits',
    circuits: 'Circuits',
    diffusion: 'Faisceaux',
  },
  tabsAria: 'Explorer l’atlas',
  inspect: (name: string) => `Examiner ${name}`,
  back: (name: string) => `Retour : ${name}`,
  path: 'Fil d’Ariane',
  showInList: (name: string) => `${name}, afficher dans la liste`,
};
