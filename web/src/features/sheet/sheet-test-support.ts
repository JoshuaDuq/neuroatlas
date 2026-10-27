// What the sheet fixture records: the calls the composing chunk would receive.
import type { Detent } from '../../lib/core/detents.ts';
import type { ChromeInsets } from '../../lib/engine/api.ts';

export interface Recorded {
  insets: { insets: ChromeInsets; settle: boolean }[];
  detents: Detent[];
  calls: string[];
}

export const newRecorded = (): Recorded => ({ insets: [], detents: [], calls: [] });
