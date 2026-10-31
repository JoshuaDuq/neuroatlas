/**
 * What the Linked MRI dialog does beside drawing (ui/chrome/sections.js:212-262, 284-300, 585-592):
 * whether it is open, which plane a phone shows, and the moves of the shared crosshair: a slider, a
 * click, the wheel. I2 builds one, registers `show`, `openPreparedPlane`, `close` and `isOpen` as the
 * `showMri`, `openPreparedPlane`, `closeMpr` and `mprOpen` ports, and mounts `MprDialog` with it.
 */
import type { EngineModel, EngineSections, MprPlane, Vec3 } from '../../lib/engine/api.ts';
import { AXES, COORDINATE_LIMIT, PLANES, pointOnPlane } from './mpr-draw.ts';

export interface MprDialogDeps {
  engine: {
    sections: Pick<
      EngineSections,
      | 'load'
      | 'state'
      | 'display'
      | 'setCrosshair'
      | 'setWindow'
      | 'setDisplay'
      | 'setAgreement'
      | 'sample'
      | 'mprFrame'
    >;
    model: Pick<EngineModel, 'isRegionDrawn'>;
  };
  /** The region under the crosshair becomes the selection (sections.js:256-262). */
  select: (regionId: string) => void;
}

const clamp = (value: number) => Math.max(-COORDINATE_LIMIT, Math.min(COORDINATE_LIMIT, value));

/**
 * The coordinate after one wheel notch, or null when the wheel cannot move it (a horizontal wheel,
 * or the end of the range), so the page keeps the event (deviations/g5-wheel-modifiers.md).
 * Scrolling down moves toward the negative end, one millimetre a notch whatever the delta
 * (sections.js:294-300).
 */
export function wheelCoordinate(coordinate: number, deltaY: number): number | null {
  const next = clamp(coordinate - Math.sign(deltaY));
  return deltaY === 0 || next === coordinate ? null : next;
}

export function createMprDialog({ engine, select }: MprDialogDeps) {
  const { sections, model } = engine;
  let open = $state(false);
  let instant = $state(false);
  // The plane a phone shows; the crosshair stays linked across all three.
  let plane = $state<MprPlane>('axial');

  // One frame of work per kind, the latest value only: a drag is not a queue of resamples (sections.js:130-136).
  const waiting = new Map<string, () => void>();
  let frame: number | null = null;
  let windowChange: { center?: number; width?: number } | null = null;
  function schedule(kind: string, run: () => void) {
    waiting.set(kind, run);
    frame ??= requestAnimationFrame(() => {
      frame = null;
      const runs = [...waiting.values()];
      waiting.clear();
      for (const next of runs) next();
    });
  }

  function selectPoint(point: Vec3) {
    sections.setCrosshair(point);
    const { region } = sections.sample(point);
    if (region && model.isRegionDrawn(region.id)) select(region.id);
  }

  const along = (name: MprPlane, coordinate: number): Vec3 => {
    const point: [number, number, number] = [...sections.state.crosshair];
    point[AXES[name]] = coordinate;
    return point;
  };

  function show(options: { instant: boolean }) {
    instant = options.instant;
    open = true;
  }

  return {
    get open() {
      return open;
    },
    set open(value: boolean) {
      open = value;
    },
    get instant() {
      return instant;
    },
    set instant(value: boolean) {
      instant = value;
    },
    get plane() {
      return plane;
    },
    set plane(value: MprPlane) {
      plane = value;
    },
    /** The `mprOpen` question. */
    isOpen: () => open,
    /** The `showMri` port: S3 has loaded the scan (app.js:1406). */
    show,
    /** The lesson's prepared plane (sections.js:585-591): loads, and shows only if the step has not moved on. */
    async openPreparedPlane(name: MprPlane, canOpen: () => boolean) {
      if (!PLANES.includes(name)) throw new Error(`Unknown MRI plane: ${name}`);
      await sections.load();
      if (!canOpen()) return;
      plane = name;
      show({ instant: false });
    },
    /** The `closeMpr` port: `M` is a keyboard close. */
    close(options: { instant: boolean }) {
      instant = options.instant;
      open = false;
    },

    /** A slider, coalesced to one move a frame. */
    moveTo(name: MprPlane, coordinate: number) {
      schedule(`position-${name}`, () => selectPoint(along(name, coordinate)));
    },
    /** A click at a fraction of a panel's picture. */
    place(name: MprPlane, xFraction: number, yFraction: number) {
      const { fieldOfView } = sections.display!;
      selectPoint(pointOnPlane(sections.mprFrame(name), xFraction, yFraction, fieldOfView));
    },
    /** The wheel over a panel; false when the page should keep it. */
    wheel(name: MprPlane, deltaY: number): boolean {
      const next = wheelCoordinate(sections.state.crosshair[AXES[name]], deltaY);
      if (next === null) return false;
      selectPoint(along(name, next));
      return true;
    },
    /** Window and level, each from its own slider, coalesced to one call a frame. */
    setWindow(change: { center?: number; width?: number }) {
      windowChange = { ...windowChange, ...change };
      schedule('window', () => {
        const display = sections.display!;
        const { center = display.windowCenter, width = display.windowWidth } = windowChange!;
        windowChange = null;
        sections.setWindow(center, width);
      });
    },
    setOverlay(overlay: boolean) {
      sections.setDisplay({ overlay });
    },
    /** Hiding never downloads, so it cannot fail. */
    hideAgreement() {
      void sections.setAgreement(null);
    },
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      waiting.clear();
    },
  };
}

export type MprDialogController = ReturnType<typeof createMprDialog>;
