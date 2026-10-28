export const en = {
  spoken: (name: string, side: string) => `Selected: ${name}, ${side}`,
  selectionCleared: (name: string) => `Selection cleared — ${name} is no longer shown.`,
  cabNpAtlasOnly: (atlas: string) =>
    `CAB-NP colours HCP-MMP areas only, so ${atlas} shows its own region colours.`,
};

export const fr: typeof en = {
  spoken: (name: string, side: string) => `Sélectionné : ${name}, ${side}`,
  selectionCleared: (name: string) => `Sélection effacée — ${name} n’est plus visible.`,
  cabNpAtlasOnly: (atlas: string) =>
    `CAB-NP ne colore que les aires HCP-MMP : ${atlas} affiche donc les couleurs de ses régions.`,
};
