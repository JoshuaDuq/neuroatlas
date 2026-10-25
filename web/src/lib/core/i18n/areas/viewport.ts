import { decimal, withUnit } from '../../format.ts';

const megabytes = (bytes: number, unit: 'MB' | 'Mo', lang: 'en' | 'fr') =>
  withUnit(decimal(bytes / 1_048_576, 1, lang), unit, lang);

export const en = {
  navigationHint: 'Drag to rotate · Scroll to zoom · Click to inspect',
  navigationHintTracts: 'Drag to rotate · Scroll to zoom',
  // Shown while the model has keyboard focus.
  keyboardHint: '3D view · Arrow keys rotate · + − zoom',
  viewAria: 'Anatomical view',
  viewToolAria: (name: string) => `Anatomical view: ${name}`,
  viewTool: 'View',
  sectionTool: 'Section',
  displayTool: 'Display',
  // Streamline colour is each segment's local direction: |x| red, |y| green, |z| blue.
  directionKey: {
    title: 'Local streamline direction',
    leftRight: 'Left–right',
    anteriorPosterior: 'Anterior–posterior',
    superiorInferior: 'Superior–inferior',
  },
  snapshot: 'Save image (PNG)',
  // Written onto the exported image, which travels without the page around it.
  snapshotView: (name: string) => `${name} view`,
  snapshotStatement: 'Planum · Not clinical anatomy',
  fullscreen: 'Full screen',
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
  keyboardHint: 'Vue 3D · Flèches : tourner · + − : zoom',
  viewAria: 'Vue anatomique',
  viewToolAria: (name: string) => `Vue anatomique : ${name.toLowerCase()}`,
  viewTool: 'Vue',
  sectionTool: 'Coupe',
  displayTool: 'Affichage',
  directionKey: {
    title: 'Direction locale des trajectoires',
    leftRight: 'Gauche–droite',
    anteriorPosterior: 'Antéro-postérieur',
    superiorInferior: 'Supéro-inférieur',
  },
  snapshot: 'Enregistrer l’image (PNG)',
  snapshotView: (name: string) => `Vue ${name.toLowerCase()}`,
  snapshotStatement: 'Planum · Pas une anatomie clinique',
  fullscreen: 'Plein écran',
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
