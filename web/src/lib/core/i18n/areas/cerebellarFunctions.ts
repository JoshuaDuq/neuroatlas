export const en = {
  heading: 'Functional regions (group atlas)',
  basis: 'Share of this lobule’s voxels in each functional region.',
  unassigned: (share: string) => `${share} lies in no region the atlas draws on this brain.`,
  caveat:
    'A group atlas from seven task-based fMRI datasets (Nettekoven et al. 2024), registered onto this brain from the SUIT template: not this brain’s measured function. Registration places borders a few millimetres off, and individual functional borders differ from the group’s.',
};

export const fr: typeof en = {
  heading: 'Régions fonctionnelles (atlas de groupe)',
  basis: 'Part des voxels de ce lobule dans chaque région fonctionnelle.',
  unassigned: (share: string) =>
    `${share} ne se trouve dans aucune région que l’atlas trace sur ce cerveau.`,
  caveat:
    'Un atlas de groupe issu de sept jeux de données d’IRMf de tâches (Nettekoven et al. 2024), recalé sur ce cerveau depuis le gabarit SUIT\u202f: pas la fonction mesurée de ce cerveau. Le recalage décale les limites de quelques millimètres, et les limites fonctionnelles individuelles diffèrent de celles du groupe.',
};
