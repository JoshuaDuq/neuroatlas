import type { Engine } from '../engine/api.ts';
import type { CatalogStore } from '../state/catalog.svelte.ts';
import type { EngineSync } from '../state/engine-sync.svelte.ts';
import type { LinkStore } from '../state/link.svelte.ts';
import type { LessonStore, SessionStore } from '../state/session.svelte.ts';
import type { ViewStore } from '../state/view.svelte.ts';

/** What every controller is given: the engine, and the stores that mirror it and the reader's session. */
export interface AppContext {
  engine: Engine;
  /** The engine's display state, copied at each `change`. */
  engineState: EngineSync;
  session: SessionStore;
  lesson: LessonStore;
  /** `{ ...engineState.model, ...session.state, lesson, anatomy, referenceAnatomy }`. */
  view: ViewStore;
  catalog: CatalogStore;
  link: LinkStore;
}
