export const en = {
  heading: 'Dissection',
  undo: 'Undo',
  restoreAll: 'Restore all',
  hideSelected: 'Hide',
  hiddenCount: (number: number) =>
    number ? `${number} ${number === 1 ? 'part' : 'parts'} hidden` : 'All parts shown',
  hidePart: (name: string, side: string) => `Hide ${name}, ${side}`,
  showPart: (name: string, side: string) => `Show ${name}, ${side}`,
  partial: 'partially hidden',
};

export const fr: typeof en = {
  heading: 'Dissection',
  undo: 'Annuler',
  restoreAll: 'Tout rétablir',
  hideSelected: 'Masquer',
  hiddenCount: (number: number) =>
    number
      ? `${number} ${number === 1 ? 'partie masquée' : 'parties masquées'}`
      : 'Tout est visible',
  hidePart: (name: string, side: string) => `Masquer ${name}, ${side}`,
  showPart: (name: string, side: string) => `Afficher ${name}, ${side}`,
  partial: 'partiellement masqué',
};
