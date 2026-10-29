import type { CircuitCatalog, Landmark } from '../core/learning/catalog.ts';
import type { RevealSettings } from '../core/panels/clinical.ts';
import type { ReaderFailure, ReaderState } from '../core/state/reader-state.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { Engine, MoveOptions, MprPlane } from '../engine/api.ts';
import type { LessonStore, SessionStore } from '../state/session.svelte.ts';
import type { Explorer } from '../types/index.ts';
import { prepareCircuitMri, showCircuitLandmark } from './navigation/learning.ts';

/** Captures and puts back a whole scene (app.js:754-779), which the link restore owns. */
export interface SceneReader {
  capture(): ReaderState;
  apply(target: ReaderState, current: () => boolean): Promise<ReaderFailure[]>;
}

/** What the workspace and the phone sheet do when the controller opens a profile or a list. */
export interface Shell {
  /** The detail in front, and a phone's sheet raised over the stage (app.js:1557-1560). */
  showDetail(): void;
  /** The list in front, the sheet left where it is (workspace.showList). */
  showList(): void;
}

/** The linked MRI dialog (ui/chrome/sections.js:212-237, 585-592). */
export interface MriDialog {
  show(options: { instant: boolean }): void;
  /** Open the dialog on one plane, once the scan is loaded and `canOpen` still holds. */
  openPreparedPlane(plane: MprPlane, canOpen: () => boolean): Promise<void>;
}

/**
 * Guided lessons (app.js:1298-1411): a lesson opens over the scene it found, draws and frames its
 * landmarks, and puts the scene back when the reader leaves it. Under a lesson, a landmark's Linked
 * MRI opens the lesson's prepared plane ahead of the plain one.
 */
export function createLessons({
  engine,
  session,
  lesson,
  circuits,
  commands,
  reader,
  shell,
  mri,
  chooseExplorer,
  openMriPanel,
  render,
  stage,
}: {
  engine: Pick<Engine, 'model' | 'sections' | 'camera'>;
  session: Pick<SessionStore, 'state' | 'setView'>;
  lesson: LessonStore;
  circuits: Pick<CircuitCatalog, 'get' | 'contextMarginMm'>;
  commands: Pick<SceneCommands, 'begin' | 'openRegion' | 'prepareCut' | 'fail'>;
  reader: SceneReader;
  shell: Shell;
  mri: MriDialog;
  chooseExplorer: (value: Explorer) => void;
  /** The Circuits panel's entry to the lesson's MRI: its busy runner, which calls `openMri` (circuits.js:344). */
  openMriPanel: () => unknown;
  render: () => void;
  /** What a step does to the reader's own settings, said in the notice as a deficit's reveal says it. */
  stage: {
    settings: () => RevealSettings;
    /** Says what changed since `before`; false when nothing did. */
    sayChanged: (before: RevealSettings) => boolean;
    sayRestored: () => void;
  };
}) {
  const { model, sections, camera } = engine;
  // The scene before the open lesson, put back when the reader leaves it. Null for a lesson a link
  // opened on its landmark: that scene is the link's own.
  let beforeLesson: ReaderState | null = null;
  // A step of the open lesson said what it changed, so leaving it says the scene came back.
  let changesSaid = false;

  /** The lesson step whose landmark is the selection, while that lesson is the open circuit. */
  function lessonLandmark(): Landmark | null {
    const { circuit, step } = lesson.state;
    if (!circuit || session.state.explorer !== 'circuits') return null;
    const landmark = circuits.get(circuit).steps[step]!;
    return landmark.region === model.state.selectedRegion?.id ? landmark : null;
  }

  /** A landmark is framed as its lesson authored it: that view, with anatomical context around it. */
  function frameLandmark(step: Landmark, options: MoveOptions = {}): boolean {
    if (!camera.frameLandmark(step.region, step.view, circuits.contextMarginMm, options)) {
      return false;
    }
    session.setView(step.view);
    return true;
  }

  /** Draw, select and frame a lesson's landmark; false once a later command took over. */
  async function openLandmark(step: Landmark, current: () => boolean): Promise<boolean> {
    if (!(await commands.openRegion(step.region, current))) return false;
    showCircuitLandmark(model, step);
    if (!frameLandmark(step)) throw new Error(`Landmark geometry unavailable: ${step.region}`);
    return true;
  }

  /** A lesson's landmark opened as a step the reader took, saying what it changed on the stage. */
  async function stepTo(step: Landmark, current: () => boolean): Promise<boolean> {
    const before = stage.settings();
    if (!(await openLandmark(step, current))) return false;
    if (stage.sayChanged(before)) changesSaid = true;
    return true;
  }

  /** The scene a lesson opens over, unless one is already open and holds it. */
  function rememberBeforeLesson() {
    if (lesson.state.circuit) return;
    beforeLesson = reader.capture();
    changesSaid = false;
  }

  /**
   * Leaving a lesson, back to the list or to another tab, ends it and puts back the scene from before
   * it, as a deficit's Restore does. The list stays in front: a restored selection is not a new choice.
   */
  async function leave() {
    if (!lesson.state.circuit || session.state.explorer !== 'circuits') return;
    const before = beforeLesson;
    const said = changesSaid;
    beforeLesson = null;
    changesSaid = false;
    lesson.close();
    render();
    if (!before) return;
    const current = commands.begin();
    const failures = await reader.apply(before, current);
    if (!current()) return;
    shell.showList();
    if (failures.length) {
      commands.fail(
        'restore',
        new AggregateError(
          failures.map(({ error }) => error),
          'The scene from before the lesson was not fully restored.',
        ),
      );
    } else if (said) {
      stage.sayRestored();
    }
    render();
  }

  /** The prepared plane of the lesson's open landmark, centred on this individual's own landmark. */
  async function openLessonMri() {
    const current = commands.begin();
    const { circuit, step: index } = lesson.state;
    const step = circuits.get(circuit!).steps[index]!;
    const canOpen = () => {
      const shown = lesson.state;
      return (
        current() &&
        session.state.explorer === 'circuits' &&
        shown.circuit === circuit &&
        shown.step === index
      );
    };
    await openLandmark(step, current);
    if (!canOpen()) return;
    await commands.prepareCut(current);
    if (!canOpen()) return;
    await prepareCircuitMri(model, sections, step);
    if (!canOpen()) return;
    const faced = camera.faceCut();
    if (faced) {
      session.setView(faced);
      render();
    }
    await mri.openPreparedPlane(step.plane, canOpen);
    render();
  }

  return {
    lessonLandmark,
    openLandmark,
    leave,
    openMri: openLessonMri,

    /**
     * Focus the selection as the open lesson authored it (app.js:510-512): its view, with anatomical
     * context. False when no lesson landmark is selected or it has no drawn mesh, so the caller frames
     * the region as it would any other.
     */
    focusLandmark(options: MoveOptions = {}): boolean {
      const step = lessonLandmark();
      if (!step || !frameLandmark(step, options)) return false;
      render();
      return true;
    },

    /** The scene a lesson holds for its landmark, taken: an excursion that ends the lesson keeps it. */
    takeBeforeLesson(): ReaderState | null {
      const before = beforeLesson;
      beforeLesson = null;
      changesSaid = false;
      return before;
    },

    /** A link that opens a lesson on its landmark holds the scene it found, to return to on leaving. */
    holdBeforeLesson() {
      beforeLesson = reader.capture();
    },

    /** The link's scene is the new baseline: nothing from before is held. */
    forgetBeforeLesson() {
      beforeLesson = null;
    },

    /** A circuit opens on its first landmark. */
    async openCircuit(id: string) {
      const current = commands.begin();
      const circuit = circuits.get(id);
      rememberBeforeLesson();
      shell.showDetail();
      if (!(await stepTo(circuit.steps[0]!, current))) return;
      lesson.start(id);
      render();
    },

    /** A lesson opens on one of its landmarks, from another panel's list of related lessons. */
    async openLandmarkOf(id: string, index: number) {
      const current = commands.begin();
      rememberBeforeLesson();
      chooseExplorer('circuits');
      shell.showDetail();
      if (!(await stepTo(circuits.get(id).steps[index]!, current))) return;
      lesson.start(id);
      lesson.go(index);
      render();
    },

    /** The open lesson moves to another landmark. */
    async openStep(index: number) {
      const current = commands.begin();
      const { circuit } = lesson.state;
      const step = circuits.get(circuit!).steps[index];
      if (!step) throw new RangeError(`Invalid landmark index: ${index}`);
      if (!(await stepTo(step, current))) return;
      lesson.go(index);
      render();
      if (session.state.explorer === 'circuits') shell.showDetail();
    },

    /**
     * The Linked MRI. A region's own button (`atRegion`) centres it on that region; under a lesson,
     * on the lesson's landmark, in the plane the lesson authored (app.js:1406-1411).
     */
    async openLinkedMri({ atRegion = false, instant = false } = {}) {
      if (atRegion && lessonLandmark()) {
        openMriPanel();
        return;
      }
      const region = model.state.selectedRegion;
      const centroid = region && model.centroidOf(region.id);
      if (centroid) {
        const [x, y, z] = sections.state.crosshair;
        // Not at a region: only a crosshair still at the origin moves to the selection.
        if (atRegion || (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3 && Math.abs(z) < 1e-3)) {
          sections.setCrosshair(centroid);
        }
      }
      await sections.load();
      mri.show({ instant });
    },
  };
}
