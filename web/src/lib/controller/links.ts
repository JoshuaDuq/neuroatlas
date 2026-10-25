import { ALL_DOMAINS } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import { linkNotice } from '../core/i18n/errors.ts';
import type { CircuitCatalog, Landmark } from '../core/learning/catalog.ts';
import { checkLink } from '../core/state/link-check.ts';
import type { KnownLinkIds } from '../core/state/link-check.ts';
import { sameSubject } from '../core/state/link-writer.ts';
import { applyReaderState as applyScene, readerState } from '../core/state/reader-state.ts';
import type { ReaderState } from '../core/state/reader-state.ts';
import { publishesSpinalCord } from '../core/state/scene-commands.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import { PARAMS, decodeState, encodeState } from '../core/state/url-state.ts';
import type { Engine, MoveOptions } from '../engine/api.ts';
import { VIEW_DIRECTIONS, viewForRestoredCut } from '../engine/render/camera-views.ts';
import type { LinkStore } from '../state/link.svelte.ts';
import type { LessonStore, SessionStore } from '../state/session.svelte.ts';
import type { ViewStore } from '../state/view.svelte.ts';
import { MODES } from '../types/constants.ts';
import type { Explorer, Language, LinkInput, LinkState, ViewName } from '../types/index.ts';

const CUT_LINKS: ReadonlySet<string> = new Set(['sagittal', 'coronal', 'axial', 'oblique']);

/**
 * What restoring a link asks of the other controllers: the explorer, lesson and excursion
 * state they own. Each is the legacy call made at that point in `restoreLink` (app.js:2013-2077).
 */
export interface LinkHooks {
  /** Switch the workspace to an explorer, ending or beginning the Tracts excursion (app.js:1047). */
  chooseExplorer(explorer: Explorer): void;
  /** The Tracts excursion is open: the cortex was made translucent for it (app.js:2021). */
  tractsExcursionOpen(): boolean;
  /** Forget the scenes kept to return to after an excursion and after a lesson (app.js:2043-2044). */
  forgetScenes(): void;
  /** Keep the scene as it now stands (`captureReaderState()`), to return to when the lesson a link opened is left (app.js:2061). */
  rememberLessonScene(scene: ReaderState): void;
  /** Draw, select and frame a lesson's landmark; false once a later command took over (app.js:1311). */
  openLandmark(step: Landmark, current: () => boolean): Promise<boolean>;
  /** Open the tree branch that holds a region (app.js:527). */
  revealInTree(id: string): void;
  /** Show the workspace's detail, without raising a phone's sheet over the camera (app.js:2072). */
  showDetail(): void;
  openFunction(id: string): void;
  openDeficit(id: string): void;
}

export interface LinksOptions {
  engine: Engine;
  session: SessionStore;
  lesson: LessonStore;
  view: ViewStore;
  /** The writer from `createLink`: hold, release, schedule and cancel. */
  link: Pick<LinkStore, 'hold' | 'release' | 'schedule' | 'cancel'>;
  commands: Pick<
    SceneCommands,
    'begin' | 'loadAtlas' | 'loadDetail' | 'showSpinalCord' | 'applySurfaceColor' | 'cut'
  >;
  clinical: Pick<ClinicalCatalog, 'search'>;
  circuits: Pick<CircuitCatalog, 'all' | 'get'>;
  hooks: LinkHooks;
  /** Make the page's language the link's, without saving it as the reader's choice (`<html lang>`, WCAG 3.1.1). */
  followLanguage(lang: Language): void;
  /** The anatomy a link without one opens (the published default). */
  defaultAnatomy: string;
  /** The page whose address bar carries the link. */
  page: Pick<Window, 'history' | 'location'>;
}

/**
 * Link restore and writing: the scene as a link carries it, and a decoded link applied to the
 * scene field by field. The camera's own parts (`restoreCamera`, `placeOrbit`, `orbitLink`) are the
 * engine's (decision 30 on #4).
 *
 * Create `announceView` before the first `restore`. Its speech starts with no hidden count, so
 * the first view it sees only records one; a link that loads hidden regions then changes it and
 * the count is said once. Created after the link is applied, the restored count is never said.
 */
export function createLinks({
  engine,
  session,
  lesson,
  view,
  link,
  commands,
  clinical,
  circuits,
  hooks,
  followLanguage,
  defaultAnatomy,
  page,
}: LinksOptions) {
  const { model, sections, camera } = engine;
  const { domains } = model;
  if (!domains) {
    throw new Error('This build publishes no neuropsychological domains for the Functions tab.');
  }

  const known: KnownLinkIds = {
    atlases: new Set(model.manifest.atlases.map((entry) => entry.id)),
    details: new Set(model.manifest.detail_levels.map((entry) => entry.id)),
    cutAtlases: new Set(model.manifest.cut_atlases!.map((entry) => entry.id)),
    views: new Set(Object.keys(VIEW_DIRECTIONS)),
    explorers: new Set(MODES),
    surfaceColors: new Set([
      'tissue',
      'mri',
      'atlas',
      ...(model.manifest.networks ? ['network'] : []),
      ...(model.cabNp ? ['cab-np'] : []),
      ...(model.functionalRegions ? ['functional'] : []),
    ]),
    functions: new Set([
      ALL_DOMAINS,
      ...domains.domains.map((domain) => domain.id),
      ...(domains.search?.terms.keys() ?? []),
    ]),
    regions: model.regions,
    deficits: new Set(clinical.search('', 'en').map((deficit) => deficit.id)),
    circuits: new Map(circuits.all.map((circuit) => [circuit.id, circuit.steps.length])),
    spinalCord: publishesSpinalCord(model.manifest),
  };

  /** The plane is not session state. It still belongs in the link (app.js:1754). */
  function cutState(): Partial<LinkInput> {
    const cut = sections.state;
    if (!CUT_LINKS.has(cut.mode)) return {};
    const [x, y, z] = cut.crosshair;
    const normal = sections.frame.normal;
    return {
      cut: cut.mode,
      cutOffset: x * normal[0] + y * normal[1] + z * normal[2],
      cutReverse: cut.reverse,
      cutTilt: cut.tilt,
      cutAzimuth: cut.azimuth,
    };
  }

  /**
   * Everything the link carries. The brain is fixed for the life of the page, so it is not
   * session state, but region ids are shared between brains and a link without it reopens
   * someone else's anatomy (app.js:1768).
   */
  function linkState(): Partial<LinkInput> {
    const current = view.current;
    return {
      ...current,
      cutAtlas: current.cutAtlas ?? undefined,
      ...cutState(),
      circuit: current.lesson.circuit,
      circuitStep: current.lesson.circuit ? current.lesson.step : 0,
      orbit: camera.orbitLink(),
      mriWindow: sections.mriWindowLink(),
    };
  }

  /** replaceState, not push: the back button is not a camera undo stack (app.js:243). */
  function write() {
    const hash = encodeState(linkState());
    page.history.replaceState(
      null,
      '',
      hash ? `#${hash}` : page.location.pathname + page.location.search,
    );
  }

  /**
   * Another brain is another set of assets, so this re-enters through the URL rather than
   * mutating the model in place. The reader keeps their atlas, cut, view, panel and language;
   * selection, dissection, the exact camera and the MRI window belong to the current subject's
   * parcels and intensities (app.js:636).
   */
  function switchAnatomy(id: string) {
    if (id === view.current.anatomy) return;
    link.cancel();
    const hash = encodeState({
      ...linkState(),
      anatomy: id,
      selectedRegion: null,
      isolatedRegion: null,
      hiddenRegions: new Set(),
      orbit: null,
      mriWindow: null,
    });
    // Replaced, not pushed: Back must not return to a link for the brain just left.
    page.history.replaceState(null, '', `#${hash}`);
    page.location.reload();
  }

  function applyView(name: ViewName, movement: MoveOptions) {
    if (!session.setView(name)) throw new Error(`Unknown view: ${name}`);
    camera.applyView(name, movement);
  }

  /** The layers on screen, which a scene without its own keeps (app.js:749). */
  const loadedLayers = () => ({
    atlas: model.settings.atlas,
    detail: model.settings.detail,
    cutAtlas: sections.state.cutAtlas,
  });

  /** The scene as its link carries it, plus the exact camera a link leaves out (app.js:754). */
  function captureReaderState(): ReaderState {
    return readerState(
      {
        ...view.current,
        cutAtlas: view.current.cutAtlas ?? undefined,
        ...cutState(),
        mriWindow: sections.mriWindowLink(),
        camera: camera.capture(),
      },
      loadedLayers(),
    );
  }

  /** Apply a whole scene under `current`; returns the steps that failed, each with its link fields (app.js:770). */
  function applyReaderState(
    target: ReaderState,
    current: () => boolean,
    movement: MoveOptions = {},
  ) {
    return applyScene(target, {
      model,
      sections,
      commands,
      current,
      revealInTree: hooks.revealInTree,
      applyCamera: () => {
        if (target.camera === 'cut' && sections.active) {
          const faced = camera.faceCut(movement);
          if (faced) session.setView(faced);
        } else if (target.camera === 'cut' || target.camera === 'view') {
          applyView(target.view as ViewName, movement);
        } else {
          session.setView(target.view);
          camera.restore(target.view as ViewName, target.camera, movement);
        }
      },
      applyOrbit: (orbit) => camera.placeOrbit(orbit, movement),
    });
  }

  /**
   * Apply a decoded link to the anatomy on screen, field by field. Returns the link parameters
   * that were not applied, or null when a later command took over. The address bar keeps the
   * link until it has settled; the caller ends the notice hold with `report`.
   */
  async function restore(
    { state: linked, rejected }: { state: Partial<LinkState>; rejected: string[] },
    movement: MoveOptions,
  ): Promise<string[] | null> {
    const current = commands.begin();
    link.hold(current);
    // Released by the caller once the scene has settled, with the link's own notice.
    session.holdNotices();
    try {
      const { state: valid, rejected: unknown } = checkLink(linked, known);
      // End the Tracts excursion before the link applies its own display settings.
      if (hooks.tractsExcursionOpen() && valid.explorer !== 'diffusion') {
        hooks.chooseExplorer(valid.explorer ?? 'anatomy');
      }
      const notApplied = [...rejected, ...unknown];
      const atlas = valid.atlas ?? model.manifest.atlases[0]!.id;
      const target = readerState(
        {
          ...valid,
          // Without a view of its own, the link faces its cut, as choosing the cut does.
          camera: viewForRestoredCut({
            cut: valid.cut,
            reverse: valid.cutReverse,
            view: valid.view as ViewName | undefined,
          })
            ? 'cut'
            : 'view',
        },
        { atlas, detail: model.defaultDetail, cutAtlas: valid.cutAtlas ?? atlas },
      );
      const failures = await applyReaderState(target, current, movement);
      if (!current()) return null;
      const present = new Set(Object.keys(linked).map((key) => PARAMS[key]));
      for (const { fields, error } of failures) {
        console.error(error);
        const named = fields.filter((field) => present.has(field));
        notApplied.push(...(named.length ? named : fields.slice(0, 1)));
      }
      hooks.forgetScenes();
      hooks.chooseExplorer(valid.explorer ?? 'anatomy');
      session.setFunction(valid.selectedFunction ?? null);
      session.setDeficit(valid.selectedDeficit ?? null);
      if (valid.circuit) {
        lesson.start(valid.circuit);
        lesson.go(valid.circuitStep ?? 0);
      } else {
        lesson.close();
      }
      const { explorer, selectedFunction, selectedDeficit } = session.state;
      // A lesson linked without its landmark opens on it, as choosing that step does; leaving it
      // returns to the rest of the link.
      if (explorer === 'circuits' && valid.circuit && !valid.selectedRegion) {
        const { circuit, step } = lesson.state;
        hooks.rememberLessonScene(captureReaderState());
        try {
          if (!(await hooks.openLandmark(circuits.get(circuit!).steps[step]!, current))) {
            return null;
          }
        } catch (error) {
          console.error(error);
          notApplied.push('step');
        }
      }
      // The panel opens on what the link names, without raising a phone's sheet over its camera.
      if (
        (explorer === 'functions' && selectedFunction) ||
        (explorer === 'deficits' && selectedDeficit) ||
        (explorer === 'circuits' && valid.circuit)
      ) {
        hooks.showDetail();
      }
      // A link naming a function or deficit but no atlas was not written from a view of it, so the
      // item is opened as choosing it opens it: its regions drawn, painted and framed.
      if (!valid.atlas && explorer === 'functions' && selectedFunction) {
        hooks.openFunction(selectedFunction);
      }
      if (!valid.atlas && explorer === 'deficits' && selectedDeficit) {
        hooks.openDeficit(selectedDeficit);
      }
      return notApplied;
    } finally {
      link.release(current);
      link.schedule();
    }
  }

  /** End the notice hold `restore` began, with the link's own notice for what it could not apply. */
  function report(notApplied: readonly string[] | null) {
    session.releaseNotices(notApplied?.length ? linkNotice(notApplied, session.state.lang) : null);
  }

  /** A link edited in place: the same brain takes it as scene commands; another brain is another page. */
  async function onHashChange() {
    const decoded = decodeState(page.location.hash);
    if (!sameSubject(decoded.state, view.current.anatomy, defaultAnatomy)) {
      page.location.reload();
      return;
    }
    if (decoded.state.lang) {
      session.setLang(decoded.state.lang);
      followLanguage(decoded.state.lang);
    }
    report(await restore(decoded, {}));
  }

  return {
    linkState,
    write,
    switchAnatomy,
    captureReaderState,
    applyReaderState,
    restore,
    report,
    onHashChange,
  };
}

export type Links = ReturnType<typeof createLinks>;
