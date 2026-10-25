/* oxlint-disable typescript/no-explicit-any -- the legacy closure is driven through one untyped surface */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, it, vi } from 'vitest';
import { Box3, EventDispatcher, Mesh, PerspectiveCamera, Sphere, Vector3 } from 'three';
import { repoRoot } from '../test/repo.ts';
import {
  VIEW_DIRECTIONS as legacyDirections,
  cutFacingView as legacyCutFacingView,
  fitDistance as legacyFitDistance,
  frameTo as legacyFrameTo,
  upFor as legacyUpFor,
  withContext as legacyWithContext,
} from '../../viewer/render/camera-views.js';
import { planFraming as legacyPlanFraming } from '../../viewer/render/scene.js';
import { createSession as legacySession } from '../../viewer/state/session.js';
import { rasToWorld as legacyRasToWorld } from '../../viewer/slices/coordinates.js';
import { orbitWithin as legacyOrbitWithin } from '../../viewer/state/url-state.js';
import { ORBIT_ROUNDING_MM, decodeState, encodeState } from '../src/lib/core/state/url-state.ts';
import { createEngineSections } from '../src/lib/engine/adapters.ts';
import { createFraming } from '../src/lib/engine/framing.ts';
import type { Framing, FramingScene } from '../src/lib/engine/framing.ts';
import { CAMERA_KEYS, createHeldView } from '../src/lib/engine/held-view.ts';
import { BrainAtlas } from '../src/lib/engine/model/brain-atlas.ts';
import {
  modelDirectory,
  publishedLoader,
  readManifest,
} from '../src/lib/engine/model/test-support.ts';
import { createPresentation } from '../src/lib/engine/presentation.ts';
import { centeredFrame } from '../src/lib/engine/slices/coordinates.ts';
import type { CameraSnapshot } from '../src/lib/engine/api.ts';
import type { CutMode, ViewName } from '../src/lib/types/index.ts';

type Stub = Record<string, any>;

afterEach(() => {
  vi.useRealTimers();
});

/** mulberry32: a seeded PRNG, so every run draws the same poses, viewports and commands. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Random = ReturnType<typeof prng>;
const pick = <T>(random: Random, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)]!;
const between = (random: Random, low: number, high: number) => low + random() * (high - low);

// ---------------------------------------------------------------------------
// The stage both implementations drive: a camera, orbit controls and a scene whose moves land at once.
// ---------------------------------------------------------------------------

function createStage() {
  const camera = new PerspectiveCamera(35, 390 / 792, 0.001, 10);
  const controls = Object.assign(new EventDispatcher<any>(), {
    target: new Vector3(),
    minDistance: 0,
    maxDistance: Infinity,
    maxTargetRadius: Infinity,
    cursor: new Vector3(),
    enableDamping: false,
    object: camera,
    update() {
      camera.lookAt(this.target);
      camera.updateMatrixWorld();
    },
    rotateLeft() {},
    rotateUp() {},
    dollyIn() {},
  });
  let size = { width: 390, height: 792 };
  let inset = { top: 0, right: 0, bottom: 0 };
  const moves: unknown[] = [];
  const stage = {
    camera,
    controls,
    moves,
    moveTo(plan: Stub, options: Stub = {}) {
      moves.push(options);
      camera.near = plan.near;
      camera.far = plan.far;
      camera.updateProjectionMatrix();
      camera.position.copy(plan.position);
      controls.target.copy(plan.target);
      controls.minDistance = plan.minDistance;
      controls.maxDistance = plan.maxDistance;
      controls.update();
    },
    get destination() {
      return {
        position: camera.position.clone(),
        target: controls.target.clone(),
        up: camera.up.clone(),
        near: camera.near,
        far: camera.far,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
      };
    },
    get viewportFit() {
      return {
        horizontal: 1 - inset.right / size.width,
        vertical: 1 - (inset.top + inset.bottom) / size.height,
      };
    },
    setFramingInset(next: Stub = {}) {
      const { top = 0, right = 0, bottom = 0 } = next;
      const changed = top !== inset.top || right !== inset.right || bottom !== inset.bottom;
      inset = { top, right, bottom };
      return changed;
    },
    setChromeInsets() {},
    get visibleRect() {
      return { x: 0, y: 0, ...size };
    },
    get hostSize() {
      return size;
    },
    get distanceToTarget() {
      return camera.position.distanceTo(controls.target);
    },
    get viewportHeight() {
      return size.height;
    },
    invalidate() {},
    resize(width: number, height: number) {
      size = { width, height };
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    pose(heading: Vector3, distance: number, target: Vector3, up: Vector3) {
      camera.up.copy(up);
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(heading, distance);
      controls.update();
    },
  };
  return stage;
}
type Stage = ReturnType<typeof createStage>;

// ---------------------------------------------------------------------------
// The legacy closure: the slices of `viewer/app.js` that move the camera, run over the same model.
// ---------------------------------------------------------------------------

const appSource = readFileSync(resolve(repoRoot, 'viewer/app.js'), 'utf8');

function slice(from: string, to: string): string {
  const start = appSource.indexOf(from);
  const end = appSource.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `viewer/app.js moved: ${from}`);
  return appSource.slice(start, end);
}

const framingSource = [
  slice('  function moveCamera(plan, options) {', '  /** Open the tree branch that holds a region'),
  slice('  function frameInternal() {', '  // Taken at each of the two doors in'),
  slice(
    '  function faceCut({ immediate = false } = {}) {',
    '  const sectionControls = createSectionControls(',
  ),
  slice(
    '  function restoreCamera(view, pose, { immediate }) {',
    '  /** Panels word their own failures',
  ),
  slice('  const heading = () =>', '  /*\n   * The phone shell.'),
  slice("  /** Scale the camera's distance from a fit of `before`", '  function showList() {'),
  slice('  function focusPoint(point) {', '  picker = createPicker({'),
  slice('  function rememberZoom() {', '  /**\n   * The canvas is focusable'),
].join('\n');

interface World {
  scene: Stage;
  model: BrainAtlas;
  bounds: Box3;
  sections: Stub;
  framingSource: { inset: Stub; scale: { horizontal: number; vertical: number } };
}

function legacyFraming(world: World) {
  let held = false;
  const chrome = {
    framing: () => world.framingSource,
    holdView() {
      held = true;
    },
    releaseView() {
      held = false;
    },
    get viewHeld() {
      return held;
    },
  };
  const deps = {
    Box3,
    Sphere,
    Vector3,
    VIEW_DIRECTIONS: legacyDirections,
    cutFacingView: legacyCutFacingView,
    fitDistance: legacyFitDistance,
    frameTo: legacyFrameTo,
    upFor: legacyUpFor,
    withContext: legacyWithContext,
    planFraming: legacyPlanFraming,
    rasToWorld: legacyRasToWorld,
    orbitWithin: legacyOrbitWithin,
    session: legacySession({ views: Object.keys(legacyDirections) }),
    circuitSession: { snapshot: () => ({ circuit: null }) },
    circuitCatalog: { contextMarginMm: 20 },
    nativeTracts: { ready: false, bounds: new Box3() },
    render() {},
    scheduleUrl() {},
    model: world.model,
    scene: world.scene,
    bounds: world.bounds,
    sections: world.sections,
    chrome,
  };
  const closure = new Function(
    'deps',
    `
    const { Box3, Sphere, Vector3, VIEW_DIRECTIONS, cutFacingView, fitDistance, frameTo, upFor, withContext,
      planFraming, rasToWorld, orbitWithin, session, circuitSession, circuitCatalog, nativeTracts, render,
      scheduleUrl, model, scene, bounds, sections, chrome } = deps;
    let framed = false;
    let tractReferenceActive = false;
    let refitViewport = null;
    ${framingSource}
    return {
      applyView, frameCurrent, frameWhole, frameInternal, frameRegions, focusSelection, frameLandmark,
      faceCut, focusPoint, refitDock, keepFraming, restoreCamera, placeOrbit, orbitLink, rememberZoom,
      fittedDistance, heading, refitViewport: () => refitViewport(),
      get zoom() { return zoom; },
      resetCaches() { cachedFramingBounds = null; cachedFramingPoints = null; },
    };`,
  )(deps);
  return {
    ...closure,
    circuitCatalog: deps.circuitCatalog,
    session: deps.session,
    chrome,
    get held() {
      return held;
    },
  } as Stub;
}

function currentFraming(world: World) {
  const { scene, controls } = { scene: world.scene, controls: world.scene.controls };
  const host = new EventTarget() as any;
  const held = createHeldView({ controls, host, onChange() {} });
  const reference = { active: false, bounds: null };
  const framing: Framing = createFraming({
    scene: scene as unknown as FramingScene,
    model: world.model,
    sections: world.sections as any,
    held,
    bounds: world.bounds,
    reference,
    emit() {},
  });
  framing.camera.setFramingSource(() => world.framingSource);
  return { framing, camera: framing.camera, held };
}

// ---------------------------------------------------------------------------
// The universes: the real CDMD model, in the display states framing reads.
// ---------------------------------------------------------------------------

const manifest = readManifest('cdmd');
const model = new BrainAtlas(manifest, publishedLoader(modelDirectory('cdmd')));
let whole: Box3;

beforeAll(async () => {
  await model.initialize('destrieux');
  whole = new Box3();
  for (const [id, layer] of model.layers) {
    if (manifest.supplemental_layers?.some((entry) => entry.id === id)) continue;
    for (const mesh of layer.meshes) whole.expandByObject(mesh);
  }
}, 120_000);

const drawnRegions = () => [
  ...new Set(model.visibleMeshes.map((mesh) => mesh.userData['region_id'] as string)),
];
const selectable = () =>
  drawnRegions().filter((id) => model.regions.has(id) && model.canSelect(model.regions.get(id)!));

interface Universe {
  name: string;
  prepare(): Promise<void>;
}

const universes: Universe[] = [
  { name: 'the whole brain', prepare: async () => {} },
  { name: 'one hemisphere', prepare: async () => model.setHemisphere('left') },
  {
    name: 'an isolated region',
    prepare: async () => {
      model.select(selectable().find((id) => model.regions.get(id)?.kind === 'cortex')!);
      model.isolate();
    },
  },
  { name: 'the cortex hidden', prepare: async () => model.setCortexVisible(false) },
  { name: 'the cord beneath the brain', prepare: async () => model.setSpinalCordVisible(true) },
  {
    name: 'the cord on its own',
    prepare: async () => {
      await model.setSpinalCordVisible(true);
      model.setInternalSystem('Spinal cord');
    },
  },
];

const sectionsStub = (): Stub => ({
  active: false,
  frame: centeredFrame('axial', [0, 0, 0]),
  state: { mode: 'off', reverse: false },
});

function createWorld(): World {
  return {
    scene: createStage(),
    model,
    bounds: whole.clone(),
    sections: sectionsStub(),
    framingSource: { inset: {}, scale: { horizontal: 1, vertical: 1 } },
  };
}

/** What a plan is made of, compared exactly: `Object.is` on every component. */
function planOf(scene: Stage) {
  const { position, target, up, near, far, minDistance, maxDistance } = scene.destination;
  return [
    ...position.toArray(),
    ...target.toArray(),
    ...up.toArray(),
    near,
    far,
    minDistance,
    maxDistance,
  ];
}

function assertSame(label: string, legacy: Stage, current: Stage) {
  const a = planOf(legacy);
  const b = planOf(current);
  a.forEach((value, index) => {
    assert.ok(
      Object.is(value, b[index]),
      `${label}: component ${index} is ${b[index]}, legacy ${value}`,
    );
  });
}

/** Both stages at the same pose and viewport before a command. */
function place(worlds: [World, World], random: Random) {
  const heading = new Vector3(
    between(random, -1, 1),
    between(random, -1, 1),
    between(random, -1, 1),
  ).normalize();
  const degenerate = random();
  if (degenerate < 0.08) heading.set(0, 1, 0);
  else if (degenerate < 0.12) heading.set(0, -1, 0);
  const view = pick(random, Object.keys(legacyDirections)) as ViewName;
  const target = whole
    .getCenter(new Vector3())
    .add(
      new Vector3(
        between(random, -0.02, 0.02),
        between(random, -0.02, 0.02),
        between(random, -0.02, 0.02),
      ),
    );
  const distance = between(random, 0.15, 0.9);
  const aspect = pick(random, [390 / 792, 768 / 1024, 1440 / 900, between(random, 0.4, 2)]);
  const width = 600;
  const sourced = {
    inset: {
      bottom: between(random, 0, 150),
      top: random() < 0.3 ? between(random, 0, 60) : 0,
      right: 0,
    },
    scale: { horizontal: between(random, 0.6, 1), vertical: between(random, 0.6, 1) },
  };
  for (const world of worlds) {
    world.scene.resize(width, width / aspect);
    world.framingSource = sourced;
    world.scene.pose(heading, distance, target, legacyUpFor(view));
  }
}

const VIEWS = Object.keys(legacyDirections) as ViewName[];
const CUT_MODES: CutMode[] = ['sagittal', 'coronal', 'axial', 'oblique'];

describe('E7 framing: the legacy closure and camera.* give Object.is-equal destination plans', () => {
  for (const [index, universe] of universes.entries()) {
    it(
      `${universe.name}: every command, over seeded poses and viewports`,
      { timeout: 120_000 },
      async () => {
        model.reset();
        await universe.prepare();
        const random = prng(7000 + index);
        const worlds: [World, World] = [createWorld(), createWorld()];
        const legacy = legacyFraming(worlds[0]);
        const { camera, framing, held } = currentFraming(worlds[1]);
        const bothScenes = () => [worlds[0].scene, worlds[1].scene] as const;
        const reset = () => {
          legacy.resetCaches();
          framing.invalidate();
        };
        reset();
        // The named view that opens the page, as the engine does before anything else.
        legacy.applyView('oblique', { immediate: true });
        camera.applyView('oblique', { immediate: true });
        assertSame('opening view', ...bothScenes());

        for (let step = 0; step < 40; step++) {
          place(worlds, random);
          const command = pick(random, [
            'applyView',
            'frameCurrent',
            'frameWhole',
            'frameInternal',
            'frameRegions',
            'frameRegion',
            'frameLandmark',
            'faceCut',
            'focusPoint',
            'resize',
            'refitDock',
            'keepFraming',
            'placeOrbit',
            'restore',
          ]);
          const label = `${universe.name}, step ${step}: ${command}`;
          const immediate = random() < 0.5;
          if (command === 'applyView' || command === 'frameCurrent') {
            const view = pick(random, VIEWS);
            legacy.applyView(view, { immediate });
            camera.applyView(view, { immediate });
          } else if (command === 'frameWhole') {
            legacy.frameWhole();
            camera.frameWhole();
          } else if (command === 'frameInternal') {
            legacy.frameInternal();
            camera.frameInternal();
          } else if (command === 'frameRegions') {
            const ids = [
              ...Array.from({ length: 1 + Math.floor(random() * 4) }, () =>
                pick(random, drawnRegions()),
              ),
              'no-such-region',
            ];
            legacy.frameRegions(ids);
            camera.frameRegions(ids);
          } else if (command === 'frameRegion') {
            const id = pick(random, selectable());
            model.select(id);
            const before = worlds[0].scene.moves.length;
            legacy.focusSelection({ immediate });
            const moved = worlds[0].scene.moves.length > before;
            assert.equal(camera.frameRegion(id, { immediate }), moved, label);
            model.select(null);
          } else if (command === 'frameLandmark') {
            const region = pick(random, drawnRegions());
            const view = pick(random, VIEWS);
            const margin = pick(random, [0, 5, 20, 45]);
            legacy.circuitCatalog.contextMarginMm = margin;
            const framed = legacy.frameLandmark({ region, view }, { immediate });
            assert.equal(camera.frameLandmark(region, view, margin, { immediate }), framed, label);
          } else if (command === 'faceCut') {
            const mode = pick(random, CUT_MODES);
            const reverse = random() < 0.5;
            const crosshair = [
              between(random, -60, 60),
              between(random, -80, 80),
              random() < 0.4 ? between(random, -260, -140) : between(random, -50, 70),
            ] as [number, number, number];
            // On either side of the brain's lower edge, where a cut changes from the brain's to the cord's.
            if (random() < 0.3)
              crosshair[2] = whole.min.y * 1000 + pick(random, [-1, -0.0005, 0.0005, 1]);
            const angles = { tilt: between(random, 0, 90), azimuth: between(random, -180, 180) };
            for (const world of worlds) {
              world.sections.active = true;
              world.sections.frame = centeredFrame(mode, crosshair, angles);
              world.sections.state = { mode, reverse };
            }
            legacy.faceCut({ immediate });
            assert.equal(camera.faceCut({ immediate }), legacyCutFacingView(mode, reverse), label);
            for (const world of worlds) world.sections.active = false;
          } else if (command === 'focusPoint') {
            const ras = [
              between(random, -70, 70),
              between(random, -90, 70),
              random() < 0.4 ? between(random, -250, -80) : between(random, -50, 70),
            ] as [number, number, number];
            legacy.focusPoint(legacyRasToWorld(ras));
            camera.focusPoint(ras);
          } else if (command === 'resize') {
            const width = pick(random, [390, 768, 1440]);
            const height = pick(random, [792, 1024, 900]);
            const sourced = {
              inset: { bottom: between(random, 0, 120) },
              scale: { horizontal: 1, vertical: 0.9 },
            };
            for (const world of worlds) {
              world.scene.resize(width, height);
              world.framingSource = sourced;
            }
            legacy.applyView('left', { immediate: true });
            camera.applyView('left', { immediate: true });
            assertSame(`${label}: before the resize`, ...bothScenes());
            for (const world of worlds) world.scene.resize(width * 1.4, height * 0.8);
            legacy.refitViewport();
            framing.onResize({ canvasChanged: true });
          } else if (command === 'refitDock') {
            legacy.applyView('oblique', { immediate: true });
            camera.applyView('oblique', { immediate: true });
            const next = {
              inset: { bottom: between(random, 0, 200) },
              scale: { horizontal: 1, vertical: between(random, 0.7, 1) },
            };
            for (const world of worlds) world.framingSource = next;
            legacy.refitDock();
            camera.refitDock();
          } else if (command === 'keepFraming') {
            const before = legacy.fittedDistance(legacy.heading());
            assert.ok(Object.is(before, camera.fittedDistance()), `${label}: the fit before`);
            const next = {
              inset: { bottom: between(random, 0, 200) },
              scale: { horizontal: 1, vertical: 1 },
            };
            for (const world of worlds) world.framingSource = next;
            legacy.keepFraming(before);
            camera.keepFraming(before);
          } else if (command === 'placeOrbit') {
            const stage = worlds[0].scene;
            const orbit = {
              position: stage.camera.position.clone().multiplyScalar(1000).toArray(),
              target: stage.controls.target.clone().multiplyScalar(1000).toArray(),
              ...(random() < 0.5 ? { up: [0, 0, -1] } : {}),
            };
            // Beyond the orbit limit both refuse, with the same error and nothing moved.
            const outcome = (run: () => void) => {
              try {
                run();
                return 'placed';
              } catch (error) {
                return `${(error as Error).name}: ${(error as Error).message}`;
              }
            };
            assert.equal(
              outcome(() => camera.placeOrbit(orbit as any, { immediate })),
              outcome(() => legacy.placeOrbit(orbit, { immediate })),
              label,
            );
            assert.deepEqual(camera.orbitLink(), legacy.orbitLink(), `${label}: the link`);
          } else {
            const pose = {
              ...worlds[0].scene.destination,
              zoom: between(random, 0.3, 2.5),
              held: random() < 0.5,
            };
            // The snapshot is opaque to the application and a plain pose here.
            const view = pick(random, VIEWS);
            legacy.restoreCamera(view, pose, { immediate });
            camera.restore(view, pose as unknown as CameraSnapshot, { immediate });
            const again = camera.capture();
            camera.restore(view, again, { immediate: true });
            assertSame(`${label}: a captured camera restores to itself`, ...bothScenes());
          }
          // Documented deviation (e7-zoom-after-framing): legacy kept a stale magnification after a framing
          // other than a named view; the legacy side takes the fix's bookkeeping to stay comparable.
          if (
            [
              'frameWhole',
              'frameInternal',
              'frameRegions',
              'frameRegion',
              'frameLandmark',
              'faceCut',
            ].includes(command)
          ) {
            legacy.rememberZoom();
          }
          assertSame(label, ...bothScenes());
          assert.equal(held.held, legacy.held, `${label}: whether the view is held`);
          reset();
        }
      },
    );
  }
});

// ---------------------------------------------------------------------------
// The held view: the gesture watcher of `viewport-chrome.js:546-599`.
// ---------------------------------------------------------------------------

const chromeSource = readFileSync(resolve(repoRoot, 'viewer/ui/chrome/viewport-chrome.js'), 'utf8');

function chromeSlice(from: string, to: string): string {
  const start = chromeSource.indexOf(from);
  const end = chromeSource.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `viewport-chrome.js moved: ${from}`);
  return chromeSource.slice(start, end);
}

const heldSource = [
  chromeSlice('/** Keys that move the camera', '/** The reader has rotated or clicked'),
  chromeSlice('  function holdView() {', '  // Once the reader has moved or clicked the model'),
  chromeSlice('  const onCanvasKey = event => {', '  if (hintRetired()) help.dataset'),
].join('\n');

type Listener = (event: any) => void;

/** An element that records its listeners and fires them with the event it is given. */
function createHost() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(fn));
    },
    removeEventListener: (type: string, fn: Listener) => listeners.get(type)?.delete(fn),
    fire: (type: string, event: object) => listeners.get(type)?.forEach((fn) => fn(event)),
  };
}

function createGestureControls() {
  const object = { position: new Vector3(0, 0, 0.3) };
  return Object.assign(new EventDispatcher<any>(), { object, target: new Vector3() });
}

function legacyHeld(
  controls: ReturnType<typeof createGestureControls>,
  host: ReturnType<typeof createHost>,
): Stub {
  return new Function(
    'controls',
    'host',
    'paintPresets',
    'dismissHelp',
    `
    let held = false;
    ${heldSource}
    host.addEventListener('keydown', onCanvasKey);
    return { holdView, releaseView, get held() { return held; } };`,
  )(
    controls,
    host,
    () => {},
    () => {},
  ) as Stub;
}

const LEGACY_CAMERA_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'];

describe('E7 held view: the legacy watcher and createHeldView agree', () => {
  it('releases on the camera keys legacy lists, and no others', () => {
    assert.deepEqual([...CAMERA_KEYS].sort(), [...LEGACY_CAMERA_KEYS].sort());
  });

  it('keeps watching a wheel step for 250 ms after it ends, to the millisecond', () => {
    vi.useFakeTimers();
    for (const wait of [0, 100, 230, 249, 250, 251]) {
      const controls = [createGestureControls(), createGestureControls()] as const;
      const legacy = legacyHeld(controls[0], createHost());
      const current = createHeldView({
        controls: controls[1],
        host: createHost() as any,
        onChange() {},
      });
      legacy.holdView();
      current.hold();
      for (const side of controls) side.dispatchEvent({ type: 'start' });
      for (const side of controls) side.dispatchEvent({ type: 'end' });
      vi.advanceTimersByTime(wait);
      for (const side of controls) {
        side.object.position.x += 1e-5;
        side.dispatchEvent({ type: 'change' });
      }
      assert.equal(legacy.held, wait < 250 ? false : true, `legacy after ${wait} ms`);
      assert.equal(current.held, legacy.held, `${wait} ms after the gesture ends`);
      current.dispose();
    }
  });

  it('follows the same gestures, wheel grace period and keys, to the epsilon', () => {
    vi.useFakeTimers();
    const random = prng(31);
    for (let trial = 0; trial < 60; trial++) {
      const controls = [createGestureControls(), createGestureControls()] as const;
      const hosts = [createHost(), createHost()] as const;
      const legacy = legacyHeld(controls[0], hosts[0]);
      const current = createHeldView({
        controls: controls[1],
        host: hosts[1] as any,
        onChange() {},
      });
      for (let step = 0; step < 30; step++) {
        const action = pick(random, ['hold', 'release', 'start', 'move', 'end', 'wait', 'key']);
        const label = `trial ${trial}, step ${step}: ${action}`;
        if (action === 'hold') {
          legacy.holdView();
          current.hold();
        } else if (action === 'release') {
          legacy.releaseView();
          current.release();
        } else if (action === 'start' || action === 'end') {
          for (const side of controls) side.dispatchEvent({ type: action });
        } else if (action === 'move') {
          // Steps either side of the epsilon, and a ten-fold one.
          const amount = pick(random, [0, 1e-7, 1e-6, 1.0000001e-6, 1e-5]);
          const axis = pick(random, ['position', 'target'] as const);
          for (const side of controls) {
            const vector = axis === 'position' ? side.object.position : side.target;
            vector.x += amount;
            side.dispatchEvent({ type: 'change' });
          }
        } else if (action === 'wait') {
          vi.advanceTimersByTime(pick(random, [100, 249, 250, 251]));
        } else {
          const event = {
            key: pick(random, [...LEGACY_CAMERA_KEYS, 'a', 'Enter', 'Escape']),
            target: { tagName: pick(random, ['CANVAS', 'CANVAS', 'DIV']) },
            ctrlKey: false,
            metaKey: false,
            altKey: false,
          };
          hosts[0].fire('keydown', event);
          hosts[1].fire('keydown', event);
        }
        assert.equal(current.held, legacy.held, label);
      }
      current.dispose();
    }
  });

  it('reports a change of the held state, and only a change', () => {
    const changes: boolean[] = [];
    const held = createHeldView({
      controls: createGestureControls(),
      host: createHost() as any,
      onChange: (value) => changes.push(value),
    });
    held.release();
    held.hold();
    held.hold();
    held.release();
    held.release();
    assert.deepEqual(changes, [true, false]);
  });

  // Deviation e7-held-view-modified-keys: the browser's zoom shortcuts are not camera moves.
  it('keeps the view for a camera key pressed with Ctrl, Meta or Alt', () => {
    const host = createHost();
    const held = createHeldView({
      controls: createGestureControls(),
      host: host as any,
      onChange() {},
    });
    const press = (modifiers: object) =>
      host.fire('keydown', { key: '-', target: { tagName: 'CANVAS' }, ...modifiers });
    held.hold();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      press({ [modifier]: true });
      assert.equal(held.held, true, modifier);
    }
    press({ shiftKey: true });
    assert.equal(held.held, false, 'Shift alone is how + is typed');
    const legacyHost = createHost();
    const legacy = legacyHeld(createGestureControls(), legacyHost);
    legacy.holdView();
    legacyHost.fire('keydown', { key: '-', ctrlKey: true, target: { tagName: 'CANVAS' } });
    assert.equal(legacy.held, false, 'legacy dropped the view on browser zoom');
  });
});

// ---------------------------------------------------------------------------
// Presentation: `highlight` and `outline` (app.js:1718-1751) and the picker's hover handler.
// ---------------------------------------------------------------------------

const presentationSource = slice(
  '  /** Mark what the pointer is on — a cut face lights',
  '  const CUT_LINKS',
);
const hoverHandlerSource = slice('    onHover: (region, position) => {', '    onSelect: select,');

describe('E7 presentation: the legacy highlight and outline and createPresentation draw the same', () => {
  it('lights, outlines and names the same regions over seeded hover, selection and cut sequences', () => {
    const random = prng(52);
    for (let trial = 0; trial < 40; trial++) {
      const ids = ['a', 'b', 'c', 'd'];
      const regions = new Map(ids.map((id) => [id, { id }]));
      const meshes: Mesh[] = ids.flatMap((id) =>
        [0, 1].map(() => Object.assign(new Mesh(), { userData: { region_id: id } }) as Mesh),
      );
      const overlapMesh = new Mesh();
      const state = {
        selected: null as string | null,
        blocked: new Set<string>(),
        cut: false,
        reference: false,
        overlap: false,
      };
      const world = () => {
        const log: unknown[] = [];
        const model = {
          get state() {
            return { selectedRegion: state.selected ? regions.get(state.selected) : null };
          },
          visibleMeshes: meshes,
          canSelect: (region: { id: string }) => !state.blocked.has(region.id),
        };
        const sections = {
          get active() {
            return state.cut;
          },
          setHighlight: (arg: unknown) => log.push(['highlight', arg]),
        };
        const scene = {
          setOutlined: (arg?: Stub) =>
            log.push([
              'outlined',
              arg && {
                selected: arg.selected.map((mesh: Mesh) => meshes.indexOf(mesh)),
                hovered: arg.hovered.map((mesh: Mesh) => meshes.indexOf(mesh)),
                overlap: arg.selected[0] === overlapMesh,
              },
            ]),
          invalidate: () => log.push(['invalidate']),
        };
        const overlay = {
          get outlined() {
            return state.overlap ? [overlapMesh] : [];
          },
        };
        return { log, model, sections, scene, overlay };
      };
      const a = world();
      const b = world();
      const legacy = new Function(
        'model',
        'sections',
        'scene',
        'overlapOverlay',
        'chrome',
        'hoverText',
        'isReference',
        `
        let hovered = null;
        const nativeReference = { get active() { return isReference(); } };
        ${presentationSource.replace('if (tractReferenceActive)', 'if (nativeReference.active)')}
        const handlers = { ${hoverHandlerSource} };
        return { onHover: handlers.onHover, outline };`,
      );
      const legacySide = legacy(
        a.model,
        a.sections,
        a.scene,
        a.overlay,
        {
          showHover: (label: unknown, position: unknown) =>
            a.log.push(['hover', label, position ?? null]),
        },
        (region: { id: string } | null) => region?.id ?? null,
        () => state.reference,
      );
      const current = createPresentation({
        scene: b.scene as any,
        model: b.model as any,
        sections: b.sections,
        overlay: b.overlay,
        referenceActive: () => state.reference,
        emit: ((type: string, event: { region: { id: string } | null; position: unknown }) => {
          if (type === 'hover') b.log.push(['hover', event.region?.id ?? null, event.position]);
        }) as any,
      });
      for (let step = 0; step < 40; step++) {
        const action = pick(random, [
          'hover',
          'hover',
          'leave',
          'select',
          'block',
          'cut',
          'overlap',
          'reference',
          'outline',
        ]);
        if (action === 'hover') {
          const region = regions.get(pick(random, ids))!;
          const position = { x: Math.floor(random() * 500), y: Math.floor(random() * 300) };
          legacySide.onHover(region, position);
          current.hover(region as any, position);
        } else if (action === 'leave') {
          legacySide.onHover(null, null);
          current.hover(null, null);
        } else {
          if (action === 'select') state.selected = random() < 0.3 ? null : pick(random, ids);
          if (action === 'block') {
            const id = pick(random, ids);
            if (state.blocked.has(id)) state.blocked.delete(id);
            else state.blocked.add(id);
          }
          if (action === 'cut') state.cut = !state.cut;
          if (action === 'overlap') state.overlap = !state.overlap;
          if (action === 'reference') state.reference = !state.reference;
          legacySide.outline();
          current.outline();
        }
        assert.deepEqual(b.log, a.log, `trial ${trial}, step ${step}: ${action}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The camera as a link carries it, and the MRI window the link carries.
// ---------------------------------------------------------------------------

const mriWindowSource = slice(
  '  /** The MRI window, when the reader has moved it',
  '  /** Panels word their own failures',
);

describe('E7 camera link: orbitLink, placeOrbit and the millimetre rounding', () => {
  it('reads the same orbit as legacy, exactly in millimetres, and the link rounds it to tenths', () => {
    const random = prng(91);
    model.reset();
    for (let trial = 0; trial < 60; trial++) {
      const worlds: [World, World] = [createWorld(), createWorld()];
      const legacy = legacyFraming(worlds[0]);
      const { camera } = currentFraming(worlds[1]);
      legacy.resetCaches();
      legacy.applyView('oblique', { immediate: true });
      camera.applyView('oblique', { immediate: true });
      // A held view has no link.
      assert.equal(legacy.orbitLink(), null);
      assert.equal(camera.orbitLink(), null);
      place(worlds, random);
      // An up vector off the named view's by a little either side of the 1e-3 a link tells apart.
      const lean = pick(random, [0, 0.0005, 0.0009, 0.0011, 0.005, 0.02]);
      for (const world of worlds) world.scene.camera.up.x += lean;
      legacy.chrome.releaseView();
      camera.orbitBy({});
      const expected = legacy.orbitLink();
      const orbit = camera.orbitLink()!;
      assert.deepEqual(orbit, expected, `trial ${trial}`);
      const { position, target } = worlds[1].scene.destination;
      // Exactly the metres times a thousand: the rounding belongs to the link writer, not the camera.
      assert.ok(
        orbit.position.every((value, axis) => Object.is(value, position.getComponent(axis) * 1000)),
      );
      assert.ok(
        orbit.target.every((value, axis) => Object.is(value, target.getComponent(axis) * 1000)),
      );
      const { state } = decodeState(`#${encodeState({ orbit })}`);
      const tenths = (value: number) => Math.round(value * 10) / 10;
      assert.deepEqual(state.orbit?.position, orbit.position.map(tenths));
      assert.deepEqual(state.orbit?.target, orbit.target.map(tenths));
    }
  });

  it('places a camera written at the orbit limit, and refuses one beyond the rounding', () => {
    const world = createWorld();
    const { camera } = currentFraming(world);
    camera.applyView('left', { immediate: true });
    const { maxDistance, target } = world.scene.destination;
    const at = (millimetres: number) => ({
      position: [target.x * 1000 - millimetres, target.y * 1000, target.z * 1000] as [
        number,
        number,
        number,
      ],
      target: target.toArray().map((value) => value * 1000) as [number, number, number],
    });
    camera.placeOrbit(at(maxDistance * 1000 + ORBIT_ROUNDING_MM / 2), { immediate: true });
    assert.ok(
      world.scene.destination.maxDistance >= maxDistance,
      'the limit only widens to admit the camera',
    );
    const reset = createWorld();
    const fresh = currentFraming(reset);
    fresh.camera.applyView('left', { immediate: true });
    assert.throws(
      () =>
        fresh.camera.placeOrbit(at(maxDistance * 1000 + 2 * ORBIT_ROUNDING_MM), {
          immediate: true,
        }),
      RangeError,
    );
  });
});

describe('E7 MRI window: the adapter and legacy mriWindowLink agree', () => {
  it('links the window only when it was moved off the published one', () => {
    const legacy = new Function('sections', `${mriWindowSource}; return mriWindowLink;`);
    const random = prng(17);
    for (let trial = 0; trial < 50; trial++) {
      const published = {
        window_center: Math.floor(random() * 200),
        window_width: 1 + Math.floor(random() * 200),
      };
      const display =
        random() < 0.15
          ? null
          : {
              windowCenter: published.window_center + (random() < 0.4 ? 1 : 0),
              windowWidth: published.window_width + (random() < 0.4 ? 1 : 0),
            };
      const loaded = random() < 0.9;
      const stub = {
        display,
        volumes: loaded ? { metadata: { display: published } } : null,
        state: { crosshair: [0, 0, 0] },
        frame: centeredFrame('axial', [0, 0, 0]),
      };
      assert.deepEqual(
        createEngineSections(stub as any).mriWindowLink(),
        legacy(stub)(),
        `trial ${trial}`,
      );
    }
  });
});
