import { createSpeech } from '../controller/speech.ts';
import type { CircuitSessionState } from '../core/learning/session.ts';
import type { ModelState, Region, SessionState } from '../types/index.ts';
import { announce } from '../ui/announcer.svelte.ts';
import type { EngineSync } from './engine-sync.svelte.ts';
import type { LessonStore, SessionStore } from './session.svelte.ts';

/** The one snapshot every panel reads: the model's state, the session's over it, and the lesson. */
export type View = ModelState &
  SessionState & {
    lesson: CircuitSessionState;
    /** The brain on screen. */
    anatomy: string;
    /** The anatomy the tracts belong to. */
    referenceAnatomy: string;
  };

export function createView({
  engine,
  session,
  lesson,
  anatomy,
  referenceAnatomy,
}: {
  engine: EngineSync;
  session: SessionStore;
  lesson: LessonStore;
  anatomy: string;
  referenceAnatomy: string;
}) {
  const view: View = $derived({
    ...engine.model,
    ...session.state,
    lesson: lesson.state,
    anatomy,
    referenceAnatomy,
  });
  return {
    get current() {
      return view;
    },
  };
}

export type ViewStore = ReturnType<typeof createView>;

/** Says the view's changes through the page's one announcer (app.js:1658-1693). */
export function announceView(view: ViewStore, regionName: (region: Region, view: View) => string) {
  const speech = createSpeech((region) => regionName(region, view.current));
  $effect(() => {
    for (const sentence of speech.next(view.current)) announce(sentence);
  });
}
