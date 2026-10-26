// The Circuits tab's state and commands (viewer/ui/panels/circuits.js:137-148, 259-302, 343-345): the
// refuse-while-busy run, the busy and failure state of the status line, the focus hand-off after a
// landmark opens, the lesson's Linked MRI entry. `CircuitList`, `CircuitStepper`, `CircuitProfile`,
// `CircuitNotes`, `CircuitStatus` and `RelatedCircuits` draw it.
import { tick } from 'svelte';
import { createBusyRunner } from '../../lib/core/async/latest.ts';
import type { RegionLabel } from '../../lib/core/catalog/labels.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { failureNotice } from '../../lib/core/i18n/errors.ts';
import type { CircuitCatalog } from '../../lib/core/learning/catalog.ts';
import type { Excursions } from '../../lib/controller/excursion.svelte.ts';
import type { ViewStore } from '../../lib/state/view.svelte.ts';
import { announce } from '../../lib/ui/announcer.svelte.ts';
import { scrollToTop } from '../../lib/ui/scroll.ts';
import { relatedLandmarks } from './circuits-view.ts';

export interface CircuitExplorerDeps {
  view: Pick<ViewStore, 'current'>;
  circuits: Pick<CircuitCatalog, 'all' | 'get' | 'reference' | 'revised'>;
  /** The S3 controller's members the tab calls (`createExcursions`). */
  excursions: Pick<
    Excursions,
    | 'openCircuit'
    | 'openLessonLandmark'
    | 'openLessonStep'
    | 'openLessonMri'
    | 'offerReload'
    | 'involved'
  >;
  /** A region's label under the display settings in force (its group is named under the landmark). */
  labelOf: (regionId: string) => RegionLabel;
  /** X2's entry point, which opens a deficit under its own runner. */
  openDeficit: (id: string) => unknown;
}

/** What the reader is told could not be done: `failureNotice`'s operation. */
type Operation = 'landmark' | 'mri';
export type Direction = 'previous' | 'next';

export function createCircuitExplorer(deps: CircuitExplorerDeps) {
  const { view, circuits, excursions } = deps;
  const runner = createBusyRunner();

  let busy = $state(false);
  let failure = $state.raw<{ error: unknown; operation: Operation } | null>(null);

  let list: HTMLElement | null = null;
  let profile: HTMLElement | null = null;
  let stepper: HTMLElement | null = null;
  let status: HTMLElement | null = null;

  const lesson = $derived(view.current.lesson);
  const circuit = $derived(lesson.circuit ? circuits.get(lesson.circuit) : null);
  const step = $derived(circuit ? circuit.steps[lesson.step]! : null);
  const exploring = $derived(view.current.explorer === 'circuits');
  const related = $derived.by(() => {
    const id = view.current.selectedRegion?.id;
    if (!id || exploring) return [];
    return relatedLandmarks(circuits.all, excursions.involved(id));
  });

  /**
   * A new landmark starts at the top. The stepper keeps focus so it can be pressed again; with
   * nothing to press the landmark's title takes it (circuits.js:281-289).
   */
  async function settle(direction: Direction | undefined) {
    // The controller has drawn the lesson; the hidden end of the stepper has left the page.
    await tick();
    // A newer scene command overtook the opening: no lesson was started, so there is nothing to focus.
    if (!exploring || !lesson.circuit) return;
    if (!profile) throw new Error('The lesson profile is not mounted.');
    scrollToTop(profile);
    const control =
      direction &&
      (stepper?.querySelector<HTMLElement>(`[data-step-direction="${direction}"]:not([hidden])`) ??
        stepper?.querySelector<HTMLElement>('[data-step-direction]:not([hidden])'));
    const target = control || profile.querySelector<HTMLElement>('[data-circuit-title]');
    if (!target) throw new Error('The lesson profile has no title to focus.');
    target.focus({ preventScroll: true });
  }

  /**
   * The step is said when the selection sentence will not be: a landmark on the region already
   * selected changes nothing the announcer speaks (deviations/x3-step-announcement.md).
   */
  function announceStep(regionBefore: string | undefined) {
    const { selectedRegion, lang, lesson: shown } = view.current;
    if (selectedRegion?.id === regionBefore && shown.circuit) {
      const { steps } = circuits.get(shown.circuit);
      announce(
        `${t(lang, 'circuits').step(shown.step, steps.length)}: ${steps[shown.step]!.name[lang]}`,
      );
    }
  }

  /** Runs `action` unless another run is in flight; false when it was refused or failed. */
  async function run(
    action: () => unknown,
    operation: Operation,
    landmark?: { direction?: Direction },
  ): Promise<boolean> {
    const regionBefore = view.current.selectedRegion?.id;
    const done = await runner.run(action, {
      onStart: () => {
        busy = true;
        failure = null;
      },
      onError: (error) => {
        failure = { error, operation };
        excursions.offerReload(error);
        // The failure is said where the reader is looking (circuits.js:299).
        if (exploring) void tick().then(() => status?.scrollIntoView({ block: 'nearest' }));
      },
      onSettled: () => {
        busy = false;
      },
    });
    if (done && landmark) {
      await settle(landmark.direction);
      announceStep(regionBefore);
    }
    return done;
  }

  return {
    get lang() {
      return view.current.lang;
    },
    /** The Circuits tab is in front. */
    get exploring() {
      return exploring;
    },
    get circuits() {
      return circuits.all;
    },
    get revised() {
      return circuits.revised;
    },
    reference: circuits.reference,
    /** The open lesson: the circuit, the landmark shown and the ones seen. */
    get lesson() {
      return lesson;
    },
    get circuit() {
      return circuit;
    },
    get step() {
      return step;
    },
    /**
     * Whether the selected region is the lesson's landmark (true), or the reader is exploring another
     * one (false); undefined without a lesson. I1 hands it to `RegionDetail`.
     */
    get landmarkSelected(): boolean | undefined {
      return step ? view.current.selectedRegion?.id === step.region : undefined;
    },
    get selectedRegion() {
      return view.current.selectedRegion;
    },
    /** The landmark's group, named under its title. */
    get group() {
      return step ? deps.labelOf(step.region).group : '';
    },
    /** The lessons through the selected region, outside the Circuits tab. */
    get related() {
      return related;
    },
    /** A run is in flight: every control refuses. */
    get busy() {
      return busy;
    },
    get failed() {
      return failure !== null;
    },
    /** What the status line says: work in progress, or the failure of the last run. */
    get status(): string {
      if (!exploring) return '';
      const { lang } = view.current;
      if (busy) return t(lang, 'circuits').loading;
      return failure ? failureNotice(failure.error, lang, failure.operation).text : '';
    },

    /** The `/` key: the first circuit takes focus. */
    focusFirst() {
      list?.querySelector<HTMLElement>('button')?.focus();
    },
    attachList(root: HTMLElement) {
      list = root;
      return () => {
        if (list === root) list = null;
      };
    },
    attachProfile(root: HTMLElement) {
      profile = root;
      return () => {
        if (profile === root) profile = null;
      };
    },
    attachStepper(root: HTMLElement) {
      stepper = root;
      return () => {
        if (stepper === root) stepper = null;
      };
    },
    attachStatus(root: HTMLElement) {
      status = root;
      return () => {
        if (status === root) status = null;
      };
    },

    /** A circuit opens on its first landmark. */
    openCircuit: (id: string) => run(() => excursions.openCircuit(id), 'landmark', {}),
    /** A lesson opens on one of its landmarks, from the lessons a region takes part in. */
    openLandmark: (id: string, index: number) =>
      run(() => excursions.openLessonLandmark(id, index), 'landmark', {}),
    /** The open lesson moves to another landmark; a stepper control passes its direction. */
    openStep: (index: number, direction?: Direction) =>
      run(() => excursions.openLessonStep(index), 'landmark', { direction }),
    /**
     * The entry point S3 takes as `panels.openMri` (decision 9 on #4): the lesson's Linked MRI under
     * this tab's busy run, with its progress and its failure text.
     */
    openMri: () => run(() => excursions.openLessonMri(), 'mri'),
    /** The clinical context's way into the deficit this circuit tests. */
    openDeficit(id: string) {
      if (busy) return;
      deps.openDeficit(id);
    },
  };
}

export type CircuitExplorer = ReturnType<typeof createCircuitExplorer>;
