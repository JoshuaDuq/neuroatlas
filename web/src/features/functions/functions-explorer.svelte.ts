// The Functions tab's state and commands (viewer/ui/panels/functions.js:97-168, 320-335, 384-390):
// the latest-wins run, the busy and failure state of the profile's meta line, the open and restore
// hand-offs. `FunctionList`, `FunctionProfile` and `FunctionRestore` draw it.
import { tick } from 'svelte';
import { createLatestRunner } from '../../lib/core/async/latest.ts';
import type { createCatalog } from '../../lib/core/catalog/catalog.ts';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import { ALL_DOMAINS, type NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { stageMessage } from '../../lib/core/panels/clinical.ts';
import type { Excursions } from '../../lib/controller/excursion.svelte.ts';
import type { SessionStore } from '../../lib/state/session.svelte.ts';
import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
import { scrollToTop } from '../../lib/ui/scroll.ts';
import { areaCount } from './functions-view.ts';

export interface FunctionExplorerDeps {
  session: Pick<SessionStore, 'state' | 'setFunctionQuery'>;
  /** The S3 controller's members the tab calls (`createExcursions`). */
  excursions: Pick<
    Excursions,
    | 'openFunction'
    | 'openListedRegion'
    | 'restoreBeforeExcursion'
    | 'restorable'
    | 'offerReload'
    | 'searchIn'
    | 'deficitsMatching'
  >;
  domains: NeuropsychDomains;
  anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
  functionalRegions: FunctionalRegions | null;
  /** X2's entry point, which opens a deficit under its own runner. */
  openDeficit: (id: string) => unknown;
}

/** The legacy run options: which busy and failure sentence, and which operation a bare failure names. */
type Run = {
  busy: 'loading' | 'restoring';
  failure: 'failed' | 'restoreFailed' | null;
  operation: 'colour' | 'region';
};

const OPEN: Run = { busy: 'loading', failure: 'failed', operation: 'colour' };
const OPEN_AREA: Run = { busy: 'loading', failure: null, operation: 'region' };
const RESTORE: Run = { busy: 'restoring', failure: 'restoreFailed', operation: 'colour' };

export function createFunctionExplorer(deps: FunctionExplorerDeps) {
  const { session, excursions, domains } = deps;
  const runner = createLatestRunner();

  let opening = $state(false);
  let run = $state<Run>(OPEN);
  // A failure belongs to the profile it happened in: another function or language clears it.
  let failed = $state.raw<{ profile: string; error: unknown } | null>(null);

  let search: HTMLInputElement | null = null;
  let profile: HTMLElement | null = null;
  let list: HTMLElement | null = null;

  /** The open function's id, in the Functions tab. */
  const selected = (): string | null =>
    session.state.explorer === 'functions' ? session.state.selectedFunction : null;
  const profileKey = () => `${session.state.lang}|${session.state.selectedFunction}`;
  const error = $derived(failed?.profile === profileKey() ? failed.error : null);

  /** Starts a run, which overtakes any earlier one: only the latest speaks. */
  function start<T>(options: Run, action: () => Promise<T> | T) {
    opening = true;
    run = options;
    failed = null;
    return runner.run(action, {
      onError: (cause) => {
        failed = { profile: profileKey(), error: cause };
        excursions.offerReload(cause);
      },
      onSettled: () => {
        opening = false;
      },
    });
  }

  /** The profile's name takes focus once it opens. */
  function focusTitle() {
    const title = profile?.querySelector<HTMLElement>('[data-function-title]');
    if (!title) throw new Error('The function profile has no title to focus.');
    title.focus({ preventScroll: true });
  }

  return {
    get query() {
      return session.state.functionQuery;
    },
    get lang() {
      return session.state.lang;
    },
    /** The Functions tab is in front. */
    get exploring() {
      return session.state.explorer === 'functions';
    },
    get selected() {
      return selected();
    },
    /** A run is in flight: areas and Restore turn the reader away. */
    get opening() {
      return opening;
    },
    /** Whether the scene from before this excursion can be put back. */
    get restorable() {
      return excursions.restorable;
    },
    /** The profile's meta line: work in progress, a failure, or what the stage shows. */
    get meta(): string {
      const id = selected();
      if (!id) return '';
      const { lang } = session.state;
      const copy = t(lang, 'functions');
      const text = { ...t(lang, 'clinical'), loading: copy.loading, failed: copy.failed };
      return stageMessage(text, {
        opening,
        busy: run.busy,
        error,
        failure: run.failure,
        operation: run.operation,
        lang,
        status: id === ALL_DOMAINS ? copy.shown : areaCount(domains, id, lang),
      });
    },
    get failed() {
      return Boolean(error);
    },
    domains,
    anatomy: deps.anatomy,
    functionalRegions: deps.functionalRegions,
    deficitsMatching: excursions.deficitsMatching,

    setQuery: (query: string) => session.setFunctionQuery(query),
    /** A search carried to the Deficits tab. */
    searchDeficits: (query: string) => excursions.searchIn('deficits', query),
    openDeficit: deps.openDeficit,

    /** The field takes focus with its text selected (the `/` key). */
    focusSearch() {
      search?.focus();
      search?.select();
    },
    attachSearch(input: HTMLInputElement, listRoot: HTMLElement) {
      search = input;
      list = listRoot;
      return () => {
        if (search === input) search = null;
        if (list === listRoot) list = null;
      };
    },
    attachProfile(root: HTMLElement) {
      profile = root;
      return () => {
        if (profile === root) profile = null;
      };
    },

    /**
     * Opens a function: the S3 controller draws it and downloads what it needs, the profile starts
     * at its top and its name takes focus at once (functions.js:157). The entry point S3 takes as
     * `panels.openFunction`; `chooseMode` and a paint pick call it too.
     */
    async openFunction(id: string): Promise<boolean> {
      const outcome = await start(OPEN, async () => {
        const preparing = excursions.openFunction(id);
        // The controller rendered the profile; a re-selected function has its heading already.
        await tick();
        if (!profile) throw new Error('The function profile is not mounted.');
        scrollToTop(profile);
        focusTitle();
        return preparing;
      });
      return outcome.ok && outcome.value !== false;
    },

    /** An area the profile names: drawn, selected and framed; its name then takes focus. */
    async openArea(region: string): Promise<void> {
      if (opening) return;
      const outcome = await start(OPEN_AREA, () => excursions.openListedRegion(region));
      if (outcome.ok && outcome.value !== false) requestFocus(FOCUS_TARGETS.regionTitle);
    },

    /** The profile closes with the excursion it opened, so focus returns to its row in the list. */
    async restore(): Promise<void> {
      if (opening) return;
      const id = session.state.selectedFunction;
      const outcome = await start(RESTORE, () => excursions.restoreBeforeExcursion());
      if (!outcome.ok || outcome.value === false) return;
      // The workspace has returned to the list by the time the page has settled.
      await tick();
      const row = id && list?.querySelector<HTMLElement>(`[data-function="${CSS.escape(id)}"]`);
      (row || search)?.focus();
    },
  };
}

export type FunctionExplorer = ReturnType<typeof createFunctionExplorer>;
