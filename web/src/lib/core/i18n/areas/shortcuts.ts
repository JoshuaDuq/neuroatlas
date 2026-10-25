/** A heading and its key, description rows. */
export type ShortcutGroup = [heading: string, rows: [key: string, description: string][]];

export const en = {
  title: 'Keyboard shortcuts',
  close: 'Close',
  groups: [
    [
      'Panel',
      [
        ['/', 'Focus the search field'],
        ['← →', 'On the mode tabs: move between Anatomy, Functions, Deficits, Circuits and Tracts'],
        [
          'Esc',
          'In a detail view: back to the list. Elsewhere: clear the search, then the selection, then the function or deficit',
        ],
        ['↑ ↓', 'Move through results or the tree'],
        ['→ ←', 'In the tree: open or close a group, or reach a region’s eye control'],
        ['Home End', 'First or last row of the tree'],
        ['Enter', 'Select the focused region'],
        ['V', 'Hide or show the focused tree row'],
      ],
    ],
    [
      'Model',
      [
        ['Tab', 'Move focus to the model'],
        ['← → ↑ ↓', 'Turn the model, once it has focus'],
        ['+ −', 'Zoom the model in or out'],
        ['1 – 6', 'Left, right, anterior, posterior, superior, inferior view'],
        ['0', 'Return to the oblique view'],
        ['F', 'Focus the selected region'],
        ['I', 'Isolate or restore the selected region'],
      ],
    ],
    [
      'Display',
      [
        ['C', 'Show or hide the cortex'],
        ['U', 'Show or hide internal anatomy'],
        ['S', 'Show or hide the spinal cord'],
        ['H', 'Cycle hemisphere: both, left, right'],
        ['M', 'Open or close linked MRI slices'],
        ['?', 'Open this list'],
      ],
    ],
  ] as ShortcutGroup[],
  singleKeysNote: (on: boolean): string =>
    on
      ? 'Page-wide single-key shortcuts (letters, numbers, / and ?) can be turned off in the settings menu.'
      : 'Page-wide single-key shortcuts are off. Turn them back on in the settings menu.',
};

export const fr: typeof en = {
  title: 'Raccourcis clavier',
  close: 'Fermer',
  groups: [
    [
      'Panneau',
      [
        ['/', 'Activer le champ de recherche'],
        [
          '← →',
          'Sur les onglets de mode : passer entre Anatomie, Fonctions, Déficits, Circuits et Faisceaux',
        ],
        [
          'Esc',
          'Dans une vue détaillée : revenir à la liste. Ailleurs : effacer la recherche, puis la sélection, puis le déficit',
        ],
        ['↑ ↓', 'Parcourir les résultats ou l’arborescence'],
        ['→ ←', 'Dans l’arbre : ouvrir ou fermer un groupe, ou atteindre l’œil d’une région'],
        ['Début Fin', 'Première ou dernière ligne de l’arbre'],
        ['Entrée', 'Sélectionner la région ciblée'],
        ['V', 'Masquer ou afficher la ligne ciblée de l’arbre'],
      ],
    ],
    [
      'Modèle',
      [
        ['Tab', 'Placer le focus sur le modèle'],
        ['← → ↑ ↓', 'Faire tourner le modèle, une fois ciblé'],
        ['+ −', 'Zoomer ou dézoomer le modèle'],
        ['1 – 6', 'Vue gauche, droite, antérieure, postérieure, supérieure, inférieure'],
        ['0', 'Revenir à la vue oblique'],
        ['F', 'Cibler la région sélectionnée'],
        ['I', 'Isoler ou rétablir la région sélectionnée'],
      ],
    ],
    [
      'Affichage',
      [
        ['C', 'Afficher ou masquer le cortex'],
        ['U', 'Afficher ou masquer l’anatomie interne'],
        ['S', 'Afficher ou masquer la moelle épinière'],
        ['H', 'Changer d’hémisphère : les deux, gauche, droite'],
        ['M', 'Ouvrir ou fermer les coupes IRM'],
        ['?', 'Ouvrir cette liste'],
      ],
    ],
  ] as ShortcutGroup[],
  singleKeysNote: (on: boolean): string =>
    on
      ? 'Les raccourcis à une touche valables sur toute la page (lettres, chiffres, / et ?) peuvent être désactivés dans le menu des réglages.'
      : 'Les raccourcis à une touche valables sur toute la page sont désactivés. Réactivez-les dans le menu des réglages.',
};
