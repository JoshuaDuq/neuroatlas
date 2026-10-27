import { flushSync, getContext } from 'svelte';
import type { AnatomyCommands } from '../lib/controller/anatomy.ts';
import type { AppContext } from '../lib/controller/context.ts';
import type { Excursions } from '../lib/controller/excursion.svelte.ts';
import type { Links } from '../lib/controller/links.ts';
import type { createCatalog } from '../lib/core/catalog/catalog.ts';
import type { ClinicalCatalog } from '../lib/core/clinical/catalog.ts';
import type { CircuitCatalog } from '../lib/core/learning/catalog.ts';
import type { SceneCommands } from '../lib/core/state/scene-commands.ts';
import { MINIMUM_LENGTH } from '../lib/core/tracts.ts';
import { decodeState } from '../lib/core/state/url-state.ts';
import { VIEW_DIRECTIONS } from '../lib/engine/render/camera-views.ts';
import { createLanguage } from '../lib/state/language.svelte.ts';
import { createMedia } from '../lib/state/media.svelte.ts';
import { createKeyPreference } from '../lib/state/prefs.ts';
import { createSessionStore } from '../lib/state/session.svelte.ts';
import { createStageLayout } from '../lib/state/stage-layout.svelte.ts';
import { createTheme } from '../lib/state/theme.svelte.ts';
import type { Language } from '../lib/types/index.ts';
import type { announceView } from '../lib/state/view.svelte.ts';
import { createPorts } from './ports.ts';

/** What the page is told when the start fails: `startFailure`'s text, or a capability error's alone. */
export interface StartFailure {
  text: string;
  button?: string;
  dropLink?: boolean;
}

/**
 * Everything that exists once the engine does: the stores over it, and the controllers, each built
 * once and shared by every region. `AppContext` is what a controller is given.
 */
export interface World extends AppContext {
  /** The anatomy catalog, as the language and settings it shows. */
  regions: ReturnType<typeof createCatalog>;
  clinical: ClinicalCatalog;
  circuits: CircuitCatalog;
  /** The one scene-command instance: its intent counter orders every command that waits on a download. */
  commands: SceneCommands;
  anatomy: AnatomyCommands;
  excursions: Excursions;
  links: Links;
  /** The live announcer: an eye press hands it the part sentence after its command. */
  speech: ReturnType<typeof announceView>;
}

/** Runs `build` where `$effect`s may be created and settles them, as a component's setup would. */
export function effectRoot<T>(build: () => T): { value: T; stop: () => void } {
  let value!: T;
  const stop = $effect.root(() => {
    value = build();
  });
  flushSync();
  return { value, stop };
}

/**
 * The page's state that exists before the engine does (the language, the theme, the session with
 * the download's progress and a failed start) and, once the engine has loaded, the `world`. Regions
 * read it from the context `mount` is given, and render what needs the engine under `world`.
 */
export function createApp() {
  const language = createLanguage(decodeState(location.hash).state.lang);
  const session = createSessionStore({
    views: Object.keys(VIEW_DIRECTIONS),
    lang: language.current,
  });
  let world = $state.raw<World | null>(null);
  let failure = $state.raw<StartFailure | undefined>();
  // The Tracts panel's length filter, which the stage's MRI navigator draws with.
  let tractsMinimum = $state<number>(MINIMUM_LENGTH.min);
  const cleanups: (() => unknown)[] = [];

  const theme = createTheme((current) => {
    session.setTheme(current);
    world?.engine.applyTheme(current);
  });
  const media = createMedia();
  const { ports, register } = createPorts();
  const stage = createStageLayout({ media, onDock: () => world?.engine.camera.refitDock() });
  cleanups.push(theme.dispose);

  return {
    language,
    theme,
    keyPreference: createKeyPreference(),
    session,
    media,
    stage,
    ports,
    registerPorts: register,

    /** The settings menu's choice: shown, announced and remembered. */
    chooseLanguage(next: Language) {
      language.set(next);
      session.setLang(next);
    },

    get tractsMinimum() {
      return tractsMinimum;
    },
    set tractsMinimum(minimum: number) {
      tractsMinimum = minimum;
    },

    get world() {
      return world;
    },
    /** Set once the engine has loaded; the regions that need it render from here. */
    attach(next: World) {
      world = next;
      // Before the engine goes, so the regions that draw from it unmount first.
      cleanups.push(() => {
        world = null;
        flushSync();
      });
    },

    get failure() {
      return failure;
    },
    /** The stage says why the start failed, in the reader's language. */
    fail(error: Error, shown: StartFailure) {
      session.setError(error);
      failure = shown;
    },

    /** Runs when the app is disposed, most recent first. */
    defer(...later: (() => unknown)[]) {
      cleanups.push(...later);
    },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    },
  };
}

export type App = ReturnType<typeof createApp>;

/** The context key the app is mounted under. */
export const APP = Symbol('planum.app');

/** The app, from inside a mounted component. */
export const getApp = (): App => getContext<App>(APP);
