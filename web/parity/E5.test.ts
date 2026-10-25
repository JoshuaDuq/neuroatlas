import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import * as legacyScene from '../../viewer/render/scene.js';
import * as legacyPicking from '../../viewer/render/picking.js';
import * as legacyOverlay from '../../viewer/comparison/overlay.js';
import * as legacyCameraViews from '../../viewer/render/camera-views.js';
import * as scene from '../src/lib/engine/render/scene.ts';
import * as picking from '../src/lib/engine/render/picking.ts';
import * as overlay from '../src/lib/engine/comparison/overlay.ts';
import * as cameraViews from '../src/lib/engine/render/camera-views.ts';
import { VIEW_NAMES } from '../src/lib/types/constants.ts';

/*
 * Only the renderer is replaced: it needs a GL context. Both implementations import `three` through
 * this one mock, so they drive the same fake.
 */
const fakes = vi.hoisted(() => ({
  loop: null as ((now: number) => void) | null,
}));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = Object.assign(new EventTarget(), {
      style: {} as Record<string, string>,
      tabIndex: -1,
      clientHeight: 600,
      attributes: new Map<string, string>(),
      setAttribute(name: string, value: string) {
        this.attributes.set(name, value);
      },
      remove() {},
      ownerDocument: new EventTarget(),
      getRootNode: () => new EventTarget(),
      setPointerCapture() {},
      releasePointerCapture() {},
      hasPointerCapture: () => false,
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

const legacy = legacyScene as unknown as typeof scene;
const legacyPick = legacyPicking as unknown as typeof picking;
const legacyOverlays = legacyOverlay as unknown as typeof overlay;
const legacyFrameTo = (legacyCameraViews as unknown as typeof cameraViews).frameTo;

const same = (actual: unknown, expected: unknown, message?: string) =>
  assert.deepStrictEqual(actual, expected, message);

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0xe5);
const between = (low: number, high: number) => low + (high - low) * random();

describe('E5 parity: planFraming', () => {
  const directions = Object.values(cameraViews.VIEW_DIRECTIONS);
  const fits = [
    {},
    { horizontal: 1, vertical: 0.45 },
    ...Array.from({ length: 6 }, () => ({
      horizontal: between(0.2, 1),
      vertical: between(0.2, 1),
    })),
  ];

  function bounds(): Box3[] {
    const boxes = [new Box3(new Vector3(-0.07, -0.1, -0.06), new Vector3(0.07, 0.1, 0.08))];
    for (let i = 0; i < 20; i++) {
      const center = new Vector3(between(-0.05, 0.05), between(-0.05, 0.05), between(-0.05, 0.05));
      const half = new Vector3(between(0.001, 0.1), between(0.001, 0.1), between(0.001, 0.1));
      boxes.push(new Box3(center.clone().sub(half), center.clone().add(half)));
    }
    return boxes;
  }

  function pair(aspect: number) {
    const make = () => {
      const camera = new PerspectiveCamera(35, aspect, 0.001, 10);
      camera.position.set(0.3, 0.1, 0.4);
      camera.lookAt(0, 0, 0);
      const controls = new OrbitControls(camera);
      controls.minDistance = 0.05;
      controls.maxDistance = 2;
      controls.target.set(0.01, 0.02, 0.03);
      return { camera, controls };
    };
    return [make(), make()] as const;
  }

  const snapshot = ({ camera, controls }: ReturnType<typeof pair>[0]) => ({
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    up: camera.up.toArray(),
    target: controls.target.toArray(),
    near: camera.near,
    far: camera.far,
    projection: [...camera.projectionMatrix.elements],
    world: [...camera.matrixWorld.elements],
    limits: [controls.minDistance, controls.maxDistance],
  });

  it('plans identically and leaves the camera as it found it', () => {
    for (const aspect of [0.5, 1, 1.4, 1.78, 2.4, between(0.4, 2.6), between(0.4, 2.6)]) {
      for (const box of bounds()) {
        const cloud = new Float32Array(300).map(() => between(-0.1, 0.1));
        for (const points of [null, cloud]) {
          const fit = fits[Math.floor(random() * fits.length)]!;
          const direction = directions[Math.floor(random() * directions.length)]!;
          const [now, then] = pair(aspect);
          const before = snapshot(now);
          const plan = scene.planFraming(
            now.camera,
            now.controls,
            box,
            direction,
            cameraViews.frameTo,
            fit,
            points,
          );
          const expected = legacy.planFraming(
            then.camera,
            then.controls,
            box,
            direction,
            legacyFrameTo,
            fit,
            points,
          );
          same(plan, expected);
          // `planFraming` ends with `updateMatrixWorld`, so the world matrix is the one field that moves.
          const { world: _, ...kept } = before;
          const { world: nowWorld, ...nowKept } = snapshot(now);
          const { world: thenWorld, ...thenKept } = snapshot(then);
          same(nowKept, kept);
          same(thenKept, kept);
          same(nowWorld, thenWorld);
        }
      }
    }
  });

  it('plans identically for every named view', () => {
    for (const view of VIEW_NAMES) {
      const [now, then] = pair(1.6);
      const direction = cameraViews.VIEW_DIRECTIONS[view];
      now.camera.up.copy(cameraViews.upFor(view));
      then.camera.up.copy(cameraViews.upFor(view));
      const box = new Box3(new Vector3(-0.07, -0.1, -0.06), new Vector3(0.07, 0.1, 0.08));
      same(
        scene.planFraming(now.camera, now.controls, box, direction, cameraViews.frameTo, {
          horizontal: 1,
          vertical: 0.45,
        }),
        legacy.planFraming(then.camera, then.controls, box, direction, legacyFrameTo, {
          horizontal: 1,
          vertical: 0.45,
        }),
      );
    }
  });
});

describe('E5 parity: transition easing', () => {
  let clock = 0;
  let reduced = false;
  let composerRenders: number[] = [];

  beforeEach(() => {
    clock = 1000;
    reduced = false;
    composerRenders = [];
    fakes.loop = null;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(function (
      this: EffectComposer,
    ) {
      composerRenders.push((this as unknown as { _pixelRatio: number })._pixelRatio);
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => ' #808080 ' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const offsets = [
    ...Array.from({ length: 35 }, (_, k) => (k * 240) / 32),
    ...Array.from({ length: 20 }, () => between(0, 300)).sort((a, b) => a - b),
  ].sort((a, b) => a - b);

  const plan = () => ({
    position: new Vector3(0.3, 0.1, 0.4),
    target: new Vector3(0.01, 0, 0),
    near: 0.01,
    far: 5,
    minDistance: 0.05,
    maxDistance: 2,
  });

  type Create = typeof scene.createScene;

  /** Run a scripted sequence against one implementation and record every observable frame. */
  function run(create: Create, script: (stage: ReturnType<Create>) => void): unknown[] {
    clock = 1000;
    composerRenders = [];
    reduced = false;
    const resizes: unknown[] = [];
    const host = {
      prepend() {},
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    } as unknown as HTMLElement;
    const stage = create(host, { onResize: (change) => resizes.push(change) });
    stage.setSize();
    stage.camera.up.set(0, 0, 1);
    script(stage);
    assert.ok(fakes.loop, 'the scene starts its render loop');
    const frames: unknown[] = [];
    const start = clock;
    for (const offset of offsets) {
      clock = start + offset;
      fakes.loop?.(clock);
      frames.push({
        offset,
        position: stage.camera.position.toArray(),
        quaternion: stage.camera.quaternion.toArray(),
        up: stage.camera.up.toArray(),
        target: stage.controls.target.toArray(),
        view: stage.camera.view ? { ...stage.camera.view } : null,
        near: stage.camera.near,
        far: stage.camera.far,
        limits: [stage.controls.minDistance, stage.controls.maxDistance],
        renders: [...composerRenders],
        destination: stage.destination.position.toArray(),
        fit: stage.viewportFit,
        rect: stage.visibleRect,
      });
    }
    stage.dispose();
    return [resizes, frames];
  }

  const scenarios: [string, (stage: ReturnType<Create>) => void][] = [
    ['an eased move', (stage) => stage.moveTo(plan())],
    ['an immediate move', (stage) => stage.moveTo(plan(), { immediate: true })],
    [
      'a move beside a settling sheet',
      (stage) => {
        stage.setChromeInsets({ bottom: 300 }, { settle: true });
        stage.moveTo(plan());
      },
    ],
    ['a dragged sheet', (stage) => stage.setChromeInsets({ bottom: 220, left: 10 })],
    [
      'a framing inset, eased then immediate',
      (stage) => {
        stage.setFramingInset({ bottom: 80, top: 20 });
        stage.moveTo(plan());
        stage.setFramingInset({ bottom: 40 }, { immediate: true });
      },
    ],
    [
      'a framing inset beside a settling sheet',
      (stage) => {
        stage.setChromeInsets({ bottom: 250 }, { settle: true });
        stage.setFramingInset({ right: 60 });
      },
    ],
  ];

  for (const [name, script] of scenarios) {
    it(`samples ${name} identically`, () => {
      same(run(scene.createScene, script), run(legacy.createScene, script));
    });
    it(`samples ${name} identically under reduced motion`, () => {
      const withReduced: typeof script = (stage) => {
        reduced = true;
        script(stage);
      };
      same(run(scene.createScene, withReduced), run(legacy.createScene, withReduced));
    });
  }
});

describe('E5 parity: picker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  type Listener = (event: unknown) => void;
  type Create = typeof picking.createPicker;

  function drive(create: Create, seed: number): unknown {
    const next = mulberry32(seed);
    const queued: (FrameRequestCallback | null)[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      queued.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      queued[handle - 1] = null;
    });
    const sizes = [
      { width: 200, height: 100 },
      { width: 800, height: 600 },
      { width: 390, height: 844 },
      { width: 0, height: 0 },
    ];
    const size = sizes[Math.floor(next() * sizes.length)]!;
    const listeners = new Map<string, Listener>();
    const domElement = {
      style: {} as Record<string, string>,
      addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
      getBoundingClientRect: () => ({ left: 10, top: 5, ...size }),
    };
    const camera = new PerspectiveCamera(20 + next() * 40, 0.5 + next() * 2, 0.01, 10);
    camera.position.set(next() - 0.5, next() - 0.5, 0.5 + next());
    camera.lookAt(0, 0, 0);
    const controls = new OrbitControls(new PerspectiveCamera());
    const log: unknown[] = [];
    const rays: number[][] = [];
    const point = new Vector3(0.1, 0.2, 0.3);
    create({
      domElement: domElement as unknown as HTMLElement,
      camera,
      controls,
      model: () => ({
        pick: (raycaster) => {
          rays.push([...raycaster.ray.origin.toArray(), ...raycaster.ray.direction.toArray()]);
          return raycaster.ray.direction.x > 0 ? { id: `r${rays.length}` } : null;
        },
        intersect: (raycaster) => {
          rays.push([...raycaster.ray.origin.toArray(), ...raycaster.ray.direction.toArray()]);
          return raycaster.ray.direction.y > 0 ? { point } : null;
        },
      }),
      onHover: (region, position) => log.push(['hover', region, position]),
      onSelect: (id) => log.push(['select', id]),
      onFocusPoint: (focus) => log.push(['focus', focus.toArray()]),
    });
    const types = [
      'pointermove',
      'pointerdown',
      'pointerup',
      'pointerleave',
      'pointercancel',
      'dblclick',
    ];
    const pointerTypes = ['mouse', 'touch', 'pen'];
    for (let i = 0; i < 200; i++) {
      const type = types[Math.floor(next() * types.length)]!;
      const drift = [0, 4, 5, 6, 11, 12, 13, next() * 20][Math.floor(next() * 8)]!;
      const event = {
        clientX: next() * (size.width + 20),
        clientY: next() * (size.height + 10),
        buttons: next() < 0.2 ? 1 : 0,
        button: Math.floor(next() * 3),
        pointerType: pointerTypes[Math.floor(next() * 3)]!,
        isPrimary: true,
      };
      if (next() < 0.1) controls.dispatchEvent({ type: 'change' });
      listeners.get(type)?.(event);
      if (type === 'pointerdown') {
        listeners.get('pointerup')?.({ ...event, button: 0, clientX: event.clientX + drift });
      }
      if (next() < 0.5) for (const callback of queued.splice(0)) callback?.(0);
      log.push(['cursor', domElement.style.cursor]);
    }
    for (const callback of queued.splice(0)) callback?.(0);
    return { log, rays, world: [...camera.matrixWorld.elements] };
  }

  it('selects, hovers and focuses identically across a seeded event script', () => {
    for (let seed = 1; seed <= 12; seed++) {
      same(drive(picking.createPicker, seed), drive(legacyPick.createPicker, seed), `seed ${seed}`);
    }
    const kinds = new Set(
      (drive(picking.createPicker, 2) as { log: [string][] }).log.map(([kind]) => kind),
    );
    assert.ok(
      kinds.has('hover') && kinds.has('select'),
      'the script exercises hover and selection',
    );
  });
});

describe('E5 parity: comparison overlay', () => {
  const pairs = ['pair-a', 'pair-b', 'pair-c', 'pair-d'];

  function overlapScene(duplicate = false) {
    const group = new Group();
    for (const [index, id] of pairs.entries()) {
      const mesh = new Mesh(new BoxGeometry(1 + index, 1, 1), new MeshBasicMaterial());
      mesh.userData.overlap_id = duplicate && index === 3 ? 'pair-a' : id;
      mesh.position.set(index, 0, 0);
      group.add(mesh);
    }
    return group;
  }

  /** The state a reader of the overlay can observe. */
  function observe(instance: overlay.ComparisonOverlay, source: Group) {
    return {
      visible: instance.group.visible,
      name: instance.group.name,
      outlined: instance.outlined.map((mesh) => mesh.userData.overlap_id),
      meshes: source.children.map((child) => {
        const mesh = child as Mesh<BoxGeometry, MeshBasicMaterial>;
        return {
          visible: mesh.visible,
          auto: mesh.matrixAutoUpdate,
          matrix: [...mesh.matrix.elements],
          material: [
            mesh.material.type,
            mesh.material.side,
            mesh.material.colorWrite,
            mesh.material.depthWrite,
          ],
          positions: [...mesh.geometry.attributes.position!.array],
        };
      }),
    };
  }

  async function run(create: typeof overlay.createComparisonOverlay, seed: number) {
    const next = mulberry32(seed);
    const source = overlapScene();
    let loads = 0;
    const instance = create(async () => {
      loads++;
      return source;
    });
    const log: unknown[] = [];
    for (let step = 0; step < 25; step++) {
      const action = Math.floor(next() * 6);
      const id = next() < 0.15 ? 'absent' : pairs[Math.floor(next() * pairs.length)]!;
      try {
        if (action <= 2) log.push(await instance.highlight(id));
        else if (action === 3) instance.clear();
        else instance.setVisible(next() < 0.5);
      } catch (error) {
        log.push((error as Error).message);
      }
      log.push(observe(instance, source), loads);
    }
    instance.dispose();
    log.push(observe(instance, source), source.parent === null);
    return log;
  }

  it('highlights, clears, hides and disposes identically across seeded sequences', async () => {
    for (let seed = 1; seed <= 20; seed++) {
      same(
        await run(overlay.createComparisonOverlay, seed),
        await run(legacyOverlays.createComparisonOverlay, seed),
      );
    }
  });

  it('supersedes, fails and retries identically', async () => {
    for (const create of [
      overlay.createComparisonOverlay,
      legacyOverlays.createComparisonOverlay,
    ]) {
      let resolve!: (group: Group) => void;
      const source = overlapScene();
      const instance = create(() => new Promise((done) => (resolve = done)));
      const first = instance.highlight('pair-a');
      const second = instance.highlight('pair-b');
      resolve(source);
      same([await first, await second], [false, true]);
      instance.dispose();
    }
    const messages = [];
    for (const create of [
      overlay.createComparisonOverlay,
      legacyOverlays.createComparisonOverlay,
    ]) {
      const instance = create(async () => overlapScene(true));
      const outcome = await instance.highlight('pair-a').catch((error: Error) => error.message);
      const disposed = await instance.highlight('pair-a').catch((error: Error) => error.message);
      instance.dispose();
      const after = await instance.highlight('pair-a').catch((error: Error) => error.message);
      messages.push([outcome, disposed, after]);
    }
    same(messages[0], messages[1]);
  });
});
