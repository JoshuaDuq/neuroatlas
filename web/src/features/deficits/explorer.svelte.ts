import { tick } from 'svelte';
import { createLatestRunner } from '../../lib/core/async/latest.ts';
import type { createCatalog } from '../../lib/core/catalog/catalog.ts';
import type { ClinicalCatalog } from '../../lib/core/clinical/catalog.ts';
import type { Excursions } from '../../lib/controller/excursion.svelte.ts';
import type { SessionStore } from '../../lib/state/session.svelte.ts';
import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
import { scrollToTop } from '../../lib/ui/scroll.ts';

/** What the Deficits panels reach outside the stores for; I1 composes them from the controller. */
export interface DeficitsDeps {
  clinical: ClinicalCatalog;
  anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
  /** The language and the open deficit key a failure to the profile it happened in. */
  session: Pick<SessionStore, 'state' | 'setClinicalQuery'>;
  /** The S3 controller's members the tab calls (`createExcursions`). */
  excursions: Pick<
    Excursions,
    | 'openDeficit'
    | 'openListedRegion'
    | 'restoreBeforeExcursion'
    | 'restorable'
    | 'offerReload'
    | 'searchIn'
    | 'involved'
    | 'checkedMaps'
    | 'functionsMatching'
  >;
  /** X1's entry point, which opens a function under its own runner. */
  openFunction: (id: string) => unknown;
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
  // A failure belongs to the profile it happened in: another deficit or language clears it (clinical.js:521-525).
  let lastFailure = $state.raw<{ profile: string; error: unknown } | null>(null);
  const profileKey = () => `${deps.session.state.lang}|${deps.session.state.selectedDeficit}`;
  const actionError = $derived(lastFailure?.profile === profileKey() ? lastFailure.error : null);

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
    lastFailure = null;
    const outcome = await runner.run(action, {
      onError(error) {
        lastFailure = { profile: profileKey(), error };
        deps.excursions.offerReload(error);
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
    const running = run(() => deps.excursions.openDeficit(id));
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
    if (!(await run(() => deps.excursions.openListedRegion(id), { failed: 'region' }))) return;
    if (requestFocus(FOCUS_TARGETS.regionTitle, { preventScroll: true })) {
      document.activeElement!.scrollIntoView({ block: 'start' });
    }
  }

  /** The profile closes with the excursion it opened, so focus returns to its row in the list. */
  async function restore(deficit: string): Promise<void> {
    if (opening) return;
    if (
      !(await run(() => deps.excursions.restoreBeforeExcursion(), {
        busyText: 'restoring',
        failureText: 'restoreFailed',
      }))
    ) {
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
    /** Whether the scene from before this excursion's first deficit can be put back. */
    get restorable() {
      return deps.excursions.restorable;
    },
    involved: deps.excursions.involved,
    checkedMaps: deps.excursions.checkedMaps,
    functionsMatching: deps.excursions.functionsMatching,
    setQuery: (query: string) => deps.session.setClinicalQuery(query),
    /** A search carried to the Functions tab. */
    searchFunctions: (query: string) => deps.excursions.searchIn('functions', query),
    openFunction: deps.openFunction,
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
