/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, onTestFinished, vi } from 'vitest';
import {
  Box3,
  BoxGeometry,
  Matrix4,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import * as legacyCameraModule from '../../viewer/render/camera-views.js';
import * as legacyPath from '../../viewer/render/camera-path.js';
import * as legacyViewport from '../../viewer/render/effective-viewport.js';
import * as legacyOrbitModule from '../../viewer/render/orbit-controls.js';
import * as legacyKeyboard from '../../viewer/render/keyboard-orbit.js';
import * as legacyOrientationModule from '../../viewer/render/orientation.js';
import * as legacyScale from '../../viewer/render/scale-bar.js';
import * as legacyQuality from '../../viewer/render/quality.js';
import * as legacyDevice from '../../viewer/render/device.js';
import * as legacyEdges from '../../viewer/render/outline-edges.js';
import * as legacyOccluders from '../../viewer/render/outline-occluders.js';
import * as legacyCoordinatesModule from '../../viewer/slices/coordinates.js';
import volumes from '../../public/models/cdmd/volumes.json' with { type: 'json' };
import * as camera from '../src/lib/engine/render/camera-views.ts';
import * as path from '../src/lib/engine/render/camera-path.ts';
import * as viewport from '../src/lib/engine/render/effective-viewport.ts';
import * as orbitControls from '../src/lib/engine/render/orbit-controls.ts';
import * as keyboard from '../src/lib/engine/render/keyboard-orbit.ts';
import * as orientation from '../src/lib/engine/render/orientation.ts';
import * as scale from '../src/lib/engine/render/scale-bar.ts';
import * as quality from '../src/lib/engine/render/quality.ts';
import * as device from '../src/lib/engine/render/device.ts';
import * as edges from '../src/lib/engine/render/outline-edges.ts';
import * as occluders from '../src/lib/engine/render/outline-occluders.ts';
import * as coordinates from '../src/lib/engine/slices/coordinates.ts';
import { VIEW_NAMES } from '../src/lib/types/constants.ts';
import type { CutMode, Language, ViewName } from '../src/lib/types/index.ts';

type Matrix4Tuple = Parameters<Matrix4['set']>;

/** The JavaScript modules are typed by what they infer; parity asserts they behave as the ports. */
const legacyCamera = legacyCameraModule as unknown as typeof camera;
const legacyOrientation = legacyOrientationModule as unknown as typeof orientation;
const legacyCoordinates = legacyCoordinatesModule as unknown as typeof coordinates;

/** `deepStrictEqual` separates -0 from 0 and NaN from nothing, which is what bitwise parity needs. */
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

const random = mulberry32(0xe1);
const between = (low: number, high: number) => low + (high - low) * random();

// ---------------------------------------------------------------------------------------------
// Fixtures: bounds and point sets from the published meshes, plus synthetic boxes.
// ---------------------------------------------------------------------------------------------

const MODELS = new URL('../../public/models/cdmd/', import.meta.url);

/** Every vertex of every mesh in a published GLB, in world space, as one flat list. */
async function vertices(file: string): Promise<Float32Array> {
  const bytes = readFileSync(new URL(file, MODELS));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  gltf.scene.updateMatrixWorld(true);
  const flat: number[] = [];
  const point = new Vector3();
  gltf.scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      // getX/Y/Z de-quantises KHR_mesh_quantization.
      point
        .set(position.getX(i), position.getY(i), position.getZ(i))
        .applyMatrix4(mesh.matrixWorld);
      flat.push(point.x, point.y, point.z);
    }
  });
  return Float32Array.from(flat);
}

/** About `count` points drawn from a flat vertex list with the seeded generator. */
function sample(flat: Float32Array, count: number): Float32Array {
  const total = flat.length / 3;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const from = Math.floor(random() * total) * 3;
    out.set(flat.subarray(from, from + 3), i * 3);
  }
  return out;
}

const boundsOf = (flat: Float32Array) => {
  const box = new Box3();
  const point = new Vector3();
  for (let i = 0; i < flat.length; i += 3)
    box.expandByPoint(point.set(flat[i]!, flat[i + 1]!, flat[i + 2]!));
  return box;
};

const fixtures: { name: string; bounds: Box3; points: Float32Array | null }[] = [];
const requireVertices = (flat: Float32Array, file: string) => {
  assert.ok(flat.length > 0, `${file} has no vertices`);
  return flat;
};

const envelopes = requireVertices(await vertices('tissue-envelopes.glb'), 'tissue-envelopes.glb');
fixtures.push({
  name: 'whole brain',
  bounds: boundsOf(envelopes),
  points: sample(envelopes, 4000),
});
const cord = requireVertices(await vertices('spinal-cord.glb'), 'spinal-cord.glb');
fixtures.push({ name: 'spinal cord', bounds: boundsOf(cord), points: sample(cord, 2000) });
const structures = requireVertices(await vertices('structures.glb'), 'structures.glb');
fixtures.push({
  name: 'structures',
  bounds: boundsOf(structures),
  points: sample(structures, 2000),
});
fixtures.push({
  name: 'synthetic brain box',
  bounds: new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1)),
  points: null,
});
fixtures.push({
  name: 'small box',
  bounds: new Box3(new Vector3(0.01, 0.0, 0.0), new Vector3(0.02, 0.012, 0.01)),
  points: null,
});
fixtures.push({
  name: 'zero-size box',
  bounds: new Box3(new Vector3(0.01, 0.02, 0.03), new Vector3(0.01, 0.02, 0.03)),
  points: null,
});

const unitDirections = (count: number) =>
  Array.from({ length: count }, () =>
    new Vector3(between(-1, 1), between(-1, 1), between(-1, 1)).normalize(),
  );
const DIRECTIONS: [string, Vector3][] = [
  ...VIEW_NAMES.map((view): [string, Vector3] => [view, camera.VIEW_DIRECTIONS[view]]),
  ...unitDirections(12).map((direction, i): [string, Vector3] => [`random ${i}`, direction]),
  ['parallel to up', new Vector3(0, 1, 0)],
  ['parallel to back', new Vector3(0, 0, 1)],
];
const FITS = [
  {},
  { vertical: 0.55, horizontal: 1 },
  ...Array.from({ length: 8 }, () => ({ vertical: between(0.1, 1), horizontal: between(0.1, 1) })),
];
const LENSES: [number, number][] = [
  [35, 1.7],
  [35, 1.6],
  [50, 1],
  [50, 0.6],
];

const cameraAt = (fov: number, aspect: number, up: Vector3) => {
  const made = new PerspectiveCamera(fov, aspect, 0.001, 10);
  made.up.copy(up);
  return made;
};

describe('E1 camera-views', () => {
  it('has the same view table and helpers', () => {
    for (const view of VIEW_NAMES) {
      same(camera.VIEW_DIRECTIONS[view].toArray(), legacyCamera.VIEW_DIRECTIONS[view].toArray());
      same(camera.upFor(view).toArray(), legacyCamera.upFor(view).toArray());
    }
    same(camera.FRAME_FILL, legacyCamera.FRAME_FILL);
    same(camera.MIN_CONTEXT_RADIUS, legacyCamera.MIN_CONTEXT_RADIUS);
    for (const mode of ['off', 'sagittal', 'coronal', 'axial', 'oblique', 'constructor']) {
      for (const reverse of [false, true, undefined]) {
        same(
          camera.cutFacingView(mode as CutMode, reverse),
          legacyCamera.cutFacingView(mode as CutMode, reverse),
        );
      }
    }
    for (const cut of [undefined, 'off', 'sagittal', 'coronal', 'axial', 'oblique']) {
      for (const view of [undefined, null, 'left']) {
        same(
          camera.viewForRestoredCut({ cut: cut as CutMode, reverse: true, view: view as ViewName }),
          legacyCamera.viewForRestoredCut({
            cut: cut as CutMode,
            reverse: true,
            view: view as ViewName,
          }),
        );
      }
    }
    same(camera.viewForRestoredCut(), legacyCamera.viewForRestoredCut());
  });

  it('matches cameraConstraints and withContext on every fixture', () => {
    for (const { name, bounds } of fixtures) {
      same(camera.cameraConstraints(bounds), legacyCamera.cameraConstraints(bounds), name);
      for (const radius of [undefined, 0, 0.05, 0.2]) {
        same(
          camera.withContext(bounds, radius).toJSON(),
          legacyCamera.withContext(bounds, radius).toJSON(),
          `${name} ${radius}`,
        );
      }
    }
  });

  it('matches fitDistance and frameBounds per direction x fixture x lens x fit', () => {
    for (const { name, bounds, points } of fixtures) {
      for (const [label, direction] of DIRECTIONS) {
        for (const [fov, aspect] of LENSES) {
          const up = label === 'parallel to up' ? new Vector3(0, 1, 0) : camera.upFor('anterior');
          for (const fit of FITS) {
            for (const cloud of points ? [null, points] : [null]) {
              const here = cameraAt(fov, aspect, up);
              const there = cameraAt(fov, aspect, up);
              const context = `${name} ${label} ${fov}/${aspect} ${JSON.stringify(fit)}`;
              same(
                camera.fitDistance(here, bounds, direction, fit, cloud),
                legacyCamera.fitDistance(there, bounds, direction, fit, cloud),
                context,
              );
              same(
                camera.frameBounds(here, bounds, direction, fit, cloud).toArray(),
                legacyCamera.frameBounds(there, bounds, direction, fit, cloud).toArray(),
                context,
              );
              same(here.position.toArray(), there.position.toArray(), context);
              same(here.quaternion.toArray(), there.quaternion.toArray(), context);
            }
          }
        }
      }
    }
  });

  it('matches frameTo on a real OrbitControls, per view', () => {
    for (const { name, bounds, points } of fixtures) {
      for (const view of VIEW_NAMES) {
        for (const fit of FITS.slice(0, 3)) {
          const up = camera.upFor(view);
          const here = cameraAt(35, 1.6, up);
          const there = cameraAt(35, 1.6, up);
          const hereControls = new OrbitControls(here);
          const thereControls = new OrbitControls(there);
          const direction = camera.VIEW_DIRECTIONS[view];
          camera.frameTo(here, hereControls, bounds, direction, fit, points);
          legacyCamera.frameTo(there, thereControls, bounds, direction, fit, points);
          const context = `${name} ${view}`;
          same(here.position.toArray(), there.position.toArray(), context);
          same(here.quaternion.toArray(), there.quaternion.toArray(), context);
          same([here.near, here.far], [there.near, there.far], context);
          same(here.projectionMatrix.elements, there.projectionMatrix.elements, context);
          same(hereControls.target.toArray(), thereControls.target.toArray(), context);
          same(
            [hereControls.minDistance, hereControls.maxDistance],
            [thereControls.minDistance, thereControls.maxDistance],
            context,
          );
        }
      }
    }
  });
});

describe('E1 camera-path', () => {
  const brain = fixtures[0]!;
  const settled = (view: ViewName) => {
    const made = cameraAt(35, 1.6, camera.upFor(view));
    const controls = new OrbitControls(made);
    camera.frameTo(made, controls, brain.bounds, camera.VIEW_DIRECTIONS[view], {}, brain.points);
    controls.update();
    return { quaternion: made.quaternion, position: made.position, target: controls.target };
  };
  const goal = (view: ViewName) => {
    const made = cameraAt(35, 1.6, camera.upFor(view));
    const controls = new OrbitControls(made);
    camera.frameTo(made, controls, brain.bounds, camera.VIEW_DIRECTIONS[view], {}, brain.points);
    return {
      position: made.position.clone(),
      target: controls.target.clone(),
      up: made.up.clone(),
    };
  };
  const pose = (p: ReturnType<ReturnType<typeof path.orbitPath>>) => ({
    quaternion: p.quaternion.toArray(),
    position: p.position.toArray(),
    target: p.target.toArray(),
    up: p.up.toArray(),
  });

  it('matches frameOf', () => {
    for (let i = 0; i < 20; i++) {
      const [eye, target, up] = unitDirections(3);
      same(
        path.frameOf(eye!, target!, up!).toArray(),
        legacyPath.frameOf(eye, target, up).toArray(),
      );
    }
  });

  it('matches orbitPath samples for every ordered pair of views', () => {
    const times = [0, 0.25, 0.5, 0.75, 1, 1.5, ...Array.from({ length: 20 }, () => random())];
    for (const from of VIEW_NAMES) {
      for (const to of VIEW_NAMES) {
        const start = settled(from);
        const end = goal(to);
        const here = path.orbitPath(start, end);
        const there = legacyPath.orbitPath(start, end);
        for (const t of times) same(pose(here(t)), pose(there(t)), `${from} → ${to} at ${t}`);
      }
    }
  });
});

describe('E1 effective-viewport', () => {
  const canvases = [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 0, height: 0 },
    null,
    undefined,
    {},
  ];

  it('matches visibleRect, fitScale and viewOffset', () => {
    const insets = [
      {},
      { bottom: 300 },
      { left: 160 },
      { top: 100, bottom: 100 },
      { top: 900, bottom: 900, left: 900, right: 900 },
      { top: -5, left: -5 },
      ...Array.from({ length: 30 }, () => ({
        top: between(0, 400),
        right: between(0, 400),
        bottom: between(0, 600),
        left: between(0, 400),
      })),
    ];
    for (const canvas of canvases) {
      for (const inset of insets) {
        const rect = viewport.visibleRect(canvas, inset);
        same(rect, legacyViewport.visibleRect(canvas, inset));
        same(viewport.fitScale(canvas, rect), legacyViewport.fitScale(canvas, rect));
        same(viewport.viewOffset(canvas, rect), legacyViewport.viewOffset(canvas, rect));
      }
      same(viewport.fitScale(canvas), legacyViewport.fitScale(canvas));
      same(viewport.viewOffset(canvas, null), legacyViewport.viewOffset(canvas, null));
    }
  });

  it('matches clearFraming over a grid and seeded draws', () => {
    const sizes = [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 0, height: 0 },
      { width: 390, height: 40 },
    ];
    for (const size of sizes) {
      for (const dock of [0, 120, 480]) {
        for (const edge of [0, 28, 80]) {
          for (const fill of [0.8, 0.5]) {
            const clear = { top: edge, bottom: edge / 2, left: edge, right: edge };
            same(
              viewport.clearFraming(size, dock, clear, fill),
              legacyViewport.clearFraming(size, dock, clear, fill),
            );
          }
        }
      }
    }
    for (let i = 0; i < 50; i++) {
      const size = { width: between(0, 1600), height: between(0, 1000) };
      const clear = {
        top: between(0, 80),
        right: between(0, 80),
        bottom: between(0, 80),
        left: between(0, 80),
      };
      const dock = between(0, 500);
      same(
        viewport.clearFraming(size, dock, clear, 0.8),
        legacyViewport.clearFraming(size, dock, clear, 0.8),
      );
    }
  });
});

describe('E1 orbit-controls', () => {
  type Adapters = typeof orbitControls;
  const legacyOrbit = legacyOrbitModule as unknown as Adapters;
  type Driven = OrbitControls & {
    _mouse: Vector2;
    _performCursorZoom: boolean;
    _panOffset: Vector3;
  };

  // A single-sided plane between the camera and the target, as the anatomy's surfaces are.
  const surface = new Plane(new Vector3(-1, 0, 0), -0.06);
  const hit: orbitControls.Intersect = (raycaster) => {
    const { ray } = raycaster;
    if (ray.direction.dot(surface.normal) >= 0) return null;
    const point = ray.intersectPlane(surface, new Vector3());
    return point && point.distanceTo(ray.origin) <= raycaster.far ? { point } : null;
  };

  it('matches zoomAbout over seeded inputs', () => {
    for (let i = 0; i < 100; i++) {
      const position = new Vector3(between(-1, 1), between(-1, 1), between(-1, 1));
      const target = new Vector3(between(-1, 1), between(-1, 1), between(-1, 1));
      const point = new Vector3(between(-1, 1), between(-1, 1), between(-1, 1));
      const limits = { min: between(0.01, 0.2), max: between(1, 4) };
      const scale = between(0.001, 1000);
      const here = orbitControls.zoomAbout(position, target, point, scale, limits);
      const there = legacyOrbit.zoomAbout(position, target, point, scale, limits);
      same(
        [here.position.toArray(), here.target.toArray()],
        [there.position.toArray(), there.target.toArray()],
      );
    }
  });

  it('matches a seeded rotate/zoom/pan/up-change sequence through the adapters', () => {
    for (const adapters of [['follow'], ['follow', 'zoom'], ['follow', 'zoom', 'stay']]) {
      const steps = mulberry32(0xe1c + adapters.length);
      const build = (api: Adapters) => {
        const made = cameraAt(35, 1.4, new Vector3(0, 1, 0));
        const controls = new OrbitControls(made);
        controls.minDistance = 0.025;
        controls.maxDistance = 2.5;
        if (adapters.includes('follow')) api.followCameraUp(controls);
        if (adapters.includes('zoom')) api.zoomAboutSurface(controls, hit);
        if (adapters.includes('stay')) api.stayOutside(controls, hit);
        made.position.set(-0.1, 0.02, 0.05);
        controls.target.set(0.002, -0.011, 0.004);
        controls.update();
        return { made, controls };
      };
      const here = build(orbitControls);
      const there = build(legacyOrbit);
      const ups = [new Vector3(0, 1, 0), new Vector3(0, 0, -1), new Vector3(0, 0, 1)];
      for (let i = 0; i < 150; i++) {
        const kind = Math.floor(steps() * 6);
        const amount = (steps() - 0.5) * 1.5;
        const ndc = new Vector2(steps() * 2 - 1, steps() * 2 - 1);
        const pan = new Vector3(steps() - 0.5, steps() - 0.5, steps() - 0.5).multiplyScalar(0.05);
        const up = ups[Math.floor(steps() * ups.length)]!;
        for (const { made, controls } of [here, there]) {
          const driven = controls as unknown as Driven;
          if (kind === 0) controls.rotateLeft(amount);
          else if (kind === 1) controls.rotateUp(amount);
          else if (kind === 2) controls.dollyIn(1 + Math.abs(amount));
          else if (kind === 3) {
            driven._mouse.copy(ndc);
            driven._performCursorZoom = true;
            controls.dollyOut(1 + Math.abs(amount));
          } else if (kind === 4) driven._panOffset.add(pan);
          else made.up.copy(up);
          controls.update();
        }
        const context = `${adapters.join('+')} step ${i} kind ${kind}`;
        same(here.made.position.toArray(), there.made.position.toArray(), context);
        same(here.controls.target.toArray(), there.controls.target.toArray(), context);
        same(here.made.quaternion.toArray(), there.made.quaternion.toArray(), context);
      }
    }
  });
});

describe('E1 keyboard-orbit', () => {
  it('has the same keys and steps', () => {
    same(keyboard.ORBIT_STEP, legacyKeyboard.ORBIT_STEP);
    same(keyboard.ORBIT_KEYS, legacyKeyboard.ORBIT_KEYS);
    same(keyboard.DOLLY_KEYS, legacyKeyboard.DOLLY_KEYS);
  });

  it('turns real controls identically, with damping on and off', () => {
    for (const damping of [true, false]) {
      for (const key of Object.keys(keyboard.ORBIT_KEYS) as (keyof typeof keyboard.ORBIT_KEYS)[]) {
        const run = (turn: typeof keyboard.turnFromKeyboard) => {
          const made = cameraAt(35, 1.4, new Vector3(0, 1, 0));
          const controls = new OrbitControls(made);
          controls.enableDamping = damping;
          made.position.set(0.05, 0.1, 0.2);
          controls.update();
          turn(controls, keyboard.ORBIT_KEYS[key]);
          controls.update();
          return [made.position.toArray(), controls.enableDamping];
        };
        same(
          run(keyboard.turnFromKeyboard),
          run(legacyKeyboard.turnFromKeyboard),
          `${key} ${damping}`,
        );
      }
    }
  });
});

describe('E1 orientation', () => {
  it('matches edgeLabels for named views and 200 free orbits', () => {
    const cameras: [string, PerspectiveCamera, Vector3 | null][] = [];
    for (const view of VIEW_NAMES) {
      const made = cameraAt(35, 1.6, camera.upFor(view));
      made.position.copy(camera.VIEW_DIRECTIONS[view]).multiplyScalar(0.5);
      made.lookAt(0, 0, 0);
      made.updateMatrixWorld(true);
      cameras.push([view, made, null], [`${view} with target`, made, new Vector3(0, 0, 0)]);
    }
    for (let i = 0; i < 200; i++) {
      const made = cameraAt(
        35,
        1.6,
        new Vector3(between(-1, 1), between(-1, 1), between(-1, 1)).normalize(),
      );
      made.position.set(between(-1, 1), between(-1, 1), between(-1, 1));
      made.lookAt(0, 0, 0);
      made.updateMatrixWorld(true);
      // A stale world matrix on purpose: with a target the matrix must not be read.
      cameras.push([`free ${i}`, made, i % 2 ? new Vector3(0.01, 0.02, 0.03) : null]);
    }
    for (const [label, made, target] of cameras) {
      for (const lang of ['en', 'fr'] as Language[]) {
        same(
          orientation.edgeLabels(made, lang, target),
          legacyOrientation.edgeLabels(made, lang, target),
          `${label} ${lang}`,
        );
      }
    }
    const raw = { right: 'R', left: 'L', top: 'S', bottom: 'I' } as const;
    for (const lang of ['en', 'fr', undefined] as (Language | undefined)[]) {
      same(orientation.localizeEdges(raw, lang), legacyOrientation.localizeEdges(raw, lang));
    }
  });
});

describe('E1 scale-bar', () => {
  it('matches millimetresPerPixel and scaleBar', () => {
    const distances = [
      ...Array.from({ length: 40 }, (_, i) => 0.005 * Math.pow(2 / 0.005, i / 39)),
      Number.NaN,
      0,
      -1,
    ];
    for (const fov of [35, 50]) {
      for (const distance of distances) {
        for (const height of [0, 1, 600, 900, 1800, Number.NaN]) {
          same(scale.scaleBar(fov, distance, height), legacyScale.scaleBar(fov, distance, height));
          same(
            scale.millimetresPerPixel(fov, distance, height),
            legacyScale.millimetresPerPixel(fov, distance, height),
          );
        }
      }
    }
  });
});

describe('E1 quality and device', () => {
  it('matches qualityProfile over the full input product', () => {
    const flags = [false, true];
    for (const phone of flags) {
      for (const coarse of flags) {
        for (const saveData of flags) {
          for (const integrated of flags) {
            for (const appleSilicon of flags) {
              for (const pixelRatio of [1, 1.5, 2, 3]) {
                for (const deviceMemory of [2, 4, 8]) {
                  const input = {
                    phone,
                    coarse,
                    saveData,
                    integrated,
                    appleSilicon,
                    pixelRatio,
                    deviceMemory,
                  };
                  same(
                    quality.qualityProfile(input),
                    legacyQuality.qualityProfile(input),
                    JSON.stringify(input),
                  );
                }
              }
            }
          }
        }
      }
    }
  });

  it('matches the defaulted path under stubbed browser globals', () => {
    for (const [matches, ratio] of [
      [true, 2],
      [false, 1],
      [false, 3],
    ] as const) {
      vi.stubGlobal('matchMedia', () => ({ matches }));
      vi.stubGlobal('devicePixelRatio', ratio);
      vi.stubGlobal('navigator', {
        connection: { saveData: matches },
        deviceMemory: matches ? 2 : 8,
      });
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });
      const input = { integrated: false };
      same(quality.qualityProfile(input), legacyQuality.qualityProfile(input));
      same(
        quality.qualityProfile({ ...input, integrated: true }),
        legacyQuality.qualityProfile({ ...input, integrated: true }),
      );
      same(device.isPhone(), legacyDevice.isPhone());
      same(device.isCoarse(), legacyDevice.isCoarse());
      same(device.pixelRatioCap(false), legacyDevice.pixelRatioCap(false));
      same(device.pixelRatioCap(true), legacyDevice.pixelRatioCap(true));
    }
  });

  it('matches motionRatio and the renderer-name tests', () => {
    for (const cap of [1, 1.5, 2]) {
      for (const [width, height] of [
        [0, 0],
        [1440, 900],
        [390, 844],
        [3840, 2160],
        [0, 500],
      ] as const) {
        same(
          quality.motionRatio(cap, width, height),
          legacyQuality.motionRatio(cap, width, height),
        );
      }
    }
    for (const name of [
      '',
      'Apple M4 Pro',
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)',
      'NVIDIA GeForce RTX 4090/PCIe/SSE2',
      'AMD Radeon RX 6800 XT',
      'AMD Radeon Pro 5500M OpenGL Engine',
      'Intel Arc A770',
      'Intel(R) UHD Graphics 770',
    ]) {
      same(device.isIntegratedGpu(name), legacyDevice.isIntegratedGpu(name));
      same(device.isAppleSilicon(name), legacyDevice.isAppleSilicon(name));
    }
    same(device.isIntegratedGpu(), legacyDevice.isIntegratedGpu());
    same(device.gpuRendererName(null), legacyDevice.gpuRendererName(null));
    same(device.detectIntegratedGpu(), legacyDevice.detectIntegratedGpu());
  });
});

describe('E1 coordinates', () => {
  const MODES = ['sagittal', 'coronal', 'axial', 'oblique'] as const;
  const frameJson = (frame: coordinates.Frame) => ({
    center: frame.center.toArray(),
    normal: frame.normal.toArray(),
    u: frame.u.toArray(),
    v: frame.v.toArray(),
    edges: frame.edges,
  });

  it('matches the RAS conversions and the voxel matrix', () => {
    for (let i = 0; i < 50; i++) {
      const ras = [between(-120, 120), between(-120, 120), between(-120, 120)] as const;
      same(coordinates.rasToWorld(ras).toArray(), legacyCoordinates.rasToWorld(ras).toArray());
      const world = coordinates.rasToWorld(ras);
      same(coordinates.worldToRas(world), legacyCoordinates.worldToRas(world));
    }
    same(
      coordinates.worldToRas(new Vector3(0, 0, 0)),
      legacyCoordinates.worldToRas(new Vector3(0, 0, 0)),
    );
    // The inverse is built as slices/volume.js builds it.
    const affine = volumes.mri.voxel_to_surface_ras_mm.flat();
    const volume = { inverse: new Matrix4().set(...(affine as Matrix4Tuple)).invert().elements };
    same(
      coordinates.worldToVoxelMatrix(volume).elements,
      legacyCoordinates.worldToVoxelMatrix(volume).elements,
    );
  });

  it('matches frames, clipping planes, centred frames and points on a frame', () => {
    const angles = [
      undefined,
      ...[0, 30, 90].flatMap((tilt) => [-180, 0, 30, 180].map((azimuth) => ({ tilt, azimuth }))),
    ];
    for (const mode of MODES) {
      for (const angle of angles) {
        for (let i = 0; i < 6; i++) {
          const ras = [between(-120, 120), between(-120, 120), between(-120, 120)] as const;
          const here = coordinates.createFrame(mode, ras, angle);
          const there = legacyCoordinates.createFrame(mode, ras, angle);
          same(frameJson(here), frameJson(there));
          same(
            frameJson(coordinates.centeredFrame(mode, ras, angle)),
            frameJson(legacyCoordinates.centeredFrame(mode, ras, angle)),
          );
          for (const reverse of [false, true]) {
            const planeJson = (plane: Plane) => [plane.normal.toArray(), plane.constant];
            same(
              planeJson(coordinates.clippingPlane(here, reverse)),
              planeJson(legacyCoordinates.clippingPlane(there, reverse)),
            );
          }
          const x = random();
          const y = random();
          same(
            coordinates.pointOnFrame(here, x, y, 256),
            legacyCoordinates.pointOnFrame(there, x, y, 256),
          );
          const range = [-128, 128] as const;
          same(
            coordinates.offsetThrough(ras, here.normal, range),
            legacyCoordinates.offsetThrough(ras, there.normal, range),
          );
        }
      }
    }
  });

  it('throws the same errors', () => {
    const attempts: [string, () => unknown, () => unknown][] = [
      [
        'unknown plane',
        () => coordinates.createFrame('banana' as CutMode, [0, 0, 0]),
        () => legacyCoordinates.createFrame('banana' as CutMode, [0, 0, 0]),
      ],
      [
        'off',
        () => coordinates.createFrame('off', [0, 0, 0]),
        () => legacyCoordinates.createFrame('off', [0, 0, 0]),
      ],
      [
        'non-finite',
        () => coordinates.createFrame('axial', [Number.NaN, 0, 0]),
        () => legacyCoordinates.createFrame('axial', [Number.NaN, 0, 0]),
      ],
      [
        'length',
        () => coordinates.createFrame('axial', [0, 0] as never),
        () => legacyCoordinates.createFrame('axial', [0, 0] as never),
      ],
      [
        'tilt',
        () => coordinates.createFrame('oblique', [0, 0, 0], { tilt: 91 }),
        () => legacyCoordinates.createFrame('oblique', [0, 0, 0], { tilt: 91 }),
      ],
      [
        'azimuth',
        () => coordinates.createFrame('oblique', [0, 0, 0], { azimuth: 181 }),
        () => legacyCoordinates.createFrame('oblique', [0, 0, 0], { azimuth: 181 }),
      ],
      [
        'offset',
        () => coordinates.offsetThrough([Infinity, 0, 0], new Vector3(1, 0, 0), [-1, 1]),
        () => legacyCoordinates.offsetThrough([Infinity, 0, 0], new Vector3(1, 0, 0), [-1, 1]),
      ],
      [
        'range',
        () => coordinates.offsetThrough([0, 0, 0], new Vector3(1, 0, 0), [Number.NaN, 1]),
        () => legacyCoordinates.offsetThrough([0, 0, 0], new Vector3(1, 0, 0), [Number.NaN, 1]),
      ],
    ];
    for (const [label, here, there] of attempts) {
      let expected: unknown;
      try {
        there();
      } catch (error) {
        expected = error;
      }
      assert.ok(expected, `${label}: legacy throws`);
      assert.throws(
        here,
        { name: (expected as Error).name, message: (expected as Error).message },
        label,
      );
    }
  });
});

describe('E1 outline helpers', () => {
  it('matches sameMeshSet on permutations, duplicates and empty lists', () => {
    const [a, b, c] = [new Object3D(), new Object3D(), new Object3D()] as [
      Object3D,
      Object3D,
      Object3D,
    ];
    for (const [x, y] of [
      [
        [a, b],
        [b, a],
      ],
      [[a], [a]],
      [[], []],
      [[a], [b]],
      [[a, b], [a]],
      [
        [a, a],
        [a, b],
      ],
      [
        [a, b, c],
        [c, b, a],
      ],
      [[a], []],
    ] as [Object3D[], Object3D[]][]) {
      same(edges.sameMeshSet(x, y), legacyEdges.sameMeshSet(x, y));
    }
  });

  /** A scene of seeded boxes with a pass selecting the first few, drawn through each implementation. */
  function occlusionRun(
    withOccluders: typeof occluders.withOutlineOccluders,
    options: {
      boxes: number;
      selected: number;
      cameraZ: number;
      empty?: boolean;
      throws?: boolean;
    },
  ) {
    const placement = mulberry32(options.boxes * 31 + options.selected);
    const scene = new Scene();
    const made = new PerspectiveCamera(40, 1, 0.1, 100);
    made.position.z = options.cameraZ;
    made.updateMatrixWorld(true);
    made.updateProjectionMatrix();
    const meshes: Mesh[] = [];
    for (let i = 0; i < options.boxes; i++) {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1));
      mesh.position.set(placement() * 12 - 6, placement() * 12 - 6, placement() * 12 - 6);
      scene.add(mesh);
      meshes.push(mesh);
    }
    const pass = new OutlinePass(
      new Vector2(256, 256),
      scene,
      made,
      options.empty ? [] : meshes.slice(0, options.selected),
    );
    const seen: boolean[] = [];
    const render = () => {
      seen.push(...meshes.map((mesh) => mesh.visible));
      if (options.throws) throw new Error('render failed');
      return 'rendered';
    };
    let result: unknown;
    try {
      result = withOccluders(pass, render);
    } catch (error) {
      result = (error as Error).message;
    }
    return { result, seen, after: meshes.map((mesh) => mesh.visible) };
  }

  it('matches withOutlineOccluders on a seeded scene and the early returns', () => {
    for (const options of [
      { boxes: 30, selected: 3, cameraZ: 20 },
      { boxes: 30, selected: 1, cameraZ: 20 },
      { boxes: 30, selected: 30, cameraZ: 20 },
      { boxes: 30, selected: 3, cameraZ: 0 },
      { boxes: 5, selected: 2, cameraZ: 20, empty: true },
      { boxes: 30, selected: 3, cameraZ: 20, throws: true },
    ]) {
      same(
        occlusionRun(occluders.withOutlineOccluders, options),
        occlusionRun(legacyOccluders.withOutlineOccluders, options),
        JSON.stringify(options),
      );
    }
  });

  it('matches paintOutlineEdges up to the documented stencil restoration', () => {
    const run = (
      paint: typeof edges.paintOutlineEdges,
      maskActive: boolean,
      pulsePeriod: number,
    ) => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000_000);
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const calls: unknown[] = [];
      const note =
        (name: string) =>
        (...args: unknown[]) => {
          calls.push([
            name,
            ...args.map((arg) =>
              typeof arg === 'object'
                ? (arg as { constructor: { name: string } })?.constructor?.name
                : arg,
            ),
          ]);
        };
      const stencil = { setTest: note('stencil.setTest') };
      const renderer = {
        autoClear: true,
        state: { buffers: { stencil } },
        getClearColor: note('getClearColor'),
        getClearAlpha: () => 0.5,
        setClearColor: note('setClearColor'),
        setRenderTarget: note('setRenderTarget'),
        clear: note('clear'),
      };
      const pass = new OutlinePass(new Vector2(64, 64), new Scene(), new PerspectiveCamera());
      pass.pulsePeriod = pulsePeriod;
      const quad = (pass as unknown as { _fsQuad: { render: unknown } })._fsQuad;
      quad.render = note('quad.render');
      paint(
        pass,
        pass.renderTargetMaskBuffer.texture,
        renderer as never,
        pass.renderTargetMaskBuffer,
        maskActive,
      );
      return { calls, autoClear: renderer.autoClear, pulse: pass.tempPulseColor1.toArray() };
    };
    for (const maskActive of [false, true]) {
      for (const pulsePeriod of [0, 2]) {
        same(
          run(edges.paintOutlineEdges, maskActive, pulsePeriod),
          run(legacyEdges.paintOutlineEdges, maskActive, pulsePeriod),
        );
      }
    }
  });
});

describe('E1 quaternion helper sanity', () => {
  it('uses one Three.js instance for web/ and viewer/', () => {
    assert.ok(new Quaternion().equals(new Quaternion()));
    assert.ok(legacyCamera.VIEW_DIRECTIONS.left instanceof Vector3);
  });
});
