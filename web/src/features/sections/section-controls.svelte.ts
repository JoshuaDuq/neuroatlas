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
    model: Pick<
      EngineModel,
      'state' | 'centroidOf' | 'manifest' | 'cabNp' | 'functionalRegions' | 'domains'
    >;
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
  // A failure is shown until the cut changes again, as the legacy status line was until the next render.
  let failure = $state.raw<{ error: unknown; at: SectionsState } | null>(null);
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
    failure = { error, at: engineState.sections };
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
    get failure(): unknown {
      return failure !== null && failure.at === state ? failure.error : null;
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
      functional: model.functionalRegions?.atlas,
      domains: model.domains?.atlas,
    },

    /**
     * A plane chosen in the popover is a scene command: its first cut downloads, and a later command
     * overtakes it. The bar names the plane at once. A plane already chosen does nothing.
     */
    async choose(plane: CutMode) {
      if (plane === (pendingPlane ?? sections.state.mode)) return;
      pendingPlane = plane === 'off' ? null : plane;
      try {
        if (!(await commands.cut(plane, commands.begin()))) return;
        // A plane chosen while this one was prepared replaced it; that choice frames its own cut.
        if (!sections.active || sections.state.mode !== plane) return;
        // The new plane meets the region already chosen, not the midline the slider was left on.
        const region = model.state.selectedRegion;
        const centroid = region && model.centroidOf(region.id);
        if (centroid) {
          sections.setOffset(offsetThrough(centroid, sections.frame.normal, sections.offsetRange));
        }
        face();
      } catch (error) {
        report(error);
      } finally {
        // Also after a failure: the bar then says why instead of preparing for ever (g4-pending-after-failure).
        if (pendingPlane === plane) pendingPlane = null;
      }
    },

    /** The bar's Close: the whole brain again. The caller has already moved focus to the Section tool. */
    async close() {
      pendingPlane = null;
      try {
        await sections.setMode('off');
      } catch (error) {
        report(error);
      }
    },

    /** The position slider: the picture keeps the last complete cut until the next is ready. */
    slideOffset(offset: number) {
      slide(() => sections.setOffsetReady(offset));
    },

    /** The exact field, already checked against the range. */
    setOffset(offset: number) {
      try {
        sections.setOffset(offset);
      } catch (error) {
        report(error);
      }
    },

    slideAngles(tilt: number, azimuth: number) {
      slide(() => sections.setAnglesReady(tilt, azimuth));
    },

    setReverse(reverse: boolean) {
      try {
        sections.setDisplay({ reverse });
        face();
      } catch (error) {
        report(error);
      }
    },

    /** On failure the sections keep the previous labels, and the bar says why. */
    async setCutAtlas(atlas: string) {
      try {
        await sections.setCutAtlas(atlas);
      } catch (error) {
        report(error);
      }
    },

    /** The bar's Linked MRI, and the `M` key (the keymap's `openMpr` port, I2). */
    async openLinkedMri({ instant }: { instant: boolean }) {
      if (opening) return;
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
