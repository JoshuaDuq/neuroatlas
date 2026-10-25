export const en = {
  spoken: (name: string, side: string) => `Selected: ${name}, ${side}`,
  selectionCleared: (name: string) => `Selection cleared — ${name} is no longer shown.`,
  cabNpAtlasOnly: (atlas: string) =>
    `CAB-NP colours HCP-MMP areas only, so ${atlas} shows its own region colours.`,
  functionalAtlasOnly: (atlas: string) =>
    `Functional divisions colour HCP-MMP areas only, so ${atlas} shows its own region colours.`,
  functionalHidesInternal: 'Internal anatomy is hidden; Display shows it again.',
};

export const fr: typeof en = {
  spoken: (name: string, side: string) => `Sélectionné : ${name}, ${side}`,
  selectionCleared: (name: string) => `Sélection effacée — ${name} n’est plus visible.`,
  cabNpAtlasOnly: (atlas: string) =>
    `CAB-NP ne colore que les aires HCP-MMP : ${atlas} affiche donc les couleurs de ses régions.`,
  functionalAtlasOnly: (atlas: string) =>
    `Les divisions fonctionnelles ne colorent que les aires HCP-MMP : ${atlas} affiche donc les couleurs de ses régions.`,
  functionalHidesInternal: 'L’anatomie interne est masquée ; Affichage la montre à nouveau.',
};
