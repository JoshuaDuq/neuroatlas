/**
 * What the Section popover and the section bar share (ui/chrome/sections.js:112-247, 575-584): the plane
 * the reader chose while its anatomy is prepared, the plane choice itself, the slider's one cut build at a
 * time, the Linked MRI opener and the failure the bar reports. The two components are separate snippets of
 * the dock, so they read one instance, built once beside the dock.
 */
import type { SceneCommands } from '../../lib/core/state/scene-commands.ts';
import type {
  EngineCamera,
  EngineModel,
  EngineSections,
  SectionsState,
  Vec3,
} from '../../lib/engine/api.ts';
import type { SessionStore } from '../../lib/state/session.svelte.ts';
import type { CutMode } from '../../lib/types/index.ts';

export interface SectionControlsDeps {
  engine: {
    sections: Pick<
      EngineSections,
      | 'state'
      | 'active'
      | 'frame'
      | 'offsetRange'
      | 'offset'
      | 'setMode'
      | 'setOffset'
      | 'setOffsetReady'
      | 'setAnglesReady'
      | 'setCutAtlas'
      | 'setDisplay'
      | 'cutSpacingMm'
    >;
    model: Pick<EngineModel, 'state' | 'anchorOf' | 'manifest' | 'cabNp' | 'domains'>;
    camera: Pick<EngineCamera, 'faceCut'>;
  };
  /** The sections' display snapshot, replaced on every engine `change` (S1's engine sync). */
  engineState: { readonly sections: SectionsState };
  commands: Pick<SceneCommands, 'begin' | 'cut'>;
  session: Pick<SessionStore, 'setView'>;
  /** S3's `openLinkedMri`: loads the scan, then opens G5's dialog. */
  openLinkedMri: (options: { instant: boolean }) => Promise<unknown>;
}

/** Where a plane with this normal passes through a point, clamped to the cut's range (coordinates.js offsetThrough). */
function offsetThrough(point: Vec3, normal: Vec3, [minimum, maximum]: readonly [number, number]) {
  const offset = point[0] * normal[0] + point[1] * normal[1] + point[2] * normal[2];
  if (![offset, minimum, maximum].every(Number.isFinite)) {
    throw new Error('A cut through a point needs finite coordinates and a finite range.');
  }
  return Math.min(maximum, Math.max(minimum, offset));
}

export function createSectionControls({
  engine,
  engineState,
  commands,
  session,
  openLinkedMri,
}: SectionControlsDeps) {
  const { sections, model, camera } = engine;
  // The plane the reader chose while its anatomy is still being prepared.
  let pendingPlane = $state<CutMode | null>(null);
  // Counts the plane choices: only the latest one settling ends the pending plane.
  let choices = 0;
  // A failure is said and shown until the reader acts on the section again, or another command changes
  // the plane (g4-pending-after-failure).
  let failure = $state.raw<{ error: unknown; mode: CutMode } | null>(null);
  let opening = $state(false);

  const state = $derived(engineState.sections);
  // The engine's getters are not reactive: each is read again with every new snapshot.
  const measures = $derived.by(() => {
    void state;
    return {
      active: sections.active,
      offset: sections.offset,
      offsetRange: sections.offsetRange,
      spacing: sections.cutSpacingMm(state.cutAtlas),
    };
  });

  function report(error: unknown) {
    console.error(error);
    failure = { error, mode: sections.state.mode };
  }

  /** The reader acts on the section again: an earlier failure is no longer the news. */
  function act() {
    failure = null;
  }

  /** The cut faces the reader, from the side it keeps (app.js:1281). */
  function face() {
    const faced = camera.faceCut();
    if (faced) session.setView(faced);
  }

  // One cut build at a time. A newer value replaces the one waiting, so the pointer never queues a stack of
  // planes and the page never builds inside the input event (sections.js:138-157).
  let queued: (() => Promise<void>) | null = null;
  let sliding = false;
  function slide(run: () => Promise<void>) {
    queued = run;
    if (sliding) return;
    sliding = true;
    const step = () => {
      const next = queued;
      queued = null;
      if (!next) {
        sliding = false;
        return;
      }
      next().then(step, (error: unknown) => {
        report(error);
        step();
      });
    };
    step();
  }

  const cutAtlases = model.manifest.cut_atlases ?? [];

  return {
    get state() {
      return state;
    },
    /** The plane on screen, or the one being prepared. */
    get plane(): CutMode {
      return pendingPlane ?? state.mode;
    },
    /** The chosen plane's anatomy is still being prepared: the bar names it and has nothing to move yet. */
    get pending() {
      return (pendingPlane ?? state.mode) !== state.mode;
    },
    get active() {
      return measures.active;
    },
    get offset() {
      return measures.offset;
    },
    get offsetRange() {
      return measures.offsetRange;
    },
    get spacing() {
      return measures.spacing;
    },
    /** A slide is queued or building: the cut's angles lag the sliders until it lands. */
    get sliding() {
      return sliding;
    },
    /** The cut's mode changed under the failure: it is no longer the news (SectionBar drops it). */
    forgetFailure: act,
    get failure(): unknown {
      return failure !== null && failure.mode === state.mode ? failure.error : null;
    },
    /** The Linked MRI is loading: a second press waits for it. */
    get opening() {
      return opening;
    },
    cutAtlases,
    nextbrainSegmented:
      cutAtlases.find((atlas) => atlas.id === 'nextbrain')?.procedure === 'subject-segmentation',
    colourAtlases: {
      cabNp: model.cabNp?.atlas,
      domains: model.domains?.atlas,
    },

    /**
     * A plane chosen in the popover is a scene command: its first cut downloads, and a later command
     * overtakes it. The bar names the plane at once. A plane already chosen does nothing.
     */
    async choose(plane: CutMode) {
      act();
      if (plane === (pendingPlane ?? sections.state.mode)) return;
      const choice = ++choices;
      pendingPlane = plane === 'off' ? null : plane;
      try {
        if (!(await commands.cut(plane, commands.begin()))) return;
        // A plane chosen while this one was prepared replaced it; that choice frames its own cut.
        if (!sections.active || sections.state.mode !== plane) return;
        // The new plane meets the region already chosen, not the midline the slider was left on.
        const region = model.state.selectedRegion;
        const anchor = region && model.anchorOf(region.id);
        if (anchor) {
          sections.setOffset(offsetThrough(anchor, sections.frame.normal, sections.offsetRange));
        }
        face();
      } catch (error) {
        report(error);
      } finally {
        // Also after a failure, so the bar says why instead of preparing for ever; and only for the latest
        // choice, so an overtaken one cannot end a newer plane's preparation (g4-pending-after-failure).
        if (choice === choices) pendingPlane = null;
      }
    },

    /** The bar's Close: the whole brain again. The caller has already moved focus to the Section tool. */
    async close() {
      act();
      choices++;
      pendingPlane = null;
      try {
        await sections.setMode('off');
      } catch (error) {
        report(error);
      }
    },

    /** The position slider: the picture keeps the last complete cut until the next is ready. */
    slideOffset(offset: number) {
      act();
      slide(() => sections.setOffsetReady(offset));
    },

    /** The exact field, already checked against the range. */
    setOffset(offset: number) {
      act();
      try {
        sections.setOffset(offset);
      } catch (error) {
        report(error);
      }
    },

    slideAngles(tilt: number, azimuth: number) {
      act();
      slide(() => sections.setAnglesReady(tilt, azimuth));
    },

    setReverse(reverse: boolean) {
      act();
      try {
        sections.setDisplay({ reverse });
        face();
      } catch (error) {
        report(error);
      }
    },

    /** On failure the sections keep the previous labels, and the bar says why. */
    async setCutAtlas(atlas: string) {
      act();
      try {
        await sections.setCutAtlas(atlas);
      } catch (error) {
        report(error);
      }
    },

    /** The bar's Linked MRI, and the `M` key (the keymap's `openMpr` port, I2). */
    async openLinkedMri({ instant }: { instant: boolean }) {
      if (opening) return;
      act();
      opening = true;
      try {
        await openLinkedMri({ instant });
      } catch (error) {
        report(error);
      } finally {
        opening = false;
      }
    },

    /** The cut on screen, for the exported image's caption (G6); null while none is, or while it is prepared. */
    get current() {
      if (!sections.active || pendingPlane) return null;
      const { mode, tilt, azimuth } = sections.state;
      return { plane: mode, offset: sections.offset, tilt, azimuth };
    },
  };
}

export type SectionControls = ReturnType<typeof createSectionControls>;
