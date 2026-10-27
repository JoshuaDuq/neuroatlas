import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import {
  Box3,
  FrontSide,
  HalfFloatType,
  Mesh,
  BoxGeometry,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import type { WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { frameTo } from './camera-views.ts';
import * as outlineEdges from './outline-edges.ts';
import * as outlineOccluders from './outline-occluders.ts';
import { createPipeline, createScene, planFraming } from './scene.ts';

// Only the renderer is replaced, since it needs a GL context.
const calls = vi.hoisted(() => ({
  order: [] as string[],
  canvas: null as EventTarget | null,
  loop: null as ((now: number) => void) | null,
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
    constructor() {
      calls.canvas = this.domElement;
    }
    getContext = () => null;
    setPixelRatio = (ratio: number) => {
      this.ratio = ratio;
    };
    getPixelRatio = () => this.ratio;
    setSize() {}
    initRenderTarget() {}
    setAnimationLoop(loop: ((now: number) => void) | null) {
      calls.loop = loop;
    }
    dispose() {
      calls.order.push('dispose');
    }
    forceContextLoss() {
      calls.order.push('forceContextLoss');
    }
  }
  return { ...original, WebGLRenderer: FakeRenderer };
});

// The real pipeline construction, without a WebGL context.
function fixture() {
  const renderer = {
    getPixelRatio: () => 2,
    getRenderTarget: () => null,
    setRenderTarget() {},
  } as unknown as WebGLRenderer;
  return createPipeline({
    renderer,
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    msaaSamples: 4,
  });
}

describe('render pipeline', () => {
  it('draws the scene, the halo, the core and the output, in that order', () => {
    const { composer, halo, core } = fixture();
    const [scene, ...rest] = composer.passes;
    assert.ok(scene instanceof RenderPass);
    assert.deepEqual(rest.slice(0, 2), [halo, core]);
    assert.ok(rest[2] instanceof OutputPass);
    assert.equal(composer.passes.length, 4);
    assert.ok(halo instanceof OutlinePass && core instanceof OutlinePass);
  });

  it('gives the halo and the core their thickness, with both outlines off until something is outlined', () => {
    const { halo, core } = fixture();
    assert.deepEqual([halo.edgeThickness, core.edgeThickness], [3, 1]);
    for (const pass of [halo, core]) {
      assert.equal(pass.edgeStrength, 6);
      assert.equal(pass.edgeGlow, 0);
      assert.equal(pass.enabled, false);
      assert.equal(pass.depthMaterial.side, FrontSide);
      assert.equal(pass.prepareMaskMaterial.side, FrontSide);
    }
  });

  it('keeps the output pass from swapping buffers', () => {
    const output = fixture().composer.passes.at(-1) as OutputPass;
    assert.equal(output.needsSwap, false);
  });

  it('keeps one image target across successive frames and never writes to the spare target', () => {
    const { composer, halo, core } = fixture();
    halo.enabled = core.enabled = true;
    const image = composer.readBuffer;
    const destinations: unknown[] = [];
    for (const pass of composer.passes) {
      pass.render = (_renderer, write, read) => {
        destinations.push(pass.renderToScreen ? null : read);
        void write;
      };
    }
    for (let i = 0; i < 3; i++) composer.render(0);
    assert.equal(composer.readBuffer, image);
    assert.ok(destinations.every((target) => target === null || target === image));
    assert.ok(!destinations.includes(composer.writeBuffer));
  });

  it('retains MSAA and cut stencil precision without resolving unused depth', () => {
    const target = fixture().composer.readBuffer;
    assert.equal(target.samples, 4);
    assert.equal(target.texture.type, HalfFloatType);
    assert.equal(target.depthBuffer, true);
    assert.equal(target.stencilBuffer, true);
    assert.equal(target.resolveDepthBuffer, false);
    assert.equal(target.resolveStencilBuffer, false);
  });

  it('paints the core from the halo mask when both outline the same meshes', () => {
    const { halo, core } = fixture();
    const mesh = new Mesh(new BoxGeometry());
    halo.selectedObjects = [mesh];
    core.selectedObjects = [mesh];
    halo.enabled = core.enabled = true;
    const paint = vi.spyOn(outlineEdges, 'paintOutlineEdges').mockImplementation(() => {});
    const occluders = vi.spyOn(outlineOccluders, 'withOutlineOccluders');
    const read = {} as never;
    core.render({} as never, {} as never, read, 0, false);
    assert.equal(paint.mock.calls.length, 1);
    assert.equal(paint.mock.calls[0]![1], halo.renderTargetMaskBuffer.texture);
    assert.equal(paint.mock.calls[0]![3], read);
    assert.equal(occluders.mock.calls.length, 0);
    vi.restoreAllMocks();
  });
});

describe('planFraming', () => {
  it('returns the framed plan and leaves the camera and controls exactly as they were', () => {
    const camera = new PerspectiveCamera(35, 1.6, 0.001, 10);
    camera.position.set(0.2, 0.1, 0.3);
    const controls = new OrbitControls(camera);
    controls.minDistance = 0.02;
    controls.maxDistance = 4;
    const before = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      target: controls.target.clone(),
      near: camera.near,
      far: camera.far,
    };
    const bounds = new Box3(new Vector3(-0.07, -0.1, -0.06), new Vector3(0.07, 0.1, 0.08));
    const plan = planFraming(camera, controls, bounds, new Vector3(1, 0, 0), frameTo, {
      horizontal: 1,
      vertical: 0.45,
    });
    assert.notDeepEqual(plan.position, before.position);
    assert.deepEqual(plan.target, bounds.getCenter(new Vector3()));
    assert.deepEqual(camera.position, before.position);
    assert.ok(camera.quaternion.equals(before.quaternion));
    assert.deepEqual(controls.target, before.target);
    assert.equal(camera.near, before.near);
    assert.equal(camera.far, before.far);
    assert.equal(controls.minDistance, 0.02);
    assert.equal(controls.maxDistance, 4);
  });
});

const host = {
  prepend() {},
  getBoundingClientRect: () => ({ width: 800, height: 600 }),
} as unknown as HTMLElement;

describe('scene lifecycle', () => {
  beforeEach(() => {
    calls.order = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('document', { documentElement: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('frees the renderer, then releases its context, without reporting a loss', () => {
    const onContextLost = vi.fn();
    const stage = createScene(host, { onContextLost });
    stage.dispose();
    assert.deepEqual(calls.order, ['dispose', 'forceContextLoss']);
    calls.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    assert.equal(onContextLost.mock.calls.length, 0);
  });

  it('reports a context lost while the scene is alive', () => {
    const onContextLost = vi.fn();
    const stage = createScene(host, { onContextLost });
    calls.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    assert.equal(onContextLost.mock.calls.length, 1);
    stage.dispose();
  });

  it('refuses a theme without a numeric exposure', () => {
    const stage = createScene(host);
    for (const exposure of ['', 'bright', '1,2']) {
      vi.stubGlobal('getComputedStyle', () => ({
        getPropertyValue: (name: string) => (name === '--scene-exposure' ? exposure : '#808080'),
      }));
      assert.throws(() => stage.applyTheme(), /--scene-exposure/);
    }
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => (name === '--scene-exposure' ? '1.2' : '#808080'),
    }));
    assert.doesNotThrow(() => stage.applyTheme());
    stage.dispose();
  });
});

describe('scene motion', () => {
  let clock = 0;
  let reduced = false;
  let resizeObserved: (() => void) | null = null;
  let composerRatios: number[] = [];

  beforeEach(() => {
    clock = 1000;
    reduced = false;
    composerRatios = [];
    calls.loop = null;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(function (
      this: EffectComposer,
    ) {
      composerRatios.push((this as unknown as { _pixelRatio: number })._pixelRatio);
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeObserved = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    vi.stubGlobal('document', { documentElement: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const hostOf = (width: number, height: number) =>
    ({
      prepend() {},
      getBoundingClientRect: () => ({ width, height }),
    }) as unknown as HTMLElement;

  const plan = () => ({
    position: new Vector3(0.3, 0.1, 0.4),
    target: new Vector3(0.01, 0, 0),
    near: 0.01,
    far: 5,
    minDistance: 0.05,
    maxDistance: 2,
  });

  /** One frame of the render loop at `offset` ms after the clock's start of 1000. */
  const frame = (offset: number) => {
    clock = 1000 + offset;
    calls.loop!(clock);
  };

  const close = (actual: number, expected: number, tolerance = 1e-6) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

  it('SCENE-01 an eased move lasts 240 ms, applies its orbit limits on arrival and lands on the plan', () => {
    const stage = createScene(host);
    stage.setSize();
    const start = stage.camera.position.clone();
    const destination = plan();
    stage.moveTo(destination);
    frame(120);
    const halfway = stage.camera.position;
    assert.ok(halfway.distanceTo(start) > 1e-3 && halfway.distanceTo(destination.position) > 1e-3);
    assert.equal(stage.controls.minDistance, 0);
    assert.equal(stage.controls.maxDistance, Infinity);
    assert.deepEqual(stage.destination.position, destination.position);
    frame(240);
    assert.ok(stage.camera.position.distanceTo(destination.position) < 1e-9);
    assert.ok(stage.controls.target.distanceTo(destination.target) < 1e-9);
    assert.equal(stage.controls.minDistance, 0.05);
    assert.equal(stage.controls.maxDistance, 2);
    stage.dispose();
  });

  it('SCENE-02 an immediate move, and every move and slide under reduced motion, land at once', () => {
    const stage = createScene(host);
    stage.setSize();
    stage.moveTo(plan(), { immediate: true });
    assert.ok(stage.camera.position.distanceTo(new Vector3(0.3, 0.1, 0.4)) < 1e-12);
    assert.equal(stage.controls.maxDistance, 2);

    reduced = true;
    const other = createScene(host);
    other.setSize();
    other.moveTo(plan());
    assert.ok(other.camera.position.distanceTo(new Vector3(0.3, 0.1, 0.4)) < 1e-12);
    assert.deepEqual(other.controls.target.toArray(), [0.01, 0, 0]);
    // The image's offset is final before any frame: 40 px for an 80 px band under a 600 px canvas.
    other.setFramingInset({ bottom: 80 });
    assert.equal(other.camera.view?.offsetY, 40);
    other.setChromeInsets({ bottom: 200 }, { settle: true });
    assert.equal(other.camera.view?.offsetY, 140);
    stage.dispose();
    other.dispose();
  });

  it('SCENE-03 a framing inset slides on a cubic ease-in-out, and on the sheet curve beside a settle', () => {
    const plain = createScene(host);
    plain.setSize();
    plain.setFramingInset({ bottom: 80 });
    // offsetY = 300 - (600 - 80 * ease) / 2; ease(0.25, 0.5, 0.75) = 1/16, 1/2, 15/16.
    for (const [offset, expected] of [
      [60, 2.5],
      [120, 20],
      [180, 37.5],
    ] as const) {
      frame(offset);
      close(plain.camera.view!.offsetY, expected);
    }
    plain.dispose();

    clock = 1000;
    const beside = createScene(host);
    beside.setSize();
    beside.setChromeInsets({ bottom: 300 }, { settle: true });
    beside.setFramingInset({ bottom: 80 });
    // Both bands ride cubic-bezier(0.32, 0.72, 0, 1): offsetY = (300 + 80) / 2 * ease.
    for (const [offset, ease] of [
      [60, 0.7791312484],
      [120, 0.9548094095],
      [180, 0.9923487139],
    ] as const) {
      frame(offset);
      close(beside.camera.view!.offsetY, 190 * ease);
    }
    beside.dispose();
  });

  it('SCENE-05 the sheet shrinks the visible rectangle, not the canvas, the camera or the target', () => {
    const stage = createScene(hostOf(1000, 700));
    stage.setSize();
    stage.moveTo(plan(), { immediate: true });
    const position = stage.camera.position.toArray();
    const target = stage.controls.target.toArray();
    stage.setChromeInsets({ bottom: 200 });
    assert.equal(stage.visibleRect.height, 500);
    assert.deepEqual(stage.hostSize, { width: 1000, height: 700 });
    assert.equal(stage.camera.view?.enabled, true);
    assert.equal(stage.camera.view?.fullHeight, 700);
    assert.equal(stage.camera.view?.offsetY, 100);
    assert.deepEqual(stage.camera.position.toArray(), position);
    assert.deepEqual(stage.controls.target.toArray(), target);
    stage.dispose();
  });

  it('SCENE-06 a framing inset narrows framing but not the visible rectangle, and reports a change', () => {
    const stage = createScene(host);
    stage.setSize();
    assert.equal(stage.setFramingInset({ bottom: 80 }), true);
    assert.equal(stage.setFramingInset({ bottom: 80 }), false);
    assert.deepEqual(stage.visibleRect, { x: 0, y: 0, width: 800, height: 600 });
    close(stage.viewportFit.vertical, 1 - 80 / 600, 1e-12);
    assert.equal(stage.viewportFit.horizontal, 1);
    assert.equal(stage.setFramingInset({ bottom: 40 }, { immediate: true }), true);
    assert.equal(stage.camera.view?.offsetY, 20);
    stage.dispose();
  });

  it('SCENE-07 a host resize reports a canvas change and a sheet inset does not', () => {
    const onResize = vi.fn();
    const stage = createScene(host, { onResize });
    resizeObserved!();
    assert.deepEqual(onResize.mock.calls, [[{ canvasChanged: true }]]);
    stage.setChromeInsets({ bottom: 100 });
    assert.deepEqual(onResize.mock.calls.at(-1), [{ canvasChanged: false }]);
    const count = onResize.mock.calls.length;
    stage.setChromeInsets({ bottom: 100 });
    assert.equal(onResize.mock.calls.length, count);
    stage.dispose();
  });

  it('SCENE-08 a moving camera draws at the reduced ratio, then once at full after 150 ms, then rests', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const stage = createScene(host);
    stage.setSize();
    frame(0);
    const settledRatio = composerRatios.at(-1)!;
    stage.moveTo(plan());
    composerRatios = [];
    frame(120);
    assert.ok(composerRatios.length > 0 && composerRatios.every((ratio) => ratio < settledRatio));
    frame(240);
    composerRatios = [];
    frame(300);
    assert.deepEqual(composerRatios, [], 'nothing is drawn while it is only waiting to rest');
    frame(400);
    assert.deepEqual(composerRatios, [settledRatio]);
    frame(401);
    assert.equal(calls.loop, null, 'the loop stops until something changes');
    stage.invalidate();
    assert.notEqual(calls.loop, null);
    stage.dispose();
  });
});
