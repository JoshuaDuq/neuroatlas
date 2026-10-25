import type { Language, LoadStatus, Notice, Region } from '../types/index.ts';
import { dissectionSaid } from '../core/state/dissection.ts';
import { t } from '../core/i18n/index.ts';

/** What the announcer reads of the view (app.js:1658-1693). */
export interface SpeechView {
  lang: Language;
  selectedRegion: Region | null;
  hiddenRegions: ReadonlySet<string>;
  notice: Notice | null;
  status: LoadStatus;
}

/**
 * The text state is the product for a reader who cannot see the render. Each call takes the view
 * and returns the sentences to say, in order: a notice outranks the selection it often
 * accompanies, a changed count of hidden parts joins that sentence so one announcer speaks once,
 * and a lost or restored graphics context is said after it.
 */
export function createSpeech(regionName: (region: Region) => string) {
  let announced: string | null = null;
  let announcedNotice: string | null = null;
  let announcedStatus: LoadStatus | null = null;
  let counted: number | null = null;

  return {
    next(view: SpeechView): string[] {
      const { lang, selectedRegion: region } = view;
      const hidden = view.hiddenRegions.size;
      const dissection = counted !== null && counted !== hidden ? dissectionSaid(view) : null;
      counted = hidden;

      const spoken = region
        ? t(lang, 'app').spoken(
            regionName(region),
            t(lang, 'sides').words[region.hemisphere] ?? region.hemisphere,
          )
        : null;
      const said = view.notice?.text ?? null;
      const joined = (sentence: string | null) =>
        sentence && dissection
          ? `${sentence.replace(/[^.!?…]$/, '$&.')} ${dissection}`
          : sentence || dissection || '';

      const sentences: string[] = [];
      if (said && said !== announcedNotice) sentences.push(joined(said));
      else if (spoken !== announced) sentences.push(joined(spoken));
      else if (dissection) sentences.push(dissection);
      if (view.status === 'context-lost' && announcedStatus !== 'context-lost') {
        sentences.push(t(lang, 'errors').contextLost);
      } else if (announcedStatus === 'context-lost' && view.status === 'ready') {
        sentences.push(t(lang, 'viewport').loaded);
      }
      announced = spoken;
      announcedNotice = said;
      announcedStatus = view.status;
      return sentences;
    },
  };
}
