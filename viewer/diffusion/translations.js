import { decimal, formatRas, grouped } from '../ui/format.js';
import { DiffusionInputError } from './validation.js';

export const DIFFUSION_TEXT = {
  en: {
    dataset: 'SNAIL reference · subject 1', bundleCollection: '27 tract bundles', bundles: 'Tract bundles',
    brainOpacity: 'Brain outline opacity', minimum: 'Minimum length (mm)',
    cortexOpacity: 'Cortex opacity', showOverlay: 'Show tracts with anatomy',
    mriOpen: 'MRI with tracts',
    nativeReference: 'Tracts in their own T1 reference brain.',
    nativeCanvas: 'Reference brain and tracts. Drag or use arrow keys to rotate, scroll or press plus and minus to zoom. Select tract bundles in the side panel.',
    outlineLimit: 'MRI-derived brain outline; no cortical atlas labels on this outline.',
    otherAnatomy: 'The selected anatomical atlas uses a different subject from these SNAIL tracts.',
    mriHint: 'The linked MRI uses the same scan, and a cut slices both layers together.',
    files: 'Files: each tract is one bundles_*.trk.gz streamline file; the MRI is t1_warped.nii.gz.',
    metricsScope: 'Counts and lengths use complete source streamlines after the length filter. Section cuts affect the view only.',
    outlineProvenance: 'Brain outline method and provenance',
    search: 'Search tracts', noMatchHint: 'Try another tract name.',
    retry: 'Reload reference dataset', ready: 'Reference dataset ready.',
    loading: 'Loading reference dataset…',
    restore: 'Restore default tracts', exportMetrics: 'Export lengths CSV',
    streamlines: (shown, total) => (shown === total
      ? `${grouped(total)} ${total === 1 ? 'streamline' : 'streamlines'}`
      : `${grouped(shown)} of ${grouped(total)} streamlines`),
    mean: 'mean', range: 'range', noShown: 'No streamlines meet this length filter.',
    source: 'Dataset source · CC0', about: 'About this data', settings: 'Tract display',
  },
  fr: {
    dataset: 'Référence SNAIL · sujet 1', bundleCollection: '27 faisceaux', bundles: 'Faisceaux',
    brainOpacity: 'Opacité du contour cérébral', minimum: 'Longueur minimale (mm)',
    cortexOpacity: 'Opacité du cortex', showOverlay: 'Afficher les faisceaux avec l’anatomie',
    mriOpen: 'IRM avec faisceaux',
    nativeReference: 'Faisceaux dans leur propre cerveau de référence T1.',
    nativeCanvas: 'Cerveau de référence et faisceaux. Glisser ou utiliser les flèches pour tourner, défiler ou appuyer sur plus et moins pour zoomer. Sélectionner les faisceaux dans le panneau.',
    outlineLimit: 'Contour cérébral dérivé de l’IRM, sans étiquettes corticales sur ce contour.',
    otherAnatomy: 'L’atlas anatomique sélectionné utilise un autre sujet que ces faisceaux SNAIL.',
    mriHint: 'L’IRM liée utilise la même image, et une coupe tranche les deux couches ensemble.',
    files: 'Fichiers : chaque faisceau est un fichier de trajectoires bundles_*.trk.gz ; l’IRM est t1_warped.nii.gz.',
    metricsScope: 'Les nombres et longueurs utilisent les trajectoires sources complètes après le filtre de longueur. Les coupes modifient seulement la vue.',
    outlineProvenance: 'Méthode et provenance du contour cérébral',
    search: 'Rechercher des faisceaux', noMatchHint: 'Essayez un autre nom de faisceau.',
    retry: 'Recharger les données de référence', ready: 'Données de référence prêtes.',
    loading: 'Chargement des données de référence…',
    restore: 'Rétablir les faisceaux initiaux', exportMetrics: 'Exporter les longueurs CSV',
    streamlines: (shown, total) => (shown === total
      ? `${grouped(total)} ${total === 1 ? 'trajectoire' : 'trajectoires'}`
      : `${grouped(shown)} sur ${grouped(total)} trajectoires`),
    mean: 'moyenne', range: 'étendue', noShown: 'Aucune trajectoire ne satisfait ce filtre de longueur.',
    source: 'Source des données · CC0', about: 'À propos de ces données', settings: 'Affichage des faisceaux',
  },
};

/** The MRI crosshair as the house writes a point, signed RAS, then the T1 and FA samples under it. */
export function mriReadout(mm, t1, fa, lang) {
  // French sets a narrow no-break space before a colon; a label never wraps away from its value.
  const colon = lang === 'fr' ? '\u202f:\u00a0' : ':\u00a0';
  return `RAS${colon}${formatRas(mm, lang)} · T1${colon}${decimal(t1, 0, lang)} · FA${colon}${decimal(fa, 2, lang)}`;
}

const ERRORS = {
  en: {
    'asset-fetch': 'The reference data could not be downloaded. Check the connection, then try again.',
    'asset-updated': 'NeuroAtlas was updated while this page was open. Reload the page to load the new data.',
    'invalid-data': 'The reference data could not be read.',
    failed: 'The reference data could not be displayed.',
  },
  fr: {
    'asset-fetch': 'Les données de référence n’ont pas pu être téléchargées. Vérifiez la connexion, puis réessayez.',
    'asset-updated': 'NeuroAtlas a été mis à jour pendant que cette page était ouverte. Rechargez la page pour charger les nouvelles données.',
    'invalid-data': 'Les données de référence n’ont pas pu être lues.',
    failed: 'Les données de référence n’ont pas pu être affichées.',
  },
};

/** The stable code a diffusion-panel failure is shown by; the English detail stays in the console. */
export function diffusionErrorCode(error) {
  if (error?.code === 'asset-fetch' || error?.code === 'asset-updated') return error.code;
  return error instanceof DiffusionInputError ? 'invalid-data' : 'failed';
}

export const diffusionError = (lang, error) => ERRORS[lang][diffusionErrorCode(error)];
