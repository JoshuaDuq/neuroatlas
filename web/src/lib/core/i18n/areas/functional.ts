export const en = {
  heading: 'Functional division',
  named: 'Named region',
  section: (number: number) => `Section ${number}`,
  unnamed: 'No source names a finer region for this area, so it is shown only within its section.',
  // A no-break hyphen: the atlas name never splits across the meta line's wrap.
  areas: (list: string) => `HCP‑MMP areas: ${list}`,
  contested: (primary: number | string, alternative: number | string) =>
    `Glasser’s Table 1 gives section ${primary} as this area’s primary section; the supplement’s section text lists it under section ${alternative}.`,
  note: 'Published groupings of whole HCP-MMP areas, reaching this brain through its HCP-MMP projection; not measured function in this brain.',
  keyAria: 'Functional division level',
  levels: { named: 'Named', sections: 'Sections' },
};

export const fr: typeof en = {
  heading: 'Division fonctionnelle',
  named: 'Région nommée',
  section: (number: number) => `Section ${number}`,
  unnamed:
    'Aucune source ne nomme de région plus fine pour cette aire\u202f; elle n’est montrée que dans sa section.',
  areas: (list: string) => `Aires HCP\u2011MMP\u202f: ${list}`,
  contested: (primary: number | string, alternative: number | string) =>
    `La table 1 de Glasser donne la section ${primary} comme section principale de cette aire\u202f; le texte du supplément la range dans la section ${alternative}.`,
  note: 'Regroupements publiés d’aires HCP-MMP entières, portés sur ce cerveau par sa projection HCP-MMP\u202f; sans mesure fonctionnelle de ce cerveau.',
  keyAria: 'Niveau des divisions fonctionnelles',
  levels: { named: 'Nommées', sections: 'Sections' },
};
