import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import type { Engine } from '../engine/api.ts';
import type { SessionStore } from '../state/session.svelte.ts';
import type { Explorer } from '../types/index.ts';

/**
 * The tab in front (app.js:1035-1060). Leaving Tracts gives the cortex back the opacity it had when
 * Tracts opened; opening Tracts on the anatomy that owns the tracts draws them over its own cortex,
 * made see-through if it was opaque.
 */
export function createExplorerChoice({
  engine,
  session,
  anatomy,
  render,
}: {
  engine: Pick<Engine, 'model' | 'tracts'>;
  session: Pick<SessionStore, 'state' | 'setExplorer'>;
  /** The brain on screen. */
  anatomy: () => string;
  render: () => void;
}) {
  let beforeTractsOpacity: number | null = null;
  return {
    /** The Tracts excursion is open: the cortex opacity it will give back is held. */
    get tractsHeld() {
      return beforeTractsOpacity !== null;
    },
    chooseExplorer(value: Explorer) {
      const previous = session.state.explorer;
      session.setExplorer(value);
      if (previous === 'diffusion' && value !== 'diffusion' && beforeTractsOpacity !== null) {
        const opacity = beforeTractsOpacity;
        beforeTractsOpacity = null;
        engine.tracts.setOverlay(false);
        engine.model.setCortexOpacity(opacity);
      }
      if (
        previous !== 'diffusion' &&
        value === 'diffusion' &&
        anatomy() === engine.tracts.anatomy
      ) {
        beforeTractsOpacity = engine.model.settings.cortexOpacity;
        engine.tracts.setOverlay(true);
        if (engine.model.settings.cortexOpacity === 1) {
          engine.model.setCortexOpacity(engine.tracts.defaultOpacity);
        }
      }
      render();
    },
  };
}

/**
 * A tab chosen during a lesson waits for the lesson's scene to come back; a later choice wins
 * (app.js:1335-1350). Back on Functions or Deficits after another tab changed the atlas, the open
 * item's regions are drawn again, so its key never describes a brain that does not carry them.
 */
export function createModes({
  engine,
  session,
  clinical,
  domainsAtlas,
  chooseExplorer,
  leaveLesson,
  openFunction,
  openDeficit,
}: {
  engine: Pick<Engine, 'model'>;
  session: Pick<SessionStore, 'state'>;
  clinical: Pick<ClinicalCatalog, 'mappedRegions'>;
  /** The atlas the neuropsychological domains are defined on. */
  domainsAtlas: string;
  chooseExplorer: (value: Explorer) => void;
  leaveLesson: () => Promise<void>;
  /** The panels' entry points (busy state, failure wording), fired and not awaited, as legacy did. */
  openFunction: (id: string) => unknown;
  openDeficit: (id: string) => unknown;
}) {
  let wanted: Explorer | null = null;
  return {
    async chooseMode(value: Explorer) {
      wanted = value;
      await leaveLesson();
      if (wanted !== value) return;
      chooseExplorer(value);
      const { selectedFunction, selectedDeficit } = session.state;
      const { regions, settings } = engine.model;
      const shownAtlas = settings.atlas;
      if (value === 'functions' && selectedFunction && shownAtlas !== domainsAtlas) {
        openFunction(selectedFunction);
      }
      if (
        value === 'deficits' &&
        selectedDeficit &&
        clinical.mappedRegions(selectedDeficit).some((id) => {
          const region = regions.get(id)!;
          return region.kind === 'cortex' && region.atlas !== shownAtlas;
        })
      ) {
        openDeficit(selectedDeficit);
      }
    },
  };
}
