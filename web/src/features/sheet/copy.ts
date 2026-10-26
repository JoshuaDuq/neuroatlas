import type { Detent } from '../../lib/core/detents.ts';
import type { Language } from '../../lib/types/index.ts';

/**
 * What the polite live region says after the reader moves the sheet (decision 20 on #4).
 * TODO(C1): move these into `lib/core/i18n/areas/sheet.ts` when the amendment lands, and delete this table.
 */
const DETENT_ANNOUNCEMENTS: Record<Language, Record<Detent, string>> = {
  en: {
    peek: 'Panel collapsed',
    half: 'Panel half open',
    full: 'Panel fully open',
  },
  fr: {
    peek: 'Panneau replié',
    half: 'Panneau à moitié ouvert',
    full: 'Panneau entièrement ouvert',
  },
};

export const detentAnnouncement = (lang: Language, detent: Detent): string =>
  DETENT_ANNOUNCEMENTS[lang][detent];
