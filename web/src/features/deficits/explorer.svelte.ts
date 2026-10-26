import { tick } from 'svelte';
import { createLatestRunner } from '../../lib/core/async/latest.ts';
import type { createCatalog } from '../../lib/core/catalog/catalog.ts';
import type { ClinicalCatalog } from '../../lib/core/clinical/catalog.ts';
import type { Language, Rgb } from '../../lib/types/index.ts';
import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
import { scrollToTop } from '../../lib/ui/scroll.ts';

/** What the Deficits panels reach outside the stores for; I1 composes them from the controller. */
export interface DeficitsDeps {
  clinical: ClinicalCatalog;
  anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
  /** The regions a selection shares anatomy with (`involved` of the excursion controller). */
  involved: (id: string) => ReadonlySet<string>;
  /** The curated functions whose lesion checks cite one of a deficit's associations. */
  checkedMaps: (deficit: string, lang: Language) => { id: string; name: string; color: Rgb }[];
  /** How many activation maps the Functions tab finds for the same words. */
  functionsMatching: (query: string, lang: Language) => number;
  onQuery: (query: string) => void;
  /** `excursions.openDeficit`: false when a later command overtook it. */
  onDeficit: (id: string) => Promise<boolean>;
  /** `excursions.openListedRegion`. */
  onRegion: (id: string) => Promise<boolean>;
  /** The Functions explorer's entry point. */
  onFunction: (id: string) => unknown;
  /** `excursions.searchIn('functions', query)`. */
  onSearchFunctions: (query: string) => unknown;
  /** `excursions.restoreBeforeExcursion`. */
  onRestore: () => Promise<boolean>;
  /** `excursions.offerReload`: hears each failure the meta line reports. */
  onFailure: (error: unknown) => void;
  /** `registerCurrentItem` of `lib/core/workspace.ts`: how the workspace finds the open deficit's row. */
  registerCurrentItem: (find: () => HTMLElement | null) => () => void;
}

type Busy = 'loading' | 'restoring';
type Failure = 'restoreFailed';
type Operation = 'deficit' | 'region';

/**
 * The Deficits explorer's one runner (clinical.js:224-330), shared by the list, the profile, Restore
 * and the region inspector's related list. A later open overtakes an earlier one; only the latest
 * reports (`createLatestRunner`).
 */
export function createDeficitsExplorer(deps: DeficitsDeps) {
  const runner = createLatestRunner();
  /** The elements the controller moves focus to; the components bind them. */
  const refs: {
    heading: HTMLElement | null;
    search: HTMLInputElement | null;
    list: HTMLElement | null;
  } = { heading: null, search: null, list: null };

  let opening = $state(false);
  let busy = $state<Busy>('loading');
  let failure = $state<Failure | null>(null);
  let operation = $state<Operation>('deficit');
  let actionError = $state.raw<unknown>(null);

  /**
   * Runs `action` as the one latest run. False when it failed, or reported that a later command
   * overtook it ("did not do what it says"), so the caller does not follow it with its hand-off.
   */
  async function run(
    action: () => Promise<unknown> | unknown,
    {
      busyText = 'loading',
      failureText = null,
      failed = 'deficit',
    }: { busyText?: Busy; failureText?: Failure | null; failed?: Operation } = {},
  ): Promise<boolean> {
    opening = true;
    busy = busyText;
    failure = failureText;
    operation = failed;
    actionError = null;
    const outcome = await runner.run(action, {
      onError(error) {
        actionError = error;
        deps.onFailure(error);
      },
      onSettled() {
        opening = false;
      },
    });
    return outcome.ok && outcome.value !== false;
  }

  /**
   * The panels' entry point (`openDeficit(id): unknown`, S3's `deps.panels`). The profile renders at
   * once and the brain is prepared behind it; once the profile for `id` is in the page it starts at
   * its top and its heading takes focus (deviation x2-focus-after-render).
   */
  async function openDeficit(id: string): Promise<void> {
    const running = run(() => deps.onDeficit(id));
    await tick();
    const { heading } = refs;
    if (heading?.dataset.deficit === id) {
      scrollToTop(heading);
      heading.focus({ preventScroll: true });
    }
    await running;
  }

  /** A region opened from a profile is detailed below it: brought into view, its name takes focus. */
  async function openRegion(id: string): Promise<void> {
    if (opening) return;
    if (!(await run(() => deps.onRegion(id), { failed: 'region' }))) return;
    if (requestFocus(FOCUS_TARGETS.regionTitle, { preventScroll: true })) {
      document.activeElement!.scrollIntoView({ block: 'start' });
    }
  }

  /** The profile closes with the excursion it opened, so focus returns to its row in the list. */
  async function restore(deficit: string): Promise<void> {
    if (opening) return;
    if (!(await run(deps.onRestore, { busyText: 'restoring', failureText: 'restoreFailed' }))) {
      return;
    }
    await tick();
    const row = refs.list?.querySelector<HTMLElement>(
      `[data-deficit="${CSS.escape(deficit)}"] .row`,
    );
    (row ?? refs.search)?.focus();
  }

  return {
    refs,
    deps,
    get opening() {
      return opening;
    },
    get busy() {
      return busy;
    },
    get failure() {
      return failure;
    },
    get operation() {
      return operation;
    },
    get actionError() {
      return actionError;
    },
    openDeficit,
    openRegion,
    restore,
    focusSearch() {
      refs.search?.focus();
      refs.search?.select();
    },
  };
}

export type DeficitsExplorer = ReturnType<typeof createDeficitsExplorer>;
