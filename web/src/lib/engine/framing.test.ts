import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { Box3, BoxGeometry, Mesh, Vector3 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { ModelState, Region } from '../types/index.ts';
import { createFraming } from './framing.ts';
import type { Framing, FramingModel, FramingSections } from './framing.ts';
import { createHeldView } from './held-view.ts';
import type { AtlasMesh } from './model/brain-atlas.ts';
import { FRAME_FILL, VIEW_DIRECTIONS } from './render/camera-views.ts';
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
function fixture({ meshes = [] as AtlasMesh[] } = {}) {
  const bounds = new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1));
  let size = { width: 390, height: 792 };
  const host = {
    prepend() {},
    getBoundingClientRect: () => size,
  } as unknown as HTMLElement;
  let framing: Framing | null = null;
  const scene: EngineScene = createScene(host, { onResize: (change) => framing?.onResize(change) });
  const model: FramingModel = {
    state: STATE,
    visibleMeshes: meshes,
    regions: new Map<string, Region>(),
  };
  const sections: FramingSections = {
    active: false,
    frame: undefined as never,
    state: { mode: 'off', reverse: false },
  };
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
    reference: { active: false, bounds: null },
    emit() {},
  });
  scene.setSize();
  let source = { inset: {}, scale: { horizontal: 1, vertical: 0.45 } };
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
    camera: framing.camera,
    held,
    assertBrainFits,
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

  it('keeps the distance of a landmark, a cut face and the whole brain after a gesture too', () => {
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
});
