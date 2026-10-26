import type { Language } from '../../lib/types/index.ts';

/**
 * Strings the Tracts panel adds to the legacy set (decision 42 on #4, deviations t1-*). They wait here
 * for C1's amendment queue and move to `lib/core/i18n/areas/diffusion.ts` unchanged.
 */
const en = {
  /** The filter's result, spoken after typing pauses. */
  matches: (count: number) => `${count} tract ${count === 1 ? 'bundle' : 'bundles'}`,
  loaded: (name: string) => `Loaded: ${name}`,
  restored: 'Default tracts restored.',
  exported: 'Lengths CSV exported.',
  newTab: '(opens in a new tab)',
  tryAgain: 'Try again',
};

const fr: typeof en = {
  matches: (count: number) => `${count} ${count === 1 ? 'faisceau' : 'faisceaux'}`,
  loaded: (name: string) => `Chargé : ${name}`,
  restored: 'Faisceaux initiaux rétablis.',
  exported: 'CSV des longueurs exporté.',
  newTab: '(s’ouvre dans un nouvel onglet)',
  tryAgain: 'Réessayer',
};

export const tractsCopy = (lang: Language) => (lang === 'fr' ? fr : en);
