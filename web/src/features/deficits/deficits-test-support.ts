import type { View } from '../../lib/state/view.svelte.ts';
import type { DeficitsExplorer } from './explorer.svelte.ts';

/** What the fixture hands the test once it is mounted. */
export interface Fixture {
  view: View;
  explorer: DeficitsExplorer;
  calls: string[];
  /** The finders `registerCurrentItem` received. */
  finders: Set<() => HTMLElement | null>;
}
