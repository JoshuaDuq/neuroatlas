/** Bilingual UI strings (English and French) for Planum, one file per area under areas/. Area files are frozen: later changes go through the i18n amendment queue on #4. */
import type { Language } from '../../types/index.ts';
import * as agreement from './areas/agreement.ts';
import * as app from './areas/app.ts';
import * as atlases from './areas/atlases.ts';
import * as boundary from './areas/boundary.ts';
import * as circuits from './areas/circuits.ts';
import * as clinical from './areas/clinical.ts';
import * as comparison from './areas/comparison.ts';
import * as coordinate from './areas/coordinate.ts';
import * as cuts from './areas/cuts.ts';
import * as deficitKey from './areas/deficitKey.ts';
import * as diffusion from './areas/diffusion.ts';
import * as display from './areas/display.ts';
import * as dissection from './areas/dissection.ts';
import * as domains from './areas/domains.ts';
import * as errors from './areas/errors.ts';
import * as footer from './areas/footer.ts';
import * as functional from './areas/functional.ts';
import * as functions from './areas/functions.ts';
import * as header from './areas/header.ts';
import * as inspector from './areas/inspector.ts';
import * as lesion from './areas/lesion.ts';
import * as link from './areas/link.ts';
import * as menu from './areas/menu.ts';
import * as mpr from './areas/mpr.ts';
import * as mri from './areas/mri.ts';
import * as navigator from './areas/navigator.ts';
import * as networks from './areas/networks.ts';
import * as orientation from './areas/orientation.ts';
import * as reasons from './areas/reasons.ts';
import * as receptors from './areas/receptors.ts';
import * as sheet from './areas/sheet.ts';
import * as territories from './areas/territories.ts';
import * as cerebellarFunctions from './areas/cerebellarFunctions.ts';
import * as shortcuts from './areas/shortcuts.ts';
import * as sides from './areas/sides.ts';
import * as viewport from './areas/viewport.ts';
import * as views from './areas/views.ts';
import * as workspace from './areas/workspace.ts';

export const TRANSLATIONS = {
  en: {
    agreement: agreement.en,
    app: app.en,
    atlases: atlases.en,
    boundary: boundary.en,
    circuits: circuits.en,
    clinical: clinical.en,
    comparison: comparison.en,
    coordinate: coordinate.en,
    cuts: cuts.en,
    deficitKey: deficitKey.en,
    diffusion: diffusion.en,
    display: display.en,
    dissection: dissection.en,
    domains: domains.en,
    errors: errors.en,
    footer: footer.en,
    functional: functional.en,
    functions: functions.en,
    header: header.en,
    inspector: inspector.en,
    lesion: lesion.en,
    link: link.en,
    menu: menu.en,
    mpr: mpr.en,
    mri: mri.en,
    navigator: navigator.en,
    networks: networks.en,
    orientation: orientation.en,
    reasons: reasons.en,
    receptors: receptors.en,
    sheet: sheet.en,
    territories: territories.en,
    cerebellarFunctions: cerebellarFunctions.en,
    shortcuts: shortcuts.en,
    sides: sides.en,
    viewport: viewport.en,
    views: views.en,
    workspace: workspace.en,
  },
  fr: {
    agreement: agreement.fr,
    app: app.fr,
    atlases: atlases.fr,
    boundary: boundary.fr,
    circuits: circuits.fr,
    clinical: clinical.fr,
    comparison: comparison.fr,
    coordinate: coordinate.fr,
    cuts: cuts.fr,
    deficitKey: deficitKey.fr,
    diffusion: diffusion.fr,
    display: display.fr,
    dissection: dissection.fr,
    domains: domains.fr,
    errors: errors.fr,
    footer: footer.fr,
    functional: functional.fr,
    functions: functions.fr,
    header: header.fr,
    inspector: inspector.fr,
    lesion: lesion.fr,
    link: link.fr,
    menu: menu.fr,
    mpr: mpr.fr,
    mri: mri.fr,
    navigator: navigator.fr,
    networks: networks.fr,
    orientation: orientation.fr,
    reasons: reasons.fr,
    receptors: receptors.fr,
    sheet: sheet.fr,
    territories: territories.fr,
    cerebellarFunctions: cerebellarFunctions.fr,
    shortcuts: shortcuts.fr,
    sides: sides.fr,
    viewport: viewport.fr,
    views: views.fr,
    workspace: workspace.fr,
  },
};

export type Area = keyof typeof TRANSLATIONS.en;

/** The strings of one area; a language without a table reads English (legacy `t`, i18n/translations.js:1072). */
export function t<A extends Area>(lang: string, area: A): (typeof TRANSLATIONS.en)[A] {
  return (Object.hasOwn(TRANSLATIONS, lang) ? TRANSLATIONS[lang as Language] : TRANSLATIONS.en)[
    area
  ];
}

/** Masthead atlas switch: a short name. The full title stays on the button’s title. */
export function atlasSwitchLabel(id: string, lang: string = 'en'): string {
  const short: Record<string, string | undefined> = t(lang, 'header').atlasShort;
  const full: Record<string, string | undefined> = t(lang, 'atlases');
  return short[id] ?? full[id] ?? id;
}
