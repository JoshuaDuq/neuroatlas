import type { Orbit, ViewName } from '../../types/index.ts';
import type {
  CameraSnapshot,
  CameraView,
  EngineCamera,
  EngineSections,
  FramingClearance,
  Rect,
  Size,
  Vec3,
} from '../api.ts';
import type { FakeModel } from './model.ts';
import type { Emit } from './support.ts';

export interface FakeCameraOptions {
  model: FakeModel;
  sections: EngineSections;
  emit: Emit;
  hostSize: Size;
  /** The tract reference is shown: no orbit is linked (app.js:815). */
  referenceActive: () => boolean;
}

type Vector = [number, number, number];

/** camera-views.js:8: where each preset sits, as a direction from the target to the camera. */
const DIRECTIONS: Record<ViewName, Vector> = {
  oblique: [-1, 0.3, -0.45],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  anterior: [0, 0, -1],
  posterior: [0, 0, 1],
  superior: [0, 1, 0],
  inferior: [0, -1, 0],
};

/** camera-views.js:19. */
const upFor = (view: ViewName): Vector =>
  view === 'superior' ? [0, 0, -1] : view === 'inferior' ? [0, 0, 1] : [0, 1, 0];

/** camera-views.js:26: the preset that faces a cut's surface. */
const CUT_VIEWS = {
  sagittal: ['right', 'left'],
  coronal: ['anterior', 'posterior'],
  axial: ['superior', 'inferior'],
  oblique: ['oblique', 'oblique'],
} as const;

const DISTANCE_MM = 400;
const MAX_DISTANCE_MM = 2000;
const LETTERS = [
  ['R', 'L'],
  ['S', 'I'],
  ['P', 'A'],
] as const;

const normalize = (vector: Vector): Vector => {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length) as Vector;
};
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const distanceBetween = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** orientation.js:60: the letter of the axis most aligned with a direction. */
function letterFor(direction: Vector): 'R' | 'L' | 'S' | 'I' | 'P' | 'A' {
  let best: { axis: number; sign: 0 | 1; dot: number } = { axis: 0, sign: 0, dot: -Infinity };
  for (const axis of [0, 1, 2]) {
    for (const sign of [0, 1] as const) {
      const alignment = direction[axis]! * (sign === 0 ? 1 : -1);
      if (alignment > best.dot) best = { axis, sign, dot: alignment };
    }
  }
  return LETTERS[best.axis]![best.sign]!;
}

const OPPOSITE = { R: 'L', L: 'R', S: 'I', I: 'S', P: 'A', A: 'P' } as const;

/**
 * In-memory stand-in for the camera: it tracks a pose in millimetres, whether a named view is held, and
 * emits the same `camera`, `viewHeld`, `viewport` and `cameraSettled` events the real stage does after a
 * move. The fit is a fixed 400 mm and the scale bar a fixed 10 mm / 100 px, since nothing is drawn.
 */
export function createFakeCamera({
  model,
  sections,
  emit,
  hostSize,
  referenceActive,
}: FakeCameraOptions): EngineCamera {
  let position: Vector = [...DIRECTIONS.oblique].map((v) => v * DISTANCE_MM) as Vector;
  let target: Vector = [0, 0, 0];
  let up: Vector = [0, 1, 0];
  let held = false;
  let view = '' as string;
  let size: Size = { ...hostSize };
  let visibleRect: Rect = { x: 0, y: 0, ...hostSize };
  let framingSource: (() => FramingClearance) | null = null;
  let current: CameraView = describe();

  function describe(): CameraView {
    const forward = normalize(target.map((value, axis) => value - position[axis]!) as Vector);
    const right = normalize(cross(forward, up));
    const top = cross(right, forward);
    const rightLetter = letterFor(right);
    const topLetter = letterFor(top);
    return {
      edges: {
        right: rightLetter,
        left: OPPOSITE[rightLetter],
        top: topLetter,
        bottom: OPPOSITE[topLetter],
      },
      scale: size.height > 0 ? { millimetres: 10, pixels: 100 } : null,
    };
  }

  function moved() {
    current = describe();
    emit('camera', current);
    emit('cameraSettled', undefined);
  }

  function hold(next: boolean) {
    if (held === next) return;
    held = next;
    emit('viewHeld', { held });
  }

  const distance = () => distanceBetween(position, target);

  function face(name: ViewName) {
    const direction = normalize(DIRECTIONS[name]);
    position = target.map((value, axis) => value + direction[axis]! * DISTANCE_MM) as Vector;
    up = upFor(name);
    view = name;
  }

  function frameView(name: ViewName) {
    framingSource?.();
    face(name);
    hold(true);
    moved();
  }

  /** A framing that is not a preset: it moves the camera and leaves the held view. */
  function reframe() {
    hold(false);
    moved();
  }

  return {
    get viewHeld() {
      return held;
    },
    get visibleRect() {
      return { ...visibleRect };
    },
    get hostSize() {
      return { ...size };
    },
    get view() {
      return current;
    },

    setFramingSource(source) {
      framingSource = source;
    },
    setChromeInsets({ top = 0, right = 0, bottom = 0, left = 0 }) {
      visibleRect = {
        x: left,
        y: top,
        width: size.width - left - right,
        height: size.height - top - bottom,
      };
      emit('viewport', { visibleRect: { ...visibleRect }, hostSize: { ...size } });
    },
    refitDock() {
      framingSource?.();
      moved();
    },

    frameCurrent: (name) => frameView(name),
    applyView: (name) => frameView(name),
    frameRegions(ids) {
      if (!ids.some((id) => model.isRegionDrawn(id))) return;
      reframe();
    },
    frameRegion(id) {
      if (!model.isRegionDrawn(id)) return false;
      reframe();
      return true;
    },
    frameLandmark(regionId, name) {
      if (!model.isRegionDrawn(regionId)) return false;
      face(name);
      reframe();
      return true;
    },
    frameWhole: () => moved(),
    frameInternal: () => moved(),
    faceCut() {
      if (!sections.active) return null;
      const { mode, reverse } = sections.state;
      const name = CUT_VIEWS[mode as keyof typeof CUT_VIEWS][Number(reverse)]!;
      face(name);
      hold(mode !== 'oblique');
      moved();
      return name;
    },
    recenter() {
      target = [0, 0, 0];
    },
    fittedDistance: () => DISTANCE_MM,
    keepFraming(before) {
      if (!(before > 0) || before === DISTANCE_MM) return;
      const direction = normalize(position.map((value, axis) => value - target[axis]!) as Vector);
      const scaled = (distance() * DISTANCE_MM) / before;
      position = target.map((value, axis) => value + direction[axis]! * scaled) as Vector;
      moved();
    },
    focusPoint(point: Vec3) {
      const delta = point.map((value, axis) => value - target[axis]!);
      position = position.map((value, axis) => value + delta[axis]!) as Vector;
      target = [...point];
      reframe();
    },

    orbitBy() {
      reframe();
    },
    dolly(factor) {
      const direction = normalize(position.map((value, axis) => value - target[axis]!) as Vector);
      position = target.map(
        (value, axis) => value + direction[axis]! * distance() * factor,
      ) as Vector;
      reframe();
    },

    capture() {
      return Object.freeze({ position, target, up, held, view }) as unknown as CameraSnapshot;
    },
    restore(name, snapshot) {
      const saved = snapshot as unknown as {
        position: Vector;
        target: Vector;
        up: Vector;
        held: boolean;
      };
      ({ position, target, up } = saved);
      view = name;
      hold(saved.held);
      moved();
    },
    placeOrbit(orbit: Orbit) {
      if (distanceBetween(orbit.position, orbit.target) > MAX_DISTANCE_MM) {
        throw new RangeError(
          `Camera ${orbit.position} → ${orbit.target} mm is beyond the orbit limit of ${MAX_DISTANCE_MM} mm.`,
        );
      }
      position = [...orbit.position];
      target = [...orbit.target];
      up = orbit.up ? [...orbit.up] : upFor((view || 'oblique') as ViewName);
      reframe();
    },
    orbitLink() {
      if (held || referenceActive()) return null;
      const named = upFor((view || 'oblique') as ViewName);
      const differs = distanceBetween(up, named) > 1e-3;
      return { position: [...position], target: [...target], ...(differs ? { up: [...up] } : {}) };
    },
  };
}
