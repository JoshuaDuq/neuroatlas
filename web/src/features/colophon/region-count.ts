import type { Language, LoadProgress, LoadStatus } from '../../lib/types/index.ts';
import { loadingText } from '../../lib/core/panels/header.ts';
import { t } from '../../lib/core/i18n/index.ts';

/**
 * The status bar's count (ui/chrome/header.js:538-541). Tracts mode names its bundles;
 * elsewhere it counts the regions drawn, or shows a download the masthead's data bar is not
 * already showing (`choosing`: a field of the data bar holds a pending choice).
 */
export function regionCountText(
  lang: Language,
  {
    tracts,
    status,
    progress,
    visibleCount,
    choosing,
  }: {
    tracts: string | null;
    status: LoadStatus;
    progress: LoadProgress | null;
    visibleCount: number;
    choosing: boolean;
  },
): string {
  if (tracts !== null) return tracts;
  const switching = status === 'switching';
  if (switching && !choosing) return loadingText(lang, progress);
  return status === 'ready' || switching ? t(lang, 'footer').visibleRegions(visibleCount) : '';
}
