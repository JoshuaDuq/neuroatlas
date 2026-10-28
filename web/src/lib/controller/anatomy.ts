import { tick } from 'svelte';
import { visibilityOf } from '../core/catalog/visibility.ts';
import type { HiddenReason } from '../core/catalog/visibility.ts';
import { atlasSwitchLabel, t } from '../core/i18n/index.ts';
import {
  captureBeforeInternal,
  insideInternal,
  leaveInternal,
} from '../core/state/internal-mode.ts';
import type { InternalEntry } from '../core/state/internal-mode.ts';
import { publishesSpinalCord } from '../core/state/scene-commands.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { MoveOptions, Vec3 } from '../engine/api.ts';
import type { Explorer } from '../types/index.ts';
import { FOCUS_TARGETS, requestFocus, rescueFocus } from '../ui/focus.ts';
import type { AppContext } from './context.ts';

/** What choosing a region does to the interface around the stage (app.js:526-532, 718-720). */
export interface SelectionInterface {
  /** The workspace shows the region's detail tab. */
  showDetail(): void;
  /** The phone sheet rises to show it. */
  revealOnSelect(): void;
  dismissHelp(): void;
  /** The workspace shows the explorer's list. */
  showList(): void;
}

/**
 * The selection, the dissection and the display commands over the engine and the stores. `commands`
 * is the scene commands, shared with the masthead so one intent token orders them all.
 */
export function createAnatomyCommands(
  { engine, engineState, session, view, catalog }: AppContext,
  {
    commands,
    ui,
    chooseExplorer,
    frameLandmark,
  }: {
    commands: SceneCommands;
    ui: SelectionInterface;
    chooseExplorer: (explorer: Explorer) => void;
    /** Frame the open lesson's landmark as its lesson authored it; false when none is open or it has no drawn mesh. */
    frameLandmark: (options: MoveOptions) => boolean;
  },
) {
  const { model, sections, camera } = engine;
  const hasSpinalCord = publishesSpinalCord(model.manifest);
  // Taken at each of the two doors into internal anatomy, and spent on the way out.
  let beforeInternal: InternalEntry | null = null;

  /** Open the tree branch that holds a region, so a selection is never out of sight. */
  function revealInTree(id: string) {
    const group = catalog.groups.find((entry) => entry.rows.some((row) => row.region.id === id));
    if (group && !view.current.expanded.has(group.key)) session.toggleGroup(group.key);
  }

  /** Frame the selected region from where the camera already is (app.js:516-524). */
  function focusSelection({ immediate = false }: MoveOptions = {}) {
    if (frameLandmark({ immediate })) return;
    const id = engineState.model.selectedRegion?.id;
    if (id) camera.frameRegion(id, { immediate });
  }

  /**
   * Choose a region, or none. Choosing the one already selected is also a request to read it. The
   * camera moves only for a new pick from the navigator (`frame`): a click on the model is already
   * where the reader is looking, and moving the camera would throw away the orbit they just made.
   */
  function selectRegion(id: string | null, { frame = false }: { frame?: boolean } = {}) {
    const same = id !== null && id === engineState.model.selectedRegion?.id;
    model.select(id);
    if (id === null) return;
    revealInTree(id);
    ui.showDetail();
    ui.revealOnSelect();
    ui.dismissHelp();
    if (frame && !same) focusSelection();
  }

  /** Clear the selection; a control that hid itself with it must not leave focus on the page. */
  async function clearSelection(): Promise<boolean> {
    selectRegion(null);
    await tick();
    return rescueFocus(FOCUS_TARGETS.activeTab);
  }

  function notifyClearedSelection(had: { id: string } | null) {
    if (had && !engineState.model.selectedRegion) {
      const name = catalog.label(had.id).name;
      session.notify({ text: t(session.state.lang, 'app').selectionCleared(name) });
    }
  }

  /** Apply a display change, and say so if it silently dropped the selection (app.js:221-229). */
  function display(change: () => void) {
    const had = engineState.model.selectedRegion;
    // A display change is the reader's next action, which a standing notice lasts until.
    session.notify(null);
    change();
    notifyClearedSelection(had);
  }

  const hideRegions = (ids: readonly string[]) => display(() => model.hideRegions(ids));
  const showRegions = (ids: readonly string[]) => display(() => model.showRegions(ids));
  const undoDissection = () => display(() => model.undoDissection());
  const restoreHiddenRegions = () => display(() => model.restoreHiddenRegions());

  const isolateSelection = () =>
    display(() => {
      if (engineState.model.isolatedRegion) {
        model.clearIsolation();
        camera.frameWhole();
      } else {
        model.isolate();
        focusSelection();
      }
    });

  /**
   * The inspector's Hide: hand the selection to the dissection and put focus on its Undo, which the
   * selection's own controls no longer offer. False when focus could not be placed.
   */
  async function hideSelection(): Promise<boolean> {
    const id = engineState.model.selectedRegion?.id;
    if (!id) return false;
    chooseExplorer('anatomy');
    hideRegions([id]);
    ui.showList();
    await tick();
    return requestFocus(FOCUS_TARGETS.dissectionUndo, { fallback: FOCUS_TARGETS.treeStop });
  }

  /** Where a plane with this normal must sit to pass through a point, clamped to the cut's range. */
  function offsetThrough(point: Vec3, normal: Vec3, [minimum, maximum]: readonly [number, number]) {
    const offset = point[0] * normal[0] + point[1] * normal[1] + point[2] * normal[2];
    if (![offset, minimum, maximum].every(Number.isFinite)) {
      throw new Error('A cut through a point needs finite coordinates and a finite range.');
    }
    return Math.min(maximum, Math.max(minimum, offset));
  }

  /** Undo whatever is hiding a region, then select it; false once a later command took over. */
  async function reveal(
    reason: HiddenReason,
    id: string,
    current: () => boolean,
  ): Promise<boolean> {
    if (reason === 'removed') model.showRegions([id]);
    if (reason === 'no-mri') await commands.applySurfaceColor('tissue', current);
    if (reason === 'cortex-hidden') {
      model.setCortexVisible(true);
      model.setCortexOpacity(1);
    }
    if (reason === 'internal-hidden') model.setInternalVisible(true);
    if (reason === 'spinal-cord-hidden') await commands.showSpinalCord(true, current);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    // A cut-only region is nowhere until a plane exists. Coronal is the
    // conventional default, and the panel moves it from there.
    if (reason === 'no-cut') {
      await commands.cut('coronal', current);
      const coordinates = model.centroidOf(id);
      if (current() && coordinates && sections.active) {
        sections.setOffset(offsetThrough(coordinates, sections.frame.normal, sections.offsetRange));
      }
    }
    if (reason === 'other-detail')
      await commands.loadDetail(model.regions.get(id)!.atlas!, current);
    if (reason === 'other-system') model.setInternalSystem(null);
    if (!current()) return false;
    const region = model.regions.get(id)!;
    if (!model.canSelect(region)) {
      const next = visibilityOf(region, model.settings).reason;
      if (next === reason) throw new Error(`Cannot reveal ${id}: ${next}`);
      return reveal(next!, id, current);
    }
    selectRegion(id);
    return true;
  }

  /** The navigator's way to show a region that is not on screen, and frame it once it is. */
  async function revealRegion(reason: HiddenReason, id: string) {
    const current = commands.begin();
    try {
      if ((await reveal(reason, id, current)) && id) focusSelection();
    } catch (error) {
      commands.failIfCurrent(current, 'region', error);
    }
  }

  /** A constituent of an overview structure: show it with its own layers, then frame it. */
  async function openConstituent(id: string) {
    const current = commands.begin();
    try {
      model.setInternalSystem(null);
      if (await commands.openRegion(id, current)) focusSelection();
    } catch (error) {
      commands.failIfCurrent(current, 'region', error);
    }
  }

  async function enterInternal() {
    const current = commands.begin();
    beforeInternal = captureBeforeInternal(model.settings, model.defaultDetail);
    session.setQuery('');
    try {
      await sections.setMode('off');
      if (!current()) return;
      await commands.loadDetail(model.defaultDetail, current);
      if (!current()) return;
    } catch (error) {
      commands.failIfCurrent(current, 'internal', error);
      return;
    }
    model.setInternalSystem(null);
    model.setCortexVisible(false);
    model.setSurfaceColor('atlas');
    camera.frameInternal();
  }

  async function leaveInternalAnatomy() {
    const current = commands.begin();
    const changes = leaveInternal(beforeInternal, model.settings, {
      'cab-np': model.cabNp?.atlas,
    });
    beforeInternal = null;
    session.setQuery('');
    // Both setters release isolation, which would otherwise hold the cortex
    // hidden behind whichever single structure the reader had isolated.
    model.setInternalSystem(changes.internalSystem);
    model.setCortexVisible(changes.cortexVisible);
    try {
      await commands.applySurfaceColor(changes.surfaceColor, current);
      if (current() && changes.detail) await commands.loadDetail(changes.detail, current);
    } catch (error) {
      commands.failIfCurrent(current, 'wholeBrain', error);
    }
    if (!current()) return;
    if (changes.colourLost) {
      const { lang } = session.state;
      session.notify({
        text: t(lang, 'app').cabNpAtlasOnly(atlasSwitchLabel(model.settings.atlas, lang)),
      });
    }
    camera.frameWhole();
  }

  const toggleInternalAnatomy = () =>
    insideInternal(model.settings) ? leaveInternalAnatomy() : enterInternal();

  /** Show one internal system (null: all of them), entering internal anatomy by this second door. */
  async function chooseInternalSystem(system: string | null) {
    const current = commands.begin();
    try {
      if (system === 'Spinal cord' && !(await commands.showSpinalCord(true, current))) return;
      // The other door in must clear the cortex's network legend as well.
      if (!insideInternal(model.settings)) {
        beforeInternal = captureBeforeInternal(model.settings, model.settings.detail);
        model.setSurfaceColor('atlas');
        model.setCortexVisible(false);
      }
      model.setInternalSystem(system);
      session.setQuery('');
      const group = catalog.groups.find((entry) => entry.kind === 'structure');
      if (system && group && !view.current.expanded.has(group.key)) session.toggleGroup(group.key);
      camera.frameInternal();
    } catch (error) {
      commands.failIfCurrent(current, 'system', error);
    }
  }

  async function setSpinalCordVisible(visible: boolean) {
    if (!hasSpinalCord) {
      session.notify({ text: t(session.state.lang, 'display').spinalCordUnavailable });
      return;
    }
    const current = commands.begin();
    const had = engineState.model.selectedRegion;
    try {
      if (!(await commands.showSpinalCord(visible, current))) return;
      notifyClearedSelection(had);
      camera.frameWhole();
    } catch (error) {
      commands.failIfCurrent(current, 'cord', error);
    }
  }

  /**
   * The opening picture: display, cut, camera, and the list. Not wrapped in `display`, which would
   * announce the cleared selection as a mishap. A command still loading would land over it, so it is
   * overtaken.
   */
  function reset() {
    commands.begin();
    session.setQuery('');
    void sections.setMode('off');
    model.reset();
    camera.recenter();
    if (!session.setView('oblique')) throw new Error('Unknown view: oblique');
    camera.applyView('oblique');
  }

  return {
    selectRegion,
    clearSelection,
    focusSelection,
    isolateSelection,
    hideSelection,
    hideRegions,
    showRegions,
    undoDissection,
    restoreHiddenRegions,
    revealRegion,
    openConstituent,
    toggleInternalAnatomy,
    chooseInternalSystem,
    setHemisphere: (value: Parameters<typeof model.setHemisphere>[0]) =>
      display(() => {
        model.setHemisphere(value);
        camera.frameWhole();
      }),
    setCortexVisible: (value: boolean) => display(() => model.setCortexVisible(value)),
    setCortexOpacity: (value: number) => display(() => model.setCortexOpacity(value)),
    setInternalVisible: (value: boolean) => display(() => model.setInternalVisible(value)),
    setSpinalCordVisible,
    reset,
  };
}

export type AnatomyCommands = ReturnType<typeof createAnatomyCommands>;
