export const en = {
  heading: 'Boundary certainty',
  summary: (share: string, soft: number, total: number) =>
    `Near tie on ${share} of this region’s rated boundary · ${soft} of ${total} boundaries soft`,
  soft: 'soft',
  firm: 'firm',
  more: (count: number) =>
    count === 1 ? '1 smaller boundary not listed.' : `${count} smaller boundaries not listed.`,
  note: (spacing: string, margin: string) =>
    `Share of each shared boundary, in ${spacing} voxels, where NextBrain’s two most probable labels were this pair and within ${margin} of each other. On the cut, solid is firm, dashed is soft (a third or more) and grey is not rated. This is the model’s own competition between its labels, not agreement with another segmentation; boundaries across the midline are not rated.`,
};

export const fr: typeof en = {
  heading: 'Certitude des limites',
  summary: (share: string, soft: number, total: number) =>
    `Quasi-égalité sur ${share} des limites évaluées de cette région · ${soft} ${soft > 1 ? 'limites floues' : 'limite floue'} sur ${total}`,
  soft: 'floue',
  firm: 'nette',
  more: (count: number) =>
    count === 1 ? '1 limite plus petite non listée.' : `${count} limites plus petites non listées.`,
  note: (spacing: string, margin: string) =>
    `Part de chaque limite commune, en voxels de ${spacing}, où les deux étiquettes les plus probables de NextBrain étaient cette paire, à moins de ${margin} l’une de l’autre. Sur la coupe, un trait plein est une limite nette, des tirets une limite floue (un tiers ou plus) et le gris une limite non évaluée. C’est la compétition du modèle entre ses propres étiquettes, pas l’accord avec une autre segmentation ; les limites de part et d’autre de la ligne médiane ne sont pas évaluées.`,
};
