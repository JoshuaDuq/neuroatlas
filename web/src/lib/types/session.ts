import type { EXPLORERS } from './constants.ts';
import type { Notice } from './notice.ts';

export type Explorer = (typeof EXPLORERS)[number];
export type Language = 'en' | 'fr';
export type Theme = 'light' | 'dark';

/** `switching` is a download behind a model already on screen (state/session.js:121). */
export type LoadStatus = 'loading' | 'ready' | 'switching' | 'context-lost' | 'error';

export interface LoadProgress {
  loaded: number;
  total: number;
}

/** The reader's session state (`createSession`, state/session.js:49). */
export interface SessionState {
  view: string;
  query: string;
  explorer: Explorer;
  functionQuery: string;
  selectedFunction: string | null;
  clinicalQuery: string;
  selectedDeficit: string | null;
  /** One of the open deficit's findings shown alone, or null for all of them. */
  selectedFinding: string | null;
  /** The reader chose a masthead colour or atlas over the open function's or deficit's paint. */
  paintLifted: boolean;
  expanded: ReadonlySet<string>;
  theme: Theme;
  lang: Language;
  status: LoadStatus;
  progress: LoadProgress | null;
  error: Error | null;
  notice: Notice | null;
}
