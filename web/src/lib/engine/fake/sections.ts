import type { CutMode, SurfaceColor } from '../../types/index.ts';
import { CUTS } from '../../types/index.ts';
import type {
  EngineSections,
  MprPlane,
  MriDisplay,
  MriWindow,
  PlaneFrame,
  SectionsState,
  Vec3,
} from '../api.ts';
import type { FakeModel } from './model.ts';
import { coded } from './support.ts';

export interface FakeSectionsOptions {
  model: FakeModel;
  /** Called after every state change, as the real sections' `change` event (sections.js:471). */
  changed: () => void;
  /** The linked MRI the fake serves once loaded; defaults to a 32-pixel field. */
  mri?: MriDisplay;
}

type Vector = [number, number, number];

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** coordinates.js:21. */
const BASES: Record<MprPlane, { normal: Vector; u: Vector; v: Vector; edges: string[] }> = {
  sagittal: { normal: [1, 0, 0], u: [0, -1, 0], v: [0, 0, 1], edges: ['S', 'P', 'I', 'A'] },
  coronal: { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], edges: ['S', 'R', 'I', 'L'] },
  axial: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], edges: ['A', 'R', 'P', 'L'] },
};

/** coordinates.js:36-65: the frame for a mode at a crosshair, centred on the plane's own axis. */
function centeredFrame(
  mode: CutMode | 'off',
  crosshair: Vec3,
  tilt: number,
  azimuth: number,
): PlaneFrame {
  let normal: Vector;
  let u: Vector;
  let v: Vector;
  let edges: string[] = [];
  if (mode === 'oblique') {
    if (
      ![tilt, azimuth].every(Number.isFinite) ||
      tilt < 0 ||
      tilt > 90 ||
      Math.abs(azimuth) > 180
    ) {
      throw new RangeError('Oblique angles are out of range.');
    }
    const t = (tilt * Math.PI) / 180;
    const a = (azimuth * Math.PI) / 180;
    normal = [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)];
    u = [-Math.sin(a), Math.cos(a), 0];
    v = cross(normal, u);
  } else {
    const basis = BASES[mode === 'off' ? 'axial' : (mode as MprPlane)];
    ({ normal, u, v, edges } = basis);
  }
  const along = dot(crosshair, normal);
  return { center: [normal[0] * along, normal[1] * along, normal[2] * along], normal, u, v, edges };
}

function projectBounds(
  bounds: readonly [Vector, Vector],
  normal: readonly number[],
): [number, number] {
  const [min, max] = bounds;
  const projections: number[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) projections.push(dot([x, y, z], normal));
    }
  }
  return [Math.min(...projections), Math.max(...projections)];
}

/**
 * In-memory stand-in for `BrainSections`: the plane, crosshair, window and cut atlas are real state with
 * the real validation; the cut itself draws nothing, and the linked MRI is a synthetic gradient.
 */
export function createFakeSections({ model, changed, mri }: FakeSectionsOptions): EngineSections {
  const manifest = model.manifest;
  const cutAtlases = new Set([
    ...manifest.atlases.map((atlas) => atlas.id),
    ...(manifest.cut_atlases ?? []).map((atlas) => atlas.id),
  ]);
  const state: { -readonly [K in keyof SectionsState]: SectionsState[K] } = {
    mode: 'off',
    cutAtlas: model.state.atlas,
    crosshair: [0, 0, 0],
    reverse: false,
    overlay: false,
    tilt: 30,
    azimuth: 30,
    status: 'idle',
    error: null,
  };
  let solids = false;
  let modeRequest = 0;
  let display: MriDisplay | null = null;
  const published: MriDisplay = mri ?? {
    fieldOfView: 256,
    size: 32,
    windowCenter: 100,
    windowWidth: 200,
  };
  const publishedWindow = { center: published.windowCenter, width: published.windowWidth };

  const active = () => state.mode !== 'off';
  const frame = () => centeredFrame(state.mode, state.crosshair, state.tilt, state.azimuth);

  /** sections.js:107: the cord's tail counts only while it is shown. */
  function coordinateBounds(): [Vector, Vector] {
    const bounds: [Vector, Vector] = [
      [-128, -128, -128],
      [128, 128, 128],
    ];
    for (const layer of manifest.supplemental_layers ?? []) {
      if (layer.id === 'pam50' && !model.state.spinalCordVisible) continue;
      for (let axis = 0; axis < 3; axis++) {
        bounds[0][axis] = Math.floor(Math.min(bounds[0][axis]!, layer.bounds_ras_mm[0]![axis]!));
        bounds[1][axis] = Math.ceil(Math.max(bounds[1][axis]!, layer.bounds_ras_mm[1]![axis]!));
      }
    }
    return bounds;
  }
  const coordinateLimit = () => Math.max(...coordinateBounds().flat().map(Math.abs));

  /** sections.js:133. */
  function offsetRange(): [number, number] {
    const bounds = coordinateBounds();
    if (state.mode === 'oblique') {
      const { normal } = frame();
      const [minimum, maximum] = projectBounds(bounds, normal);
      const reach = (coordinateLimit() / Math.max(...normal.map(Math.abs))) * (1 - 1e-12);
      return [Math.max(minimum, -reach), Math.min(maximum, reach)];
    }
    const axis = { sagittal: 0, coronal: 1, axial: 2, off: 2 }[state.mode];
    return [bounds[0][axis]!, bounds[1][axis]!];
  }

  /** A copy, so a listener comparing the last and next state sees a difference (sections.js:55 is live). */
  const snapshot = (): SectionsState => ({ ...state, crosshair: [...state.crosshair] });

  function emit() {
    model.setCutState({ atlas: state.cutAtlas, active: active() });
    changed();
  }

  function crosshairFor(offset: number): Vec3 {
    const [minimum, maximum] = offsetRange();
    if (!Number.isFinite(offset) || offset < minimum || offset > maximum) {
      throw new RangeError(`Cut position must be between ${minimum} and ${maximum} mm.`);
    }
    const { normal } = frame();
    // sections.js:297-299: an oblique crosshair is the plane's foot on its normal.
    const point = (
      state.mode === 'oblique'
        ? normal.map((component) => component * offset)
        : state.crosshair.map(
            (value, axis) => value + normal[axis]! * (offset - dot(state.crosshair, normal)),
          )
    ) as Vector;
    if (point.some((value) => Math.abs(value) > coordinateLimit())) {
      throw new RangeError(`RAS crosshair must be within ±${coordinateLimit()} mm.`);
    }
    return point;
  }

  function setCrosshair(point: Vec3) {
    if (
      !Array.isArray(point) ||
      point.length !== 3 ||
      point.some((value) => !Number.isFinite(value) || Math.abs(value) > coordinateLimit())
    ) {
      throw new RangeError(`RAS crosshair must be within ±${coordinateLimit()} mm.`);
    }
    state.crosshair = [...point] as Vector;
    emit();
  }

  function requireVolumes(): MriDisplay {
    if (!display) throw new Error('The linked MRI is not loaded.');
    return display;
  }

  return {
    get state() {
      return snapshot();
    },
    get active() {
      return active();
    },
    get solidsReady() {
      return solids;
    },
    get frame() {
      return frame();
    },
    get offsetRange() {
      return offsetRange();
    },
    get offset() {
      return dot(state.crosshair, frame().normal);
    },
    get volumesLoaded() {
      return display !== null;
    },
    get display() {
      return display && { ...display };
    },
    get publishedWindow() {
      return display ? { ...publishedWindow } : null;
    },
    mriWindowLink(): MriWindow | null {
      if (!display) return null;
      const same =
        display.windowCenter === publishedWindow.center &&
        display.windowWidth === publishedWindow.width;
      return same ? null : { center: display.windowCenter, width: display.windowWidth };
    },
    cutSpacingMm: () => 1,

    async load() {
      if (display) return;
      state.status = 'loading';
      changed();
      display = { ...published };
      state.status = 'ready';
      state.error = null;
      emit();
    },
    async setMode(mode) {
      if (!CUTS.includes(mode)) throw new Error(`Unknown cut mode: ${mode}`);
      const request = ++modeRequest;
      if (mode !== 'off') {
        await model.ensureEnvelopes();
        if (request !== modeRequest) return;
        solids = true;
      }
      state.mode = mode;
      state.status = 'ready';
      state.error = null;
      emit();
    },
    setCrosshair,
    setOffset: (offset) => setCrosshair(crosshairFor(offset)),
    async setOffsetReady(offset) {
      const point = crosshairFor(offset);
      state.crosshair = point;
      emit();
    },
    setAngles(tilt, azimuth) {
      centeredFrame('oblique', state.crosshair, tilt, azimuth);
      Object.assign(state, { tilt, azimuth });
      emit();
    },
    async setAnglesReady(tilt, azimuth) {
      centeredFrame('oblique', state.crosshair, tilt, azimuth);
      Object.assign(state, { tilt, azimuth });
      emit();
    },
    async setCutAtlas(atlas) {
      if (atlas === state.cutAtlas) return;
      if (active() && !cutAtlases.has(atlas)) {
        state.status = 'error';
        state.error = 'asset-fetch';
        changed();
        throw coded(`Cut atlas not published: ${atlas}`, 'asset-fetch');
      }
      state.cutAtlas = atlas;
      emit();
    },
    setDisplay({ reverse = state.reverse, overlay = state.overlay } = {}) {
      if (![reverse, overlay].every((value) => typeof value === 'boolean')) {
        throw new TypeError('Section display options must be boolean.');
      }
      Object.assign(state, { reverse, overlay });
      emit();
    },
    setWindow(center, width) {
      if (!display || !Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
        throw new RangeError('MRI window requires a finite center and positive width.');
      }
      display.windowCenter = center;
      display.windowWidth = width;
      emit();
    },
    async setSurfaceColor(mode: SurfaceColor, current = () => true) {
      // As the real engine: the colour loads the T1 alone, not the linked MRI's volumes.
      if (mode === 'mri') {
        state.status = 'loading';
        emit();
        await Promise.resolve();
        if (!current()) {
          state.status = 'ready';
          emit();
          return;
        }
        model.attachMri();
      }
      if (mode === 'functional') {
        model.loadGlassSolids();
        if (!current()) return;
      }
      model.applySurfaceColor(mode);
      state.status = 'ready';
      state.error = null;
      emit();
    },

    mprFrame: (plane) => centeredFrame(plane, state.crosshair, state.tilt, state.azimuth),
    pixels() {
      const { size } = requireVolumes();
      const pixels = new Uint8ClampedArray(size * size * 4);
      for (let index = 0; index < size * size; index++) {
        pixels.set([index % 256, (index * 3) % 256, (index * 7) % 256, 255], index * 4);
      }
      return pixels;
    },
    sample(point) {
      requireVolumes();
      const labelId = Math.abs(Math.round(point[0])) % 4;
      return {
        labelId,
        name: labelId ? `label-${labelId}` : 'Unknown',
        region: undefined,
        intensity: Math.abs(point[2]),
        ras: point,
      };
    },
  };
}
