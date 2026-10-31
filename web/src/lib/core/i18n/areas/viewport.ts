import { decimal, withUnit } from '../../format.ts';

const megabytes = (bytes: number, unit: 'MB' | 'Mo', lang: 'en' | 'fr') =>
  withUnit(decimal(bytes / 1_048_576, 1, lang), unit, lang);

export const en = {
  navigationHint: 'Drag to rotate · Scroll to zoom · Click to inspect',
  navigationHintTracts: 'Drag to rotate · Scroll to zoom',
  // For a finger rather than a mouse (decision 21 on #4).
  navigationHintTouch: 'Drag to rotate · Pinch to zoom · Tap to inspect',
  navigationHintTractsTouch: 'Drag to rotate · Pinch to zoom',
  // Shown while the model has keyboard focus.
  keyboardHint: '3D view · Arrow keys rotate · + − zoom',
  viewAria: 'Anatomical view',
  // A named view: the orientation gizmo's buttons, and the caption written onto an exported image.
  namedView: (name: string) => `${name} view`,
  sectionTool: 'Section',
  lesionTool: 'Lesion',
  coordinateTool: 'Coordinate',
  displayTool: 'Display',
  // The stage dock and the orientation gizmo's turn buttons (decision 22 on #4).
  dockLabel: '3D viewer tools',
  orbitGroup: 'Turn the model',
  orbitLeft: 'Turn left',
  orbitRight: 'Turn right',
  orbitUp: 'Turn up',
  orbitDown: 'Turn down',
  // Streamline colour is each segment's local direction: |x| red, |y| green, |z| blue.
  directionKey: {
    title: 'Local streamline direction',
    leftRight: 'Left–right',
    anteriorPosterior: 'Anterior–posterior',
    superiorInferior: 'Superior–inferior',
  },
  // Visually hidden after a stage-key row whose colour is not drawn (WCAG 1.4.1).
  keyAbsent: 'Not shown in this view',
  snapshot: 'Save image (PNG)',
  // Written onto the exported image, which travels without the page around it.
  snapshotStatement: 'Planum · Not clinical anatomy',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  snapshotSaved: (file: string) => `Image saved as ${file}.`,
  loadingAnatomy: 'Loading anatomy…',
  loadingWithTotal: (l: number, t: number) =>
    `Loading anatomy · ${megabytes(l, 'MB', 'en')} / ${megabytes(t, 'MB', 'en')}`,
  progressAria: 'Anatomy download',
  loaded: 'Anatomy loaded.',
  canvasRole: '3D anatomy viewer',
  canvasLabel:
    'Brain model. Drag or use the arrow keys to rotate, scroll or press plus and minus to zoom, click a region to select.',
  error: 'Something went wrong.',
  retry: 'Retry',
};

export const fr: typeof en = {
  navigationHint: 'Glisser : tourner · Molette : zoom · Clic : inspecter',
  navigationHintTracts: 'Glisser : tourner · Molette : zoom',
  navigationHintTouch: 'Glisser\u202f: tourner · Pincer\u202f: zoom · Toucher\u202f: inspecter',
  navigationHintTractsTouch: 'Glisser\u202f: tourner · Pincer\u202f: zoom',
  keyboardHint: 'Vue 3D · Flèches : tourner · + − : zoom',
  viewAria: 'Vue anatomique',
  namedView: (name: string) => `Vue ${name.toLowerCase()}`,
  sectionTool: 'Coupe',
  lesionTool: 'Lésion',
  coordinateTool: 'Coordonnée',
  displayTool: 'Affichage',
  dockLabel: 'Outils du visualiseur 3D',
  orbitGroup: 'Faire pivoter le modèle',
  orbitLeft: 'Tourner à gauche',
  orbitRight: 'Tourner à droite',
  orbitUp: 'Tourner vers le haut',
  orbitDown: 'Tourner vers le bas',
  directionKey: {
    title: 'Direction locale des trajectoires',
    leftRight: 'Gauche–droite',
    anteriorPosterior: 'Antéro-postérieur',
    superiorInferior: 'Supéro-inférieur',
  },
  keyAbsent: 'Absent de cette vue',
  snapshot: 'Enregistrer l’image (PNG)',
  snapshotStatement: 'Planum · Pas une anatomie clinique',
  fullscreen: 'Plein écran',
  exitFullscreen: 'Quitter le plein écran',
  snapshotSaved: (file: string) => `Image enregistrée : ${file}.`,
  loadingAnatomy: 'Chargement de l’anatomie…',
  loadingWithTotal: (l: number, t: number) =>
    `Chargement de l’anatomie · ${megabytes(l, 'Mo', 'fr')} / ${megabytes(t, 'Mo', 'fr')}`,
  progressAria: 'Téléchargement de l’anatomie',
  loaded: 'Anatomie chargée.',
  canvasRole: 'visionneuse anatomique 3D',
  canvasLabel:
    'Modèle du cerveau. Glissez ou utilisez les flèches pour tourner, défilez ou appuyez sur plus et moins pour zoomer, cliquez sur une région pour la sélectionner.',
  error: 'Une erreur est survenue.',
  retry: 'Réessayer',
};
