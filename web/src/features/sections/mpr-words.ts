/**
 * The words of the Linked MRI dialog (ui/chrome/sections.js:390-407, 528-561): what the crosshair is
 * on, the readout, and the names of the three planes' controls. Pure, so each is tested without a
 * dialog.
 */
import { DESTRIEUX_LABELS } from '../../lib/core/catalog/destrieux-labels.ts';
import { DESTRIEUX_LABELS_FR } from '../../lib/core/catalog/destrieux-labels.fr.ts';
import { STRUCTURE_LABELS } from '../../lib/core/catalog/structure-groups.ts';
import { STRUCTURE_LABELS_FR } from '../../lib/core/catalog/structure-groups.fr.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { MprPlane } from '../../lib/engine/api.ts';
import type { Language } from '../../lib/types/index.ts';

const EM_DASH = '—';

/** The label volume's raw name as the reader's language words it (sections.js:390-407). */
export function sampleName(raw: string, lang: Language): string {
  if (!raw) return '';
  const tissue = t(lang, 'mri').tissueNames as Record<string, string>;
  if (tissue[raw]) return tissue[raw];
  const structures = lang === 'fr' ? STRUCTURE_LABELS_FR : STRUCTURE_LABELS;
  if (structures[raw]) return structures[raw].name;
  const clean = raw.replace(/^ctx_[lr]h_/, '');
  const destrieux = lang === 'fr' ? DESTRIEUX_LABELS_FR : DESTRIEUX_LABELS;
  if (destrieux[clean]) return destrieux[clean].name;
  if (raw.endsWith('_ROI')) return raw.replace(/^[LR]_/, '').replace(/_ROI$/, '');
  return raw;
}

/**
 * The crosshair's position and what is under it (deviations/g5-unlabelled-sample.md): a sample with
 * no name is "unlabelled" rather than "(label undefined)".
 */
export function readoutText(
  ras: string,
  sample: { name: string; labelId: number },
  lang: Language,
): string {
  const name = sampleName(sample.name, lang);
  if (!name) return `${ras} ${EM_DASH} ${t(lang, 'mri').tissueNames.Unknown}`;
  return t(lang, 'mpr').readout(ras, name, sample.labelId);
}

// TODO(C1): the `mpr` additions of deviations g5-save-names, g5-save-announce and
// g5-canvas-not-interactive (requested on #4).
const NEW = {
  en: {
    adjective: { sagittal: 'sagittal', coronal: 'coronal', axial: 'axial' },
    saved: (adjective: string) => `Saved the ${adjective} section as a PNG.`,
    canvas: (name: string, edges: string) =>
      `${name} MRI. Click to place the crosshair; use the position slider to change slice. ${edges}.`,
    edge: {
      top: 'at the top',
      right: 'at the right',
      bottom: 'at the bottom',
      left: 'at the left',
    },
    direction: {
      R: 'patient right',
      L: 'patient left',
      S: 'superior',
      I: 'inferior',
      P: 'posterior',
      A: 'anterior',
    },
  },
  fr: {
    adjective: { sagittal: 'sagittale', coronal: 'coronale', axial: 'axiale' },
    saved: (adjective: string) => `Coupe ${adjective} enregistrée au format PNG.`,
    canvas: (name: string, edges: string) =>
      `Coupe IRM ${name}. Cliquez pour placer le réticule ; utilisez le curseur de position pour changer de coupe. ${edges}.`,
    edge: { top: 'en haut', right: 'à droite', bottom: 'en bas', left: 'à gauche' },
    direction: {
      R: 'droite du patient',
      L: 'gauche du patient',
      S: 'supérieur',
      I: 'inférieur',
      P: 'postérieur',
      A: 'antérieur',
    },
  },
} as const;

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export const planeName = (plane: MprPlane, lang: Language): string => t(lang, 'mpr').labels[plane];

/** The slider's visible label, and so its name (deviations/g5-slider-label-in-name.md). */
export const positionLabel = (plane: MprPlane, lang: Language): string =>
  t(lang, 'mpr').positionLabel(planeName(plane, lang));

/** What the Save PNG button says aloud after its visible words (deviations/g5-save-names.md). */
export const saveSuffix = (plane: MprPlane, lang: Language): string =>
  `, ${planeName(plane, lang).toLowerCase()}`;

/** Said once the PNG is handed to the browser (deviations/g5-save-announce.md). */
export const savedAnnouncement = (plane: MprPlane, lang: Language): string =>
  NEW[lang].saved(NEW[lang].adjective[plane]);

/**
 * A picture's text alternative: how to use it, and which way each edge faces, since the letters are
 * drawn into the bitmap (deviations/g5-canvas-not-interactive.md).
 */
export function canvasName(plane: MprPlane, edges: readonly string[], lang: Language): string {
  const words = NEW[lang];
  if (edges.length !== SIDES.length) {
    throw new RangeError(`A section has four edges, not ${edges.length}.`);
  }
  const faces = SIDES.map((side, index) => {
    const letter = edges[index] as keyof typeof words.direction;
    const direction = words.direction[letter];
    if (!direction) throw new RangeError(`Unknown orientation letter: ${letter}`);
    return `${direction} ${words.edge[side]}`;
  });
  const sentence = faces.join(', ');
  return words.canvas(
    lang === 'fr' ? words.adjective[plane] : planeName(plane, lang),
    sentence.charAt(0).toUpperCase() + sentence.slice(1),
  );
}

/** The exported image's file name (sections.js:310). */
export const pngFileName = (subject: string, plane: MprPlane, offset: number): string =>
  `${subject}-${plane}-${offset.toFixed(1)}mm.png`;
