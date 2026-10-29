import type { createCatalog } from '../core/catalog/catalog.ts';
import { beneathCortex } from '../core/catalog/labels.ts';
import {
  ALL_DOMAINS,
  domainAreas,
  domainName,
  domainPaint,
  domainRecord,
  drawnAs,
  groupedDomains,
  matchingTerms,
  revealedRegions,
} from '../core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import { t } from '../core/i18n/index.ts';
import type { CircuitCatalog } from '../core/learning/catalog.ts';
import { revealNotice } from '../core/panels/clinical.ts';
import type { RevealSettings } from '../core/panels/clinical.ts';
import { createInvolvement } from '../core/panels/related.ts';
import type { ReaderState } from '../core/state/reader-state.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { AppContext } from './context.ts';
import { createLessons } from './lesson.ts';
import type { MriDialog, SceneReader, Shell } from './lesson.ts';
import type { LesionStore } from '../state/lesion.svelte.ts';
import { createExplorerChoice, createModes } from './modes.ts';
import type { Language, Notice } from '../types/index.ts';

export type { MriDialog, SceneReader, Shell } from './lesson.ts';

/** A strongest region within this many, when the cortex hides it, is worth seeing through to. */
const DEEP_RANKS = 5;

/** What the controller reaches outside the stores and the engine for. */
export interface ExcursionDeps {
  /** The core anatomy catalog: a region's label in the language the view shows. */
  anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
  domains: NeuropsychDomains;
  clinical: ClinicalCatalog;
  circuits: CircuitCatalog;
  commands: Pick<
    SceneCommands,
    | 'begin'
    | 'fail'
    | 'revealRegions'
    | 'openRegion'
    | 'prepareCut'
    | 'chooseAtlas'
    | 'chooseSurfaceColor'
  >;
  reader: SceneReader;
  shell: Shell;
  mri: MriDialog;
  /**
   * The panels' entry points, which run a command under their latest-wins or busy runner, scroll and
   * focus the profile, and word a failure (functions.js:157, clinical.js:276, circuits.js:260). Each
   * calls back into this controller. Fired and not awaited, as legacy did.
   */
  panels: {
    openFunction: (id: string) => unknown;
    openDeficit: (id: string) => unknown;
    /** The lesson's Linked MRI: runs `openMri`. */
    openMri: () => unknown;
  };
  /** Apply pending state to the page: the legacy `render()`. Framing reads the page it has drawn. */
  render: () => void;
  lesion: Pick<LesionStore, 'selectedTract' | 'clearTract'>;
}

/**
 * Excursions, lessons and tabs (app.js:822-1102, 1298-1411): the commands that take the reader out
 * of the scene they were in, and bring them back. Create it in a component, beside the stores.
 */
export function createExcursions(
  ctx: Pick<AppContext, 'engine' | 'session' | 'lesson' | 'view'>,
  {
    anatomy,
    domains,
    clinical,
    circuits,
    commands,
    reader,
    shell,
    mri,
    panels,
    render,
    lesion,
  }: ExcursionDeps,
) {
  const { engine, session, lesson, view } = ctx;
  const { model, sections, camera } = engine;
  if (model.domains?.atlas !== domains.atlas) {
    throw new Error('The model publishes no neuropsychological domains for the Functions tab.');
  }

  // The scene before this excursion's first function or deficit. Kept until it is restored or the
  // function or deficit closes, so Restore returns there whatever was changed since, as its label says.
  let beforeExcursion = $state.raw<ReaderState | null>(null);
  // Whether the cortex is see-through because the reader took the notice's offer, so the next map
  // that needs no such view can put the cortex back.
  let seenThroughByNotice = false;

  const explorerChoice = createExplorerChoice({
    engine,
    session,
    lesion,
    anatomy: () => view.current.anatomy,
    render,
  });
  const { chooseExplorer } = explorerChoice;
  const lessons = createLessons({
    engine,
    session,
    lesson,
    circuits,
    commands,
    reader,
    shell,
    mri,
    chooseExplorer,
    openMriPanel: panels.openMri,
    render,
  });
  const modes = createModes({
    engine,
    session,
    clinical,
    domains,
    chooseExplorer,
    leaveLesson: lessons.leave,
    openFunction: panels.openFunction,
    openDeficit: panels.openDeficit,
  });

  const seeThroughOpacity = () => {
    const opacity = model.manifest.appearance.see_through_opacity;
    if (opacity === undefined) throw new Error('This build publishes no see-through opacity.');
    return opacity;
  };
  const lang = (): Language => session.state.lang;

  /** A failure a newer deploy causes also needs the notice's Reload; panels word their own. */
  function offerReload(error: unknown) {
    if ((error as { code?: string } | null)?.code === 'asset-updated') {
      commands.fail('landmark', error);
    }
  }

  /** Put back the scene from before the first function or deficit, unpainted; false when a later command overtook it. */
  async function restoreBeforeExcursion(): Promise<boolean> {
    if (!beforeExcursion) throw new Error('There is no scene from before an excursion to restore.');
    const current = commands.begin();
    const failures = await reader.apply(beforeExcursion, current);
    if (!current()) return false;
    if (failures.length) {
      for (const { error } of failures) console.error(error);
      throw new AggregateError(
        failures.map(({ error }) => error),
        'The previous view was not fully restored.',
      );
    }
    beforeExcursion = null;
    seenThroughByNotice = false;
    // The function or deficit in front opened the excursion, so the view from before it has it closed.
    if (session.state.explorer === 'functions') session.setFunction(null);
    else session.setDeficit(null);
    session.notify({ text: t(lang(), 'clinical').stageRestored });
    render();
    return true;
  }

  /** Closing a deficit ends its excursion: the scene stays, and there is nothing left to restore. */
  function closeDeficit() {
    session.setDeficit(null);
    beforeExcursion = null;
    render();
  }

  function closeFunction() {
    session.setFunction(null);
    beforeExcursion = null;
    render();
  }

  /** The reader's own settings a reveal can change, compared after it to say which it did. */
  function revealSettings(): RevealSettings {
    const { atlas, surfaceColor, detail, cutActive, isolatedRegion, hemisphere, cortexVisible } =
      model.settings;
    return {
      atlas,
      cutAtlas: sections.state.cutAtlas,
      colour: surfaceColor,
      detail,
      cut: cutActive,
      isolated: Boolean(isolatedRegion),
      hemisphere,
      cortex: cortexVisible,
    };
  }

  /**
   * A paint names regions of the surface atlas, and a cut face can only take a colour its own labels
   * carry, so the cut is labelled by that atlas too where one is published. The reveal has closed
   * any cut, so this downloads nothing.
   */
  function cutLabelsFollowAtlas() {
    const { atlas } = model.settings;
    if (!model.manifest.cut_atlases?.some((entry) => entry.id === atlas)) return;
    void sections.setCutAtlas(atlas);
  }

  /** What a reveal changed, and after it any hint about seeing what it revealed, as one notice. */
  function sayRevealed(before: RevealSettings, hint: Notice | null = null) {
    const said = revealNotice(lang(), before, revealSettings());
    if (said || hint) {
      session.notify({
        text: [said, hint?.text].filter(Boolean).join(' '),
        action: hint?.action ?? null,
      });
    }
  }

  /**
   * A function one of whose strongest regions is a structure the cortex hides says so, naming itself,
   * and offers to see through the cortex; null for the overview, or a hidden cortex.
   */
  function deepHint(id: string): Notice | null {
    if (id === ALL_DOMAINS || !model.settings.cortexVisible) return null;
    const strongest = domainAreas(domains, id).slice(0, DEEP_RANKS);
    const rank = strongest.findIndex(({ region }) => beneathCortex(model.regions.get(region)!));
    if (rank < 0) return null;
    const { region } = strongest[rank]!;
    const copy = t(lang(), 'functions');
    // Mid-sentence, the side is a common word.
    const side = t(lang(), 'sides').capitalized[
      model.regions.get(region)!.hemisphere
    ].toLocaleLowerCase(lang());
    const map = domainName(domainRecord(domains, id)!, lang());
    const name = anatomy.get(region)!.label.name;
    return {
      text: rank
        ? copy.deepAmong(name, side, map, DEEP_RANKS)
        : copy.deepStrongest(name, side, map),
      action: 'see-through',
    };
  }

  /**
   * The opened map's deep-structure offer as the cortex now stands: none when the cortex is already
   * see-through for it; and a see-through cortex the notice set, which this map does not need, made
   * opaque again and said so.
   */
  function seeThroughFor(hint: Notice | null): Notice | null {
    const seeThrough = seenThroughByNotice && model.settings.cortexOpacity === seeThroughOpacity();
    if (seeThrough && hint) return null;
    if (seeThrough) {
      model.setCortexOpacity(1);
      seenThroughByNotice = false;
      return model.settings.cortexVisible ? { text: t(lang(), 'display').opaqueAgain } : null;
    }
    return model.settings.cortexOpacity >= 1 ? hint : null;
  }

  /**
   * A deficit whose mapped regions include structures the opaque cortex hides names them, its first
   * associations' first, two of them when there are more than three, and offers to see through the cortex.
   */
  function deficitDeepHint(id: string): Notice | null {
    if (!model.settings.cortexVisible) return null;
    const names = [
      ...new Set(
        clinical
          .mappedRegions(id)
          .filter((region) => beneathCortex(model.regions.get(region)!))
          .map((region) => anatomy.get(region)!.label.name),
      ),
    ]
      // Source labels differ in case (NextBrain's are lower case); listed together, each starts with a capital.
      .map((name) => `${name.charAt(0).toLocaleUpperCase(lang())}${name.slice(1)}`);
    if (!names.length) return null;
    const text = t(lang(), 'clinical');
    const shown = names.length > 3 ? names.slice(0, 2) : names;
    const items =
      shown.length < names.length
        ? [...shown, text.otherMapped(names.length - shown.length)]
        : shown;
    return {
      text: text.deepMapped(
        new Intl.ListFormat(lang(), { type: 'conjunction' }).format(items),
        names.length,
      ),
      action: 'see-through',
    };
  }

  /** The notice's offer to see an opened map's deep structures: the cortex turns see-through, and stays undoable. */
  function seeThroughCortex() {
    model.setCortexOpacity(seeThroughOpacity());
    seenThroughByNotice = true;
    // The hint is answered, so the confirmation replaces it rather than joining it.
    session.notify(null);
    session.notify({ text: t(lang(), 'display').seenThrough });
    render();
  }

  /**
   * The profile opens at once; the mapped regions are then drawn together and framed once, each
   * FreeSurfer structure by its teaching-set stand-ins unless FreeSurfer's segmentation is shown.
   */
  async function openDeficit(id: string): Promise<boolean> {
    const current = commands.begin();
    const regions = [
      ...new Set(
        clinical
          .mappedRegions(id)
          .flatMap((region) => clinical.drawnAs(region, model.settings.detail)),
      ),
    ];
    // Before the detail opens: on a phone, raising the sheet reframes the camera. A lesson it is
    // opened from ends here and hands over the scene from before it, for Restore to return to.
    const fromLesson = lessons.takeBeforeLesson();
    beforeExcursion ??= fromLesson ?? reader.capture();
    lesson.close();
    session.setDeficit(id);
    chooseExplorer('deficits');
    render();
    shell.showDetail();
    const before = revealSettings();
    if (!(await commands.revealRegions(regions, current))) return false;
    cutLabelsFollowAtlas();
    sayRevealed(before, seeThroughFor(deficitDeepHint(id)));
    // Drawn first, so the framing measures the key this paint brings.
    render();
    camera.frameRegions(regions);
    render();
    return true;
  }

  /**
   * The profile opens at once; the function's HCP-MMP areas and its structures, on the teaching set
   * unless FreeSurfer's segmentation is shown, are then drawn and framed, and painted by the paint effect.
   */
  async function openFunction(id: string): Promise<boolean> {
    const current = commands.begin();
    const fromLesson = lessons.takeBeforeLesson();
    beforeExcursion ??= fromLesson ?? reader.capture();
    lesson.close();
    session.setFunction(id);
    chooseExplorer('functions');
    render();
    shell.showDetail();
    const before = revealSettings();
    const regions = revealedRegions(domains, domainPaint(domains, id), model.settings.detail);
    if (!(await commands.revealRegions(regions, current))) return false;
    cutLabelsFollowAtlas();
    sayRevealed(before, seeThroughFor(deepHint(id)));
    // A function's map spans the cortex, so the whole brain is framed, clear of the key it brings.
    render();
    camera.frameWhole();
    render();
    return true;
  }

  /** A region a function or deficit names: drawn, selected and framed, as an excursion step. */
  async function openListedRegion(id: string): Promise<boolean> {
    const current = commands.begin();
    beforeExcursion ??= reader.capture();
    const before = revealSettings();
    // A function's or deficit's structure is drawn where its paint is.
    const shown =
      session.state.explorer === 'functions'
        ? drawnAs(domains, id, model.settings.detail)
        : clinical.drawnAs(id, model.settings.detail);
    if (!(await commands.revealRegions(shown, current))) return false;
    model.select(shown[0]!);
    sayRevealed(before);
    // With the context around it a deficit's regions get, not filling the stage on its own.
    render();
    camera.frameRegions(shown);
    render();
    return true;
  }

  /** A stage key row: one function, or one finding, alone; null returns to all of them. */
  function pickPaint(id: string | null) {
    if (session.state.explorer === 'functions') {
      panels.openFunction(id ?? ALL_DOMAINS);
      return;
    }
    session.setFinding(id);
    render();
  }

  /** A search carried to the other evidence tab opens that tab's list on the same words. */
  function searchIn(mode: 'functions' | 'deficits', query: string): Promise<void> {
    if (mode === 'functions') {
      session.setFunction(null);
      session.setFunctionQuery(query);
    } else {
      session.setDeficit(null);
      session.setClinicalQuery(query);
    }
    beforeExcursion = null;
    return modes.chooseMode(mode);
  }

  const lesionChecks = domains.lesion_checks as Record<string, { deficit: string }[]>;

  return {
    /** Whether the scene from before this excursion's first function or deficit can be put back. */
    get restorable() {
      return beforeExcursion !== null;
    },
    /** The Tracts excursion is open, holding the cortex opacity it will give back. */
    get tractsHeld() {
      return explorerChoice.tractsHeld;
    },
    /** The regions a selection shares anatomy with (related lessons and evidence). */
    involved: createInvolvement(model.regions),

    chooseExplorer,
    chooseMode: modes.chooseMode,
    searchIn,

    restoreBeforeExcursion,
    closeDeficit,
    closeFunction,
    openDeficit,
    openFunction,
    openListedRegion,
    seeThroughCortex,
    pickPaint,
    offerReload,

    /** Another atlas holds none of a function's areas, so choosing one lifts the open paint. */
    chooseAtlas(id: string) {
      session.liftPaint();
      render();
      return commands.chooseAtlas(id);
    },
    /**
     * The cut's label volume (app.js:564), from the navigator's "switch cut atlas". The cortical surface
     * is untouched. A download can be overtaken by closing the cut, so the rejection reaches the caller,
     * which reports it.
     */
    setCutAtlas: (id: string) => sections.setCutAtlas(id),
    chooseSurfaceColor(value: Parameters<typeof commands.chooseSurfaceColor>[0]) {
      session.liftPaint();
      return commands.chooseSurfaceColor(value);
    },

    /** The curated functions whose lesion checks cite one of a deficit's associations, as the deficit lists them. */
    checkedMaps: (deficit: string, language: Language) =>
      domains.domains
        .filter((domain) => lesionChecks[domain.id]!.some((check) => check.deficit === deficit))
        .map((domain) => ({
          id: domain.id,
          name: domainName(domain, language),
          color: domain.color,
        })),
    /** How many functions and Neurosynth terms the Functions tab finds for the same words. */
    functionsMatching: (query: string, language: Language) =>
      matchingTerms(domains, query).length +
      groupedDomains(domains, query, language).reduce(
        (sum, entry) => sum + entry.domains.length,
        0,
      ),
    /** How many deficits the Deficits tab finds for the same words. */
    deficitsMatching: (query: string, language: Language) =>
      clinical.search(query, language).length,

    lessonLandmark: lessons.lessonLandmark,
    openCircuit: lessons.openCircuit,
    openLessonLandmark: lessons.openLandmarkOf,
    openLessonStep: lessons.openStep,
    openLinkedMri: lessons.openLinkedMri,
    openLessonMri: lessons.openMri,
    focusLandmark: lessons.focusLandmark,
    leaveLesson: lessons.leave,
    openLandmark: lessons.openLandmark,
    holdBeforeLesson: lessons.holdBeforeLesson,

    /** A link's scene is the new baseline: no excursion or lesson has anything to go back to. */
    forget() {
      beforeExcursion = null;
      lessons.forgetBeforeLesson();
    },
  };
}

export type Excursions = ReturnType<typeof createExcursions>;
