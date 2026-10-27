import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { Box3, BoxGeometry, Mesh, Sphere, Vector3 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { CutMode, ModelState, Region } from '../types/index.ts';
import { createFraming } from './framing.ts';
import type { Framing, FramingModel } from './framing.ts';
import { createHeldView } from './held-view.ts';
import type { AtlasMesh } from './model/brain-atlas.ts';
import { createFrame, rasToWorld } from './slices/coordinates.ts';
import type { Frame } from './slices/coordinates.ts';
import { ORBIT_ROUNDING_MM } from '../core/state/url-state.ts';
import { FRAME_FILL, VIEW_DIRECTIONS, upFor, withContext } from './render/camera-views.ts';
import { createScene } from './render/scene.ts';
import type { EngineScene } from './render/scene.ts';

// Only the renderer is replaced, since it needs a GL context. The animation loop is the test's to turn.
const fakes = vi.hoisted(() => ({
  loop: null as ((now: number) => void) | null,
  observers: [] as (() => void)[],
}));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = Object.assign(new EventTarget(), {
      style: {} as Record<string, string>,
      tabIndex: -1,
      clientHeight: 600,
      setAttribute() {},
      remove() {},
      ownerDocument: new EventTarget(),
      getRootNode: () => new EventTarget(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    });
    ratio = 1;
    toneMapping = 0;
    getContext = () => null;
    setPixelRatio = (ratio: number) => {
      this.ratio = ratio;
    };
    getPixelRatio = () => this.ratio;
    setSize() {}
    initRenderTarget() {}
    setAnimationLoop = (loop: ((now: number) => void) | null) => {
      fakes.loop = loop;
    };
    dispose() {}
    forceContextLoss() {}
  }
  return { ...original, WebGLRenderer: FakeRenderer };
});

beforeEach(() => {
  fakes.observers = [];
  vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(() => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        fakes.observers.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('document', { documentElement: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const STATE = {
  cortexVisible: true,
  hemisphere: 'both',
  spinalCordVisible: false,
  internalSystem: null,
  isolatedRegion: null,
} as unknown as ModelState;

/** A real scene and framing over a brain-sized box, with the phone's stage at first. */
function fixture({
  meshes = [] as AtlasMesh[],
  state = {} as Partial<ModelState>,
  regions = new Map<string, Region>(),
  scale = { horizontal: 1, vertical: 0.45 },
} = {}) {
  const bounds = new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1));
  let size = { width: 390, height: 792 };
  const host = {
    prepend() {},
    getBoundingClientRect: () => size,
  } as unknown as HTMLElement;
  let framing: Framing | null = null;
  const scene: EngineScene = createScene(host, { onResize: (change) => framing?.onResize(change) });
  const model: FramingModel = {
    state: { ...STATE, ...state },
    visibleMeshes: meshes,
    regions,
  };
  const sections = {
    active: false,
    frame: undefined as never,
    state: { mode: 'off', reverse: false },
  } as { active: boolean; frame: Frame; state: { mode: CutMode; reverse: boolean } };
  const reference: { active: boolean; bounds: Box3 | null } = { active: false, bounds: null };
  const events: string[] = [];
  const held = createHeldView({
    controls: scene.controls,
    host: new EventTarget() as unknown as HTMLElement,
    onChange() {},
  });
  framing = createFraming({
    scene,
    model,
    sections,
    held,
    bounds,
    reference,
    emit: (type) => {
      events.push(type);
    },
  });
  scene.setSize();
  let source: {
    inset: { bottom?: number; right?: number };
    scale: { horizontal: number; vertical: number };
  } = {
    inset: {},
    scale,
  };
  framing.camera.setFramingSource(() => source);
  const assertBrainFits = () => {
    // The scene refreshes the camera's matrices when it draws; there is no frame here.
    scene.camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new Vector3(x, y, z).project(scene.camera);
          assert.ok(
            Math.abs(projected.x) <= FRAME_FILL + 1e-9,
            'brain stays inside the horizontal frame',
          );
          assert.ok(
            Math.abs(projected.y) <= FRAME_FILL + 1e-9,
            'brain stays inside the vertical frame',
          );
        }
      }
    }
  };
  return {
    scene,
    framing,
    camera: framing.camera,
    held,
    sections,
    reference,
    events,
    bounds,
    assertBrainFits,
    /** The clearance the dock and sheet leave, as the interface reports it. */
    setSource(next: typeof source) {
      source = next;
    },
    /** The stage changes shape and the dock leaves it all the room. */
    resize(width: number, height: number) {
      size = { width, height };
      source = { inset: {}, scale: { horizontal: 1, vertical: 1 } };
      for (const callback of fakes.observers) callback();
    },
    /** Run the camera's eased move to its end. */
    finish() {
      fakes.loop!(performance.now() + 1000);
    },
    distance: () => scene.destination.position.distanceTo(scene.destination.target),
  };
}

// The cases of legacy app.test.js:88-215, as behaviour of the real scene and framing rather than as
// source slices of app.js and scene.js.
describe('viewport framing (ported from app.test.js)', () => {
  it('Reset view replaces an earlier close zoom across a phone-to-desktop resize', () => {
    const stage = fixture();
    stage.camera.applyView('left', { immediate: true });
    const { target } = stage.scene.destination;
    stage.camera.placeOrbit(
      {
        position: [target.x * 1000 - 60, target.y * 1000, target.z * 1000],
        target: [target.x * 1000, target.y * 1000, target.z * 1000],
      },
      { immediate: true },
    );
    stage.camera.recenter();
    stage.camera.applyView('oblique', { immediate: true });
    stage.assertBrainFits();
    stage.resize(537, 695);
    stage.assertBrainFits();
  });

  it('named view presets replace an earlier close zoom before the next resize', () => {
    for (const view of ['left', 'superior'] as const) {
      const stage = fixture();
      stage.camera.applyView('anterior', { immediate: true });
      stage.camera.dolly(0.2);
      stage.camera.applyView(view, { immediate: true });
      stage.assertBrainFits();
      stage.resize(537, 695);
      stage.assertBrainFits();
    }
  });

  it('resizing during an animated Reset cancels the old viewport endpoint', () => {
    const stage = fixture();
    stage.camera.applyView('left', { immediate: true });
    stage.camera.recenter();
    stage.camera.applyView('oblique');
    stage.resize(537, 695);
    const position = stage.scene.camera.position.clone();
    const target = stage.scene.controls.target.clone();
    stage.finish();
    // The controls' own update, which runs once the move is over, may round the last digit.
    assert.ok(
      stage.scene.camera.position.distanceTo(position) < 1e-12,
      'the phone-fit tween cannot overwrite the resized frame',
    );
    assert.ok(stage.scene.controls.target.distanceTo(target) < 1e-12);
    stage.assertBrainFits();
  });

  it('refuses a view the camera does not publish, leaving the camera where it was', () => {
    const stage = fixture();
    stage.camera.applyView('left', { immediate: true });
    const before = stage.scene.destination.position.toArray();
    assert.throws(() => stage.camera.applyView('missing' as never), /Unknown view: missing/);
    assert.deepEqual(stage.scene.destination.position.toArray(), before);
  });
});

function region(id: string, size: [number, number, number], at: [number, number, number]) {
  const mesh = new Mesh(new BoxGeometry(...size)) as unknown as AtlasMesh;
  mesh.position.set(...at);
  mesh.updateMatrixWorld();
  mesh.userData['region_id'] = id;
  return mesh;
}

/** The brain's own box, and one small region within it: framing the region takes the camera close. */
const drawn = () => [
  region('brain', [0.15, 0.17, 0.19], [0, 0.02, 0]),
  region('small', [0.01, 0.01, 0.01], [0.03, 0.02, 0]),
];

describe('the magnification after a framing (deviation e7-zoom-after-framing)', () => {
  it('keeps the distance Focus chose when the stage next resizes', () => {
    const stage = fixture({ meshes: drawn() });
    stage.camera.applyView('left', { immediate: true });
    const whole = stage.distance();
    assert.equal(stage.camera.frameRegion('small', { immediate: true }), true);
    const focused = stage.distance();
    assert.ok(focused < whole / 2, 'Focus came in close');
    // Legacy re-fitted the whole brain times the stale magnification of 1 here, jumping back out.
    stage.resize(390, 792);
    assert.ok(Math.abs(stage.distance() - focused) < 1e-12);
  });

  it('keeps the distance of a landmark when the stage next resizes', () => {
    const stage = fixture({ meshes: drawn() });
    stage.camera.applyView('left', { immediate: true });
    assert.equal(stage.camera.frameLandmark('small', 'anterior', 5, { immediate: true }), true);
    const landmark = stage.distance();
    stage.resize(390, 792);
    assert.ok(Math.abs(stage.distance() - landmark) < 1e-12);
  });
});

describe('the heading of a move in flight (deviation e7-heading-in-flight)', () => {
  it('frames the whole brain along the heading the eased move is going to', () => {
    const stage = fixture();
    stage.camera.applyView('right', { immediate: true });
    stage.camera.applyView('left');
    // The camera has not moved a frame: reading it would give the old heading.
    stage.camera.frameWhole();
    const { position, target } = stage.scene.destination;
    const heading = position.clone().sub(target).normalize();
    assert.ok(heading.distanceTo(VIEW_DIRECTIONS.left) < 1e-9);
  });

  it('captures the destination of an eased move, not the camera half-way', () => {
    const stage = fixture();
    stage.camera.applyView('right', { immediate: true });
    stage.camera.applyView('left');
    const snapshot = stage.camera.capture();
    stage.camera.applyView('anterior', { immediate: true });
    stage.camera.restore('left', snapshot, { immediate: true });
    const { position, target } = stage.scene.destination;
    assert.ok(position.clone().sub(target).normalize().distanceTo(VIEW_DIRECTIONS.left) < 1e-9);
  });
});

// A synthetic brain whose boxes sit just inside the fixture's bounds (vertices on the edge fall out of the box in float32), with the user data framing reads.
function part(
  id: string,
  userData: Record<string, unknown>,
  size: [number, number, number],
  at: [number, number, number],
) {
  const mesh = region(id, size, at);
  Object.assign(mesh.userData, userData);
  return mesh;
}
const leftCortex = () =>
  part('ctx:left', { atlas: 'destrieux', kind: 'cortex' }, [0.079, 0.179, 0.199], [-0.04, 0.02, 0]);
const rightCortex = () =>
  part('ctx:right', { atlas: 'destrieux', kind: 'cortex' }, [0.079, 0.179, 0.199], [0.04, 0.02, 0]);
const caudate = () =>
  part('caudate', { atlas: 'aseg', kind: 'structure' }, [0.02, 0.03, 0.04], [-0.015, 0.03, 0.01]);
const thalamus = () =>
  part('thalamus', { atlas: 'aseg', kind: 'structure' }, [0.03, 0.03, 0.03], [0.015, 0.01, -0.01]);
const cord = () =>
  part('cord', { atlas: 'zanatomy', kind: 'structure' }, [0.012, 0.45, 0.02], [0, -0.3, 0.03]);
const wholeBrain = () => [leftCortex(), rightCortex(), caudate(), thalamus()];

/** How far from the centre of the frame the meshes' vertices project, on each axis. */
function reachOf(stage: ReturnType<typeof fixture>, meshes: readonly AtlasMesh[]) {
  stage.scene.camera.updateMatrixWorld();
  const reach = { x: 0, y: 0 };
  const point = new Vector3();
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes['position']!;
    for (let i = 0; i < position.count; i++) {
      point
        .fromBufferAttribute(position, i)
        .applyMatrix4(mesh.matrixWorld)
        .project(stage.scene.camera);
      reach.x = Math.max(reach.x, Math.abs(point.x));
      reach.y = Math.max(reach.y, Math.abs(point.y));
    }
  }
  return reach;
}

/** The anatomy fits when nothing is past FRAME_FILL, and is framed tight when something reaches it. */
function assertFramed(
  stage: ReturnType<typeof fixture>,
  meshes: readonly AtlasMesh[],
  tight = true,
) {
  const { x, y } = reachOf(stage, meshes);
  assert.ok(x <= FRAME_FILL + 1e-6 && y <= FRAME_FILL + 1e-6, `reach ${x}, ${y}`);
  if (tight) assert.ok(Math.max(x, y) >= FRAME_FILL - 1e-6, `framed loosely: ${x}, ${y}`);
}

/** The orbit target is the centre of the box framed (the vertices are float32). */
const assertTarget = (stage: ReturnType<typeof fixture>, centre: [number, number, number]) => {
  const { target } = stage.scene.destination;
  assert.ok(target.distanceTo(new Vector3(...centre)) < 1e-9, `target ${target.toArray()}`);
};

const headingOf = (stage: ReturnType<typeof fixture>) => {
  const { position, target } = stage.scene.destination;
  return position.clone().sub(target).normalize();
};

const FULL = { horizontal: 1, vertical: 1 };

describe('framing a named view', () => {
  it('FACADE-01 every named view looks from its direction, with its up, filling the room and held', () => {
    for (const view of Object.keys(VIEW_DIRECTIONS) as (keyof typeof VIEW_DIRECTIONS)[]) {
      const meshes = wholeBrain();
      const stage = fixture({ meshes, scale: FULL });
      stage.camera.applyView(view, { immediate: true });
      // The controls hold a camera on the superior axis a millionth of a radian off it.
      const tolerance = view === 'superior' || view === 'inferior' ? 2e-6 : 1e-9;
      assert.ok(headingOf(stage).distanceTo(VIEW_DIRECTIONS[view]) < tolerance, view);
      assert.ok(stage.scene.camera.up.distanceTo(upFor(view)) < 1e-12, view);
      assertFramed(stage, meshes);
      assert.equal(stage.camera.viewHeld, true, view);
    }
  });

  it('FACADE-01 the room the interface leaves, not the whole canvas, is what the anatomy fills', () => {
    const meshes = wholeBrain();
    const stage = fixture({ meshes, scale: { horizontal: 0.5, vertical: 1 } });
    stage.camera.applyView('left', { immediate: true });
    const { x } = reachOf(stage, meshes);
    assert.ok(Math.abs(x - 0.4) < 1e-6, `horizontal reach ${x}`);
  });
});

describe('the whole anatomy is what is drawn', () => {
  it('FACADE-04 both hemispheres fit the opening brain box', () => {
    const meshes = wholeBrain();
    const stage = fixture({ meshes, scale: FULL });
    stage.camera.applyView('anterior', { immediate: true });
    assertFramed(stage, meshes);
  });

  it('FACADE-04 one hemisphere is framed on its own, closer than both', () => {
    const both = fixture({ meshes: wholeBrain(), scale: FULL });
    both.camera.applyView('anterior', { immediate: true });
    const meshes = [leftCortex(), caudate()];
    const left = fixture({ meshes, state: { hemisphere: 'left' }, scale: FULL });
    left.camera.applyView('anterior', { immediate: true });
    assertFramed(left, meshes);
    assert.ok(left.distance() < both.distance());
  });

  it('FACADE-04 the cord shown beneath the brain is framed together with it', () => {
    const meshes = [...wholeBrain(), cord()];
    const stage = fixture({ meshes, state: { spinalCordVisible: true }, scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    assertFramed(stage, meshes);
    const lowest = stage.scene.camera.worldToLocal(new Vector3(0, -0.525, 0.03));
    assert.ok(lowest.z < 0, 'the cord’s lowest vertex is in front of the camera');
  });

  it('FACADE-04 the cord system on its own frames the cord', () => {
    const meshes = [...wholeBrain(), cord()];
    const stage = fixture({
      meshes,
      state: { spinalCordVisible: true, internalSystem: 'Spinal cord' },
      scale: FULL,
    });
    stage.camera.applyView('left', { immediate: true });
    stage.camera.frameWhole();
    stage.finish();
    assertFramed(stage, [meshes[4]!]);
  });

  it('FACADE-04 an isolated region is framed on its own', () => {
    const drawnMeshes = [caudate()];
    const stage = fixture({
      meshes: drawnMeshes,
      state: { isolatedRegion: 'caudate' },
      scale: FULL,
    });
    stage.camera.applyView('left', { immediate: true });
    assertFramed(stage, drawnMeshes);
    // The box framed is the region's own, not the whole brain's.
    assertTarget(stage, [-0.015, 0.03, 0.01]);
  });

  it('FACADE-04 with the cortex hidden, the drawn structures are framed and the cord is not', () => {
    const structures = [caudate(), thalamus()];
    const stage = fixture({
      meshes: [...structures, cord()],
      state: { cortexVisible: false },
      scale: FULL,
    });
    stage.camera.applyView('left', { immediate: true });
    assertFramed(stage, structures);
    // The structures' box, with the cord (down to y = -0.525) left out.
    assertTarget(stage, [0.0025, 0.02, 0.0025]);
  });

  it('FACADE-04 the tract reference shown alone frames its streamlines once loaded', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    const streamlines = new Box3(new Vector3(-0.04, -0.03, -0.06), new Vector3(0.04, 0.03, 0.06));
    stage.reference.active = true;
    stage.reference.bounds = streamlines;
    stage.framing.onReference();
    stage.scene.camera.updateMatrixWorld();
    let reach = 0;
    for (const x of [-0.04, 0.04]) {
      for (const y of [-0.03, 0.03]) {
        for (const z of [-0.06, 0.06]) {
          const point = new Vector3(x, y, z).project(stage.scene.camera);
          reach = Math.max(reach, Math.abs(point.x), Math.abs(point.y));
        }
      }
    }
    // Faced from above, the controls hold the camera a millionth of a radian off the superior axis.
    assert.ok(Math.abs(reach - FRAME_FILL) < 1e-6, `reach ${reach}`);
  });
});

describe('framing parts of the anatomy', () => {
  const regions = new Map<string, Region>([
    ['small', { id: 'small', hemisphere: 'left' } as Region],
    ['also', { id: 'also', hemisphere: 'left' } as Region],
  ]);
  const small = () =>
    part('small', { atlas: 'aseg', kind: 'structure' }, [0.01, 0.01, 0.01], [-0.03, 0.02, 0]);
  const also = () =>
    part('also', { atlas: 'aseg', kind: 'structure' }, [0.012, 0.01, 0.01], [-0.02, 0.03, 0.01]);

  it('FACADE-05 focusing a region frames it along the current heading and lets go of the view', () => {
    const meshes = [...wholeBrain(), small()];
    const stage = fixture({ meshes, scale: FULL });
    stage.camera.applyView('anterior', { immediate: true });
    assert.equal(stage.camera.viewHeld, true);
    assert.equal(stage.camera.frameRegion('small', { immediate: true }), true);
    assertFramed(stage, [meshes[4]!]);
    assert.ok(headingOf(stage).distanceTo(VIEW_DIRECTIONS.anterior) < 1e-9);
    assert.equal(stage.camera.viewHeld, false);
  });

  it('FACADE-05 a region with nothing drawn changes nothing and says so', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const before = stage.scene.destination.position.toArray();
    assert.equal(stage.camera.frameRegion('nowhere', { immediate: true }), false);
    assert.deepEqual(stage.scene.destination.position.toArray(), before);
    assert.equal(stage.camera.viewHeld, true);
  });

  it('FACADE-06 a landmark is framed from its authored view with its authored margin', () => {
    const meshes = [...wholeBrain(), small()];
    const stage = fixture({ meshes, scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    assert.equal(stage.camera.frameLandmark('small', 'anterior', 20, { immediate: true }), true);
    assert.ok(headingOf(stage).distanceTo(VIEW_DIRECTIONS.anterior) < 1e-9);
    assert.equal(stage.camera.viewHeld, false);
    // The region box grown by 20 mm, then given its context, is what fills the room.
    const box = new Box3().setFromObject(meshes[4]!).expandByScalar(0.02);
    const grown = withContext(box);
    stage.scene.camera.updateMatrixWorld();
    let reach = 0;
    for (const x of [grown.min.x, grown.max.x]) {
      for (const y of [grown.min.y, grown.max.y]) {
        for (const z of [grown.min.z, grown.max.z]) {
          const point = new Vector3(x, y, z).project(stage.scene.camera);
          reach = Math.max(reach, Math.abs(point.x), Math.abs(point.y));
        }
      }
    }
    assert.ok(Math.abs(reach - FRAME_FILL) < 1e-9, `reach ${reach}`);
    assert.equal(stage.camera.frameLandmark('nowhere', 'anterior', 20), false);
  });

  it('FACADE-07 a deficit on one side is framed from that side, and nothing drawn is no move', () => {
    const meshes = [...wholeBrain(), small(), also()];
    const stage = fixture({ meshes, regions, scale: FULL });
    stage.camera.applyView('right', { immediate: true });
    stage.events.length = 0;
    stage.camera.frameRegions(['small', 'also']);
    assert.ok(headingOf(stage).x < 0, 'the camera swung to the left hemisphere’s side');
    assert.equal(stage.camera.viewHeld, false);
    stage.camera.applyView('right', { immediate: true });
    stage.events.length = 0;
    stage.camera.frameRegions(['no-such-region']);
    assert.deepEqual(stage.events, []);
    assert.equal(stage.camera.viewHeld, true);
  });

  it('FACADE-08 pulling back and the internal frame keep the heading and the held view', () => {
    const meshes = [...wholeBrain(), cord()];
    const stage = fixture({ meshes, state: { spinalCordVisible: true }, scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    stage.camera.frameInternal();
    assert.ok(headingOf(stage).distanceTo(VIEW_DIRECTIONS.left) < 1e-9);
    assert.equal(stage.camera.viewHeld, true);
    // The cord is left out: the internal frame centres on the structures, above the brain's lower bound.
    assert.ok(stage.scene.destination.target.y > stage.bounds.min.y);
    stage.camera.frameWhole();
    assert.ok(headingOf(stage).distanceTo(VIEW_DIRECTIONS.left) < 1e-9);
    assert.equal(stage.camera.viewHeld, true);
  });

  it('FACADE-10 focusing a point keeps the distance and heading, and lets go of the view', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const before = stage.scene.destination;
    stage.camera.focusPoint([21, 37, 49]);
    const after = stage.scene.destination;
    assert.ok(after.target.distanceTo(new Vector3(0.021, 0.049, -0.037)) < 1e-12);
    const delta = after.target.clone().sub(before.target);
    assert.ok(after.position.clone().sub(before.position).distanceTo(delta) < 1e-12);
    assert.equal(stage.camera.viewHeld, false);
    assert.equal(after.minDistance, before.minDistance);
  });

  it('FACADE-10 a point below the brain, on the cord, allows a closer approach of 15 mm', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const { minDistance } = stage.scene.destination;
    assert.ok(minDistance > 0.015);
    stage.camera.focusPoint([0, 0, -200]);
    assert.equal(stage.scene.destination.minDistance, 0.015);
  });
});

describe('facing the cut', () => {
  const faceWith = (mode: CutMode, reverse: boolean, crosshair: [number, number, number]) => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.sections.active = true;
    stage.sections.frame = createFrame(mode, crosshair);
    stage.sections.state = { mode, reverse };
    return stage;
  };

  it('FACADE-09 with no cut there is nothing to face', () => {
    const stage = fixture({ meshes: wholeBrain() });
    assert.equal(stage.camera.faceCut(), null);
  });

  it('FACADE-09 a coronal cut is faced from the front, or from behind when reversed, and held', () => {
    const front = faceWith('coronal', false, [0, 0, 0]);
    assert.equal(front.camera.faceCut({ immediate: true }), 'anterior');
    assert.ok(headingOf(front).distanceTo(new Vector3(0, 0, -1)) < 1e-9);
    assert.equal(front.camera.viewHeld, true);
    const behind = faceWith('coronal', true, [0, 0, 0]);
    assert.equal(behind.camera.faceCut({ immediate: true }), 'posterior');
    assert.ok(headingOf(behind).distanceTo(new Vector3(0, 0, 1)) < 1e-9);
  });

  it('FACADE-09 an oblique cut is faced along its own normal and releases the view', () => {
    const stage = faceWith('oblique', false, [0, 0, 0]);
    stage.camera.applyView('left', { immediate: true });
    assert.equal(stage.camera.faceCut({ immediate: true }), 'oblique');
    assert.equal(stage.camera.viewHeld, false);
    const normal = rasToWorld(stage.sections.frame.normal.toArray()).normalize();
    assert.ok(headingOf(stage).distanceTo(normal) < 1e-9);
  });

  it('FACADE-09 a cut through the cord, below the brain, is framed in an 8 cm box around its centre', () => {
    const stage = faceWith('axial', false, [0, 0, -200]);
    stage.camera.faceCut({ immediate: true });
    assert.ok(stage.scene.destination.target.distanceTo(new Vector3(0, -0.2, 0)) < 1e-12);
    stage.scene.camera.updateMatrixWorld();
    let reach = 0;
    for (const x of [-0.04, 0.04]) {
      for (const y of [-0.24, -0.16]) {
        for (const z of [-0.04, 0.04]) {
          const point = new Vector3(x, y, z).project(stage.scene.camera);
          reach = Math.max(reach, Math.abs(point.x), Math.abs(point.y));
        }
      }
    }
    // Faced from above, the controls hold the camera a millionth of a radian off the superior axis.
    assert.ok(Math.abs(reach - FRAME_FILL) < 1e-6, `reach ${reach}`);
  });
});

describe('the reader’s magnification', () => {
  it('FACADE-11 a resize keeps the reader’s multiple of the fitted distance', () => {
    const stage = fixture({ meshes: wholeBrain() });
    stage.camera.applyView('left', { immediate: true });
    const { target } = stage.scene.destination;
    stage.camera.placeOrbit(
      {
        position: [target.x * 1000 - 120, target.y * 1000, target.z * 1000],
        target: target.toArray().map((value) => value * 1000) as [number, number, number],
      },
      { immediate: true },
    );
    const before = stage.camera.fittedDistance();
    const distance = stage.distance();
    stage.resize(537, 695);
    const expected = stage.camera.fittedDistance() * (distance / before);
    assert.ok(Math.abs(stage.distance() - expected) < 1e-12);
  });

  it('FACADE-12 every framing command updates the magnification the next resize keeps', () => {
    const meshes = [...wholeBrain(), cord()];
    const commands: [string, (stage: ReturnType<typeof fixture>) => void][] = [
      ['frameRegions', (stage) => stage.camera.frameRegions(['thalamus'])],
      ['frameInternal', (stage) => stage.camera.frameInternal()],
      ['frameWhole', (stage) => stage.camera.frameWhole()],
      [
        'faceCut',
        (stage) => {
          stage.sections.active = true;
          stage.sections.frame = createFrame('coronal', [0, 0, 0]);
          stage.sections.state = { mode: 'coronal', reverse: false };
          stage.camera.faceCut({ immediate: true });
        },
      ],
    ];
    for (const [name, command] of commands) {
      const stage = fixture({ meshes: structuredCloneMeshes(meshes) });
      stage.camera.applyView('left', { immediate: true });
      // Magnified, so the command's own fit differs from the one the view left behind.
      stage.camera.dolly(0.5);
      command(stage);
      const chosen = stage.distance();
      stage.resize(390, 792);
      assert.ok(Math.abs(stage.distance() - chosen) < 1e-12, name);
    }
  });
});

/** Fresh meshes of the same shapes, so a stage's draw does not share state with another's. */
function structuredCloneMeshes(meshes: AtlasMesh[]) {
  return meshes.map((mesh) => {
    const copy = mesh.clone();
    copy.userData = { ...mesh.userData };
    copy.updateMatrixWorld();
    return copy as AtlasMesh;
  });
}

describe('a dock or sheet change', () => {
  it('FACADE-15 keeps heading and target and scales the distance by the new fit over the old', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const before = stage.camera.fittedDistance();
    const start = stage.scene.destination;
    const distance = start.position.distanceTo(start.target);
    stage.setSource({ inset: { right: 100 }, scale: FULL });
    stage.camera.keepFraming(before);
    const after = stage.camera.fittedDistance();
    assert.ok(after > before);
    const end = stage.scene.destination;
    assert.ok(Math.abs(end.position.distanceTo(end.target) - (distance * after) / before) < 1e-12);
    assert.ok(end.target.distanceTo(start.target) < 1e-12);
    assert.ok(headingOf(stage).distanceTo(VIEW_DIRECTIONS.left) < 1e-9);
  });

  it('FACADE-15 while a gesture is down the refit waits for the lift', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const before = stage.camera.fittedDistance();
    const start = stage.scene.destination.position.clone();
    stage.scene.controls.dispatchEvent({ type: 'start' });
    stage.setSource({ inset: { right: 100 }, scale: FULL });
    stage.camera.keepFraming(before);
    stage.camera.refitDock();
    assert.deepEqual(stage.scene.destination.position.toArray(), start.toArray());
    stage.scene.controls.dispatchEvent({ type: 'end' });
    stage.finish();
    assert.ok(stage.scene.destination.position.distanceTo(start) > 1e-3);
  });

  it('FACADE-17 a pan is limited to the sphere of what is drawn until any framing lifts the limit', () => {
    const meshes = wholeBrain();
    const stage = fixture({ meshes, scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const sphere = stage.bounds.getBoundingSphere(new Sphere());
    stage.scene.controls.dispatchEvent({ type: 'start' });
    const { cursor, maxTargetRadius } = stage.scene.controls as unknown as {
      cursor: Vector3;
      maxTargetRadius: number;
    };
    assert.ok(cursor.distanceTo(sphere.center) < 1e-12);
    assert.ok(Math.abs(maxTargetRadius - sphere.radius) < 1e-12);
    stage.camera.applyView('right', { immediate: true });
    assert.equal(
      (stage.scene.controls as unknown as { maxTargetRadius: number }).maxTargetRadius,
      Infinity,
    );
  });

  it('FACADE-17 a centre already beyond the sphere is held where it is, not pulled in', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const sphere = stage.bounds.getBoundingSphere(new Sphere());
    stage.scene.controls.target.copy(sphere.center).add(new Vector3(0.5, 0, 0));
    stage.scene.controls.dispatchEvent({ type: 'start' });
    const radius = (stage.scene.controls as unknown as { maxTargetRadius: number }).maxTargetRadius;
    assert.ok(Math.abs(radius - 0.5) < 1e-12);
  });
});

describe('the camera as a link carries it', () => {
  it('FACADE-24 a held view has no orbit link, and otherwise the link is the metres times a thousand', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    assert.equal(stage.camera.orbitLink(), null);
    stage.camera.orbitBy({ azimuth: Math.PI / 36 });
    const orbit = stage.camera.orbitLink()!;
    const { position, target } = stage.scene.destination;
    assert.ok(
      orbit.position.every((value, axis) => Object.is(value, position.getComponent(axis) * 1000)),
    );
    assert.ok(
      orbit.target.every((value, axis) => Object.is(value, target.getComponent(axis) * 1000)),
    );
    assert.equal('up' in orbit, false);
  });

  it('FACADE-24 the up vector travels only when it leans more than 1e-3 from the view’s up', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    stage.camera.orbitBy({});
    stage.scene.camera.up.x += 0.0009;
    assert.equal('up' in stage.camera.orbitLink()!, false);
    stage.scene.camera.up.x += 0.0002;
    assert.deepEqual(stage.camera.orbitLink()!.up, stage.scene.camera.up.toArray());
  });

  it('FACADE-24 the tract reference shown alone has no orbit link', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    stage.camera.orbitBy({});
    stage.reference.active = true;
    assert.equal(stage.camera.orbitLink(), null);
  });

  it('FACADE-25 a camera written at the orbit limit is placed, widening the limit only as far as needed', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const { maxDistance, target } = stage.scene.destination;
    const at = (millimetres: number) => ({
      position: [target.x * 1000 - millimetres, target.y * 1000, target.z * 1000] as [
        number,
        number,
        number,
      ],
      target: target.toArray().map((value) => value * 1000) as [number, number, number],
    });
    const distance = maxDistance * 1000 + ORBIT_ROUNDING_MM / 2;
    stage.camera.placeOrbit(at(distance), { immediate: true });
    assert.ok(Math.abs(stage.scene.destination.maxDistance * 1000 - distance) < 1e-9);
    assert.equal(stage.camera.viewHeld, false);
    const orbit = stage.camera.orbitLink()!;
    assert.ok(Math.abs(orbit.position[0] - at(distance).position[0]) < 1e-3);
  });

  it('FACADE-25 a camera beyond the limit by more than the link’s rounding is refused and nothing moves', () => {
    const stage = fixture({ meshes: wholeBrain(), scale: FULL });
    stage.camera.applyView('left', { immediate: true });
    const { maxDistance, target, position } = stage.scene.destination;
    assert.throws(
      () =>
        stage.camera.placeOrbit(
          {
            position: [target.x * 1000 - (maxDistance * 1000 + 2 * ORBIT_ROUNDING_MM), 0, 0],
            target: target.toArray().map((value) => value * 1000) as [number, number, number],
          },
          { immediate: true },
        ),
      RangeError,
    );
    assert.deepEqual(stage.scene.destination.position.toArray(), position.toArray());
    assert.equal(stage.camera.viewHeld, true);
  });
});
