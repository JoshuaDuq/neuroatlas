import { Box3, Sphere, Vector3 } from 'three';
import type { Mesh } from 'three';
import { orbitWithin } from '../core/state/url-state.ts';
import type { ModelState, Orbit, Region, ViewName } from '../types/index.ts';
import type {
  CameraSnapshot,
  CameraView,
  ChromeInsets,
  EngineCamera,
  EngineEvents,
  FramingClearance,
  MoveOptions,
  OrbitTurn,
  Rect,
  Size,
  Vec3,
} from './api.ts';
import type { HeldView } from './held-view.ts';
import type { AtlasMesh } from './model/brain-atlas.ts';
import {
  VIEW_DIRECTIONS,
  cutFacingView,
  fitDistance,
  frameTo,
  upFor,
  withContext,
} from './render/camera-views.ts';
import { turnFromKeyboard } from './render/keyboard-orbit.ts';
import { edgeLabels } from './render/orientation.ts';
import { scaleBar } from './render/scale-bar.ts';
import { planFraming } from './render/scene.ts';
import type { CameraPlan, EngineScene } from './render/scene.ts';
import { rasToWorld } from './slices/coordinates.ts';
import type { Frame } from './slices/coordinates.ts';

export type Emit = <K extends keyof EngineEvents>(type: K, event: EngineEvents[K]) => void;

/** Half the side of the box a cut through the spinal cord is framed in, in metres (app.js:1291). */
const CORD_CUT_HALF_BOX_M = 0.04;
/** How close the camera may come to a point below the brain, e.g. on the cord, in metres (app.js:1790). */
const CORD_MIN_DISTANCE_M = 0.015;
/** Vertices past which framing keeps one in `THINNED_STRIDE` (app.js:325). */
const THINNED_VERTICES = 60000;
const THINNED_STRIDE = 8;
/** A framing fits the whole brain, so the reader's magnification starts at one. */
const WHOLE_ZOOM = 1;
/** Beyond this the up vector differs from the named view's and a link carries it (app.js:821). */
const UP_DIFFERS = 1e-3;
const MM_PER_M = 1000;

/** What framing reads of the scene. */
export type FramingScene = Pick<
  EngineScene,
  | 'camera'
  | 'controls'
  | 'destination'
  | 'moveTo'
  | 'viewportFit'
  | 'setFramingInset'
  | 'setChromeInsets'
  | 'visibleRect'
  | 'hostSize'
  | 'distanceToTarget'
  | 'viewportHeight'
>;

/** What framing reads of the model: the display state, and what is drawn. */
export interface FramingModel {
  readonly state: ModelState;
  readonly visibleMeshes: readonly AtlasMesh[];
  readonly regions: ReadonlyMap<string, Region>;
}

/** What framing reads of the cut. */
export interface FramingSections {
  readonly active: boolean;
  readonly frame: Frame;
  readonly state: { readonly mode: Parameters<typeof cutFacingView>[0]; readonly reverse: boolean };
}

/** The tract reference: shown alone on an anatomy the tracts do not belong to. */
export interface TractReference {
  active: boolean;
  /** Where its streamlines lie; null until the reference has loaded. */
  readonly bounds: Box3 | null;
}

export interface FramingOptions {
  scene: FramingScene;
  model: FramingModel;
  sections: FramingSections;
  held: HeldView;
  /** The whole brain, without the supplemental layers. */
  bounds: Box3;
  reference: TractReference;
  emit: Emit;
}

/** The captured camera `capture` hands out and `restore` takes back (app.js:754-766). */
interface CapturedCamera {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
  zoom: number;
  held: boolean;
}

export interface Framing {
  readonly camera: EngineCamera;
  /** The drawn set changed: the cached bounds and points are stale (app.js:1614). */
  invalidate(): void;
  /** Move the camera onto a point of the surface in world metres: the picker's double click (app.js:1783). */
  focusWorldPoint(point: Vector3): void;
  /** Where zooming out leads the orbit target: what is framed, and the distance it fills the stage from. */
  home(direction: Vector3): { center: Vector3; distance: number };
  /** The stage's canvas resized (app.js:115-125). */
  onResize(change: { canvasChanged: boolean }): void;
  /** The tract reference opened or closed (app.js:1431). */
  onReference(): void;
  /** The tract reference finished loading (app.js:1442). */
  onReferenceReady(): void;
}

const thinned = (vertices: number) => (vertices > THINNED_VERTICES ? THINNED_STRIDE : 1);

/**
 * Where the camera goes and what it keeps (app.js:241-524, 781-822, 1116-1138, 1269-1297, 1495-1550,
 * 1782-1851). It holds the reader's magnification, the framing clearances and the view the camera was
 * last framed on; the held view and the scene are its collaborators.
 */
export function createFraming({
  scene,
  model,
  sections,
  held,
  bounds,
  reference,
  emit,
}: FramingOptions): Framing {
  const { camera, controls } = scene;
  let view: ViewName = 'oblique';
  let framed = false;
  let framingSource: (() => FramingClearance) | null = null;
  // The reader's magnification, as a multiple of the distance at which the whole brain just fills the
  // stage. Held across a resize so that a stage which changes shape re-fits instead of clipping the
  // anatomy off its sides or stranding it in the middle of a much larger field.
  let zoom = WHOLE_ZOOM;
  let framingScale = { horizontal: 1, vertical: 1 };
  let cachedBounds: Box3 | null = null;
  let cachedPoints: Float32Array | null = null;
  let orbiting = false;
  let dockPending = false;
  let fitPending: number | null = null;
  let shown: CameraView = describeCamera();

  function describeCamera(): CameraView {
    return {
      edges: edgeLabels(camera, 'en', controls.target),
      scale: scaleBar(camera.fov, scene.distanceToTarget, scene.viewportHeight),
    };
  }

  function publishCamera() {
    shown = describeCamera();
    emit('camera', shown);
  }

  function publishViewport() {
    emit('viewport', { visibleRect: { ...scene.visibleRect }, hostSize: { ...scene.hostSize } });
  }

  // Every camera move is a change the link has to follow. A framing chooses its own target, so the pan
  // limit set for the last gesture no longer applies.
  function moveCamera(plan: CameraPlan, options?: MoveOptions) {
    controls.maxTargetRadius = Infinity;
    scene.moveTo(plan, options);
    emit('cameraSettled', undefined);
  }

  /** The camera's heading where it is going, so a move in flight is read where it lands. */
  const heading = () =>
    scene.destination.position.clone().sub(scene.destination.target).normalize();

  function requireView(name: ViewName): ViewName {
    if (!Object.hasOwn(VIEW_DIRECTIONS, name)) throw new Error(`Unknown view: ${name}`);
    return name;
  }

  const meshesOf = (id: string) =>
    model.visibleMeshes.filter((mesh) => mesh.userData['region_id'] === id);

  function boundsOf(meshes: readonly Mesh[]): Box3 {
    const box = new Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    return box;
  }

  function framingBounds(): Box3 {
    if (reference.active && reference.bounds) return reference.bounds;
    const { isolatedRegion, internalSystem, cortexVisible, hemisphere, spinalCordVisible } =
      model.state;
    if (isolatedRegion) {
      if (!cachedBounds) {
        const visible = boundsOf(model.visibleMeshes);
        cachedBounds = visible.isEmpty() ? bounds : visible;
      }
      return cachedBounds;
    }
    if (internalSystem === 'Spinal cord') {
      if (!cachedBounds) {
        const cord = boundsOf(
          model.visibleMeshes.filter((mesh) => mesh.userData['atlas'] === 'zanatomy'),
        );
        cachedBounds = cord.isEmpty() ? bounds : cord;
      }
      return cachedBounds;
    }
    // One hemisphere, or the cord added beneath the brain, is not the box the page opened with. Fit
    // what is actually drawn, or the picture keeps a hole where the hidden half was and the cord stays
    // below the frame.
    if (cortexVisible && (hemisphere !== 'both' || spinalCordVisible)) {
      if (!cachedBounds) {
        const visible = hemisphere === 'both' ? bounds.clone() : new Box3();
        for (const mesh of model.visibleMeshes) {
          if (hemisphere === 'both' && mesh.userData['atlas'] !== 'zanatomy') continue;
          visible.expandByObject(mesh);
        }
        cachedBounds = visible.isEmpty() ? bounds : visible;
      }
      return cachedBounds;
    }
    if (cortexVisible) return bounds;
    if (!cachedBounds) {
      const visible = boundsOf(
        model.visibleMeshes.filter((mesh) => mesh.userData['atlas'] !== 'zanatomy'),
      );
      cachedBounds = visible.isEmpty() ? bounds : visible;
    }
    return cachedBounds;
  }

  /**
   * The vertices framing actually has to contain, in world space.
   *
   * A bounding box is the cheap answer and a loose one: its far corner sticks out past a brain that
   * never reaches it, so an oblique view backs the camera away from a corner rather than from
   * anatomy. Fitting the vertices themselves is exact rather than merely tighter, so it cannot crop
   * anything the box would have kept. Recomputed only when the framed set changes, and sampled where
   * a layer is dense: one vertex in eight of a millimetre-spaced surface still bounds the silhouette
   * far inside the screen margin.
   */
  function framingPoints(): Float32Array | null {
    if (reference.active) return null;
    if (cachedPoints) return cachedPoints;
    const box = framingBounds();
    const meshes = model.visibleMeshes.filter((mesh) =>
      box.intersectsBox(new Box3().setFromObject(mesh)),
    );
    if (!meshes.length) return null;
    const stride = thinned(
      meshes.reduce((total, mesh) => total + mesh.geometry.attributes['position']!.count, 0),
    );
    const kept: number[] = [];
    const point = new Vector3();
    for (const mesh of meshes) {
      const position = mesh.geometry.attributes['position']!;
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < position.count; i += stride) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        // Only what the box already framed. A long supplemental layer can reach into the box and far
        // past it, and framing it would undo the choice of what to frame.
        if (box.containsPoint(point)) kept.push(point.x, point.y, point.z);
      }
    }
    cachedPoints = kept.length ? new Float32Array(kept) : null;
    return cachedPoints;
  }

  /** The meshes' vertices in world space, thinned like the whole brain's framing points. */
  function silhouette(meshes: readonly Mesh[]): Float32Array {
    const stride = thinned(
      meshes.reduce((total, mesh) => total + mesh.geometry.attributes['position']!.count, 0),
    );
    const kept: number[] = [];
    const point = new Vector3();
    for (const mesh of meshes) {
      const position = mesh.geometry.attributes['position']!;
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < position.count; i += stride) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        kept.push(point.x, point.y, point.z);
      }
    }
    return new Float32Array(kept);
  }

  /** The scene's fit, narrowed so the anatomy also clears the orientation letters and scale bar. */
  const clearedFit = () => {
    const fit = scene.viewportFit;
    return {
      horizontal: fit.horizontal * framingScale.horizontal,
      vertical: fit.vertical * framingScale.vertical,
    };
  };

  const fittedDistance = (direction: Vector3) =>
    fitDistance(camera, framingBounds(), direction, clearedFit(), framingPoints());

  const isTargetingSpine = () =>
    !reference.active &&
    Boolean(
      model.state.spinalCordVisible &&
      (controls.target.y < bounds.min.y || model.state.internalSystem === 'Spinal cord'),
    );

  /** Framing fits above the stage dock, measured now: the section bar can change it in the same task. */
  function applyFraming({ immediate = false }: MoveOptions = {}): boolean {
    const { inset, scale } = framingSource?.() ?? {
      inset: {},
      scale: { horizontal: 1, vertical: 1 },
    };
    const rescaled =
      scale.horizontal !== framingScale.horizontal || scale.vertical !== framingScale.vertical;
    framingScale = scale;
    return scene.setFramingInset(inset, { immediate }) || rescaled;
  }

  function framingFit(options?: MoveOptions) {
    applyFraming(options);
    return clearedFit();
  }

  /** The magnification the camera has where it is going, so a later resize keeps it. */
  function rememberZoom() {
    const plan = scene.destination;
    const fitted = fittedDistance(heading());
    if (fitted > 0) zoom = plan.position.distanceTo(plan.target) / fitted;
  }

  function refitViewport() {
    if (!framed) return;
    const plan = scene.destination;
    const direction = plan.position.clone().sub(plan.target).normalize();
    const fitted = fittedDistance(direction);
    if (!(fitted > 0)) return;
    // Commit through the scene so an in-flight frame cannot restore its old viewport's endpoint.
    scene.moveTo(
      { ...plan, position: plan.target.clone().addScaledVector(direction, fitted * zoom) },
      { immediate: true },
    );
  }

  /** Scale the camera's distance from a fit of `before` to the room it has now, keeping heading and target. */
  function refit(before: number) {
    applyFraming();
    const direction = heading();
    const after = fittedDistance(direction);
    if (!(before > 0 && after > 0) || after === before) return;
    const plan = scene.destination;
    const distance = (plan.position.distanceTo(plan.target) * after) / before;
    moveCamera({ ...plan, position: plan.target.clone().addScaledVector(direction, distance) });
  }

  function refitDock() {
    if (!framed) return;
    if (orbiting) {
      dockPending = true;
      return;
    }
    const plan = scene.destination;
    const direction = plan.position.clone().sub(plan.target).normalize();
    const before = fittedDistance(direction);
    if (!applyFraming()) return;
    const after = fittedDistance(direction);
    if (!(before > 0 && after > 0)) return;
    const distance = (plan.position.distanceTo(plan.target) * after) / before;
    moveCamera({ ...plan, position: plan.target.clone().addScaledVector(direction, distance) });
  }

  /**
   * Frame a named view against the part of the canvas the interface is not covering. Separate from
   * `applyView` because the sheet reframes without changing which view is chosen.
   */
  function frameCurrent(name: ViewName, { immediate = false }: MoveOptions = {}) {
    fitPending = null;
    view = requireView(name);
    const fit = framingFit({ immediate: immediate || !framed });
    camera.up.copy(upFor(view));
    if (isTargetingSpine()) {
      const direction = VIEW_DIRECTIONS[view];
      const target = controls.target.clone();
      const distance =
        scene.distanceToTarget > 0 ? scene.distanceToTarget : fittedDistance(direction);
      moveCamera(
        {
          position: target.clone().addScaledVector(direction, distance),
          target,
          near: camera.near,
          far: camera.far,
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
        },
        { immediate: immediate || !framed },
      );
    } else {
      // A named whole-anatomy frame replaces the old magnification, including on the next resize.
      zoom = WHOLE_ZOOM;
      moveCamera(
        planFraming(
          camera,
          controls,
          framingBounds(),
          VIEW_DIRECTIONS[view],
          frameTo,
          fit,
          framingPoints(),
        ),
        { immediate: immediate || !framed },
      );
    }
    framed = true;
    held.hold();
  }

  function frameLandmark(
    regionId: string,
    name: ViewName,
    contextMarginMm: number,
    { immediate = false }: MoveOptions = {},
  ): boolean {
    const region = boundsOf(meshesOf(regionId));
    if (region.isEmpty()) return false;
    view = requireView(name);
    held.release();
    camera.up.copy(upFor(view));
    // The meshes use metres; authored anatomical distances use millimetres.
    region.expandByScalar(contextMarginMm / MM_PER_M);
    moveCamera(
      planFraming(
        camera,
        controls,
        withContext(region),
        VIEW_DIRECTIONS[view],
        frameTo,
        framingFit({ immediate }),
      ),
      { immediate },
    );
    rememberZoom();
    return true;
  }

  /** Frame a deficit's drawn regions together, from the side they lie on when they share one. */
  function frameRegions(ids: readonly string[]) {
    const wanted = new Set(ids);
    const meshes = model.visibleMeshes.filter((mesh) =>
      wanted.has(mesh.userData['region_id'] as string),
    );
    if (!meshes.length) return;
    const box = boundsOf(meshes);
    const context = withContext(box);
    // A mapping wide enough to carry its own context is fitted by its silhouette, as the whole brain
    // is, so it fills the stage as DESIGN.md's framing says; a small one keeps the context box.
    const points = context.equals(box) ? silhouette(meshes) : null;
    const direction = heading();
    const sides = new Set(
      meshes
        .map((mesh) => model.regions.get(mesh.userData['region_id'] as string)?.hemisphere)
        .filter((side) => side === 'left' || side === 'right'),
    );
    // Seen from the other side, a one-sided mapping is framed through the hemisphere in front of it.
    if (sides.size === 1 && Math.sign(direction.x) === (sides.has('left') ? 1 : -1)) {
      direction.x *= -1;
    }
    held.release();
    moveCamera(planFraming(camera, controls, context, direction, frameTo, framingFit(), points));
    rememberZoom();
  }

  function frameRegion(id: string, { immediate = false }: MoveOptions = {}): boolean {
    const box = boundsOf(meshesOf(id));
    if (box.isEmpty()) return false;
    const direction = heading();
    held.release();
    moveCamera(planFraming(camera, controls, box, direction, frameTo, framingFit({ immediate })), {
      immediate,
    });
    rememberZoom();
    return true;
  }

  function frameInternal() {
    const isCord = model.state.internalSystem === 'Spinal cord';
    const structures = model.visibleMeshes.filter((mesh) => mesh.userData['kind'] === 'structure');
    let internal = boundsOf(
      structures.filter((mesh) => isCord || mesh.userData['atlas'] !== 'zanatomy'),
    );
    if (internal.isEmpty()) internal = boundsOf(structures);
    if (internal.isEmpty()) return;
    moveCamera(planFraming(camera, controls, internal, heading(), frameTo, framingFit()));
    rememberZoom();
  }

  /** Pull back to the whole brain along the direction the reader already has. */
  function frameWhole() {
    moveCamera(
      planFraming(
        camera,
        controls,
        framingBounds(),
        heading(),
        frameTo,
        framingFit(),
        framingPoints(),
      ),
    );
    rememberZoom();
  }

  function faceCut({ immediate = false }: MoveOptions = {}): ViewName | null {
    if (!sections.active) return null;
    const { frame } = sections;
    const { mode, reverse } = sections.state;
    const center = rasToWorld(frame.center.toArray());
    const direction = rasToWorld(frame.normal.toArray())
      .normalize()
      .multiplyScalar(reverse ? -1 : 1);
    const facing = cutFacingView(mode, reverse)!;
    view = facing;
    // An oblique cut is faced along its own normal, which is no preset's direction.
    if (mode === 'oblique') held.release();
    else held.hold();
    camera.up.copy(rasToWorld(frame.v.toArray()).normalize());
    const cutBounds =
      center.y < bounds.min.y
        ? new Box3(
            center.clone().subScalar(CORD_CUT_HALF_BOX_M),
            center.clone().addScalar(CORD_CUT_HALF_BOX_M),
          )
        : bounds;
    moveCamera(
      planFraming(
        camera,
        controls,
        cutBounds,
        direction,
        frameTo,
        framingFit({ immediate }),
        cutBounds === bounds ? framingPoints() : null,
      ),
      { immediate },
    );
    rememberZoom();
    return facing;
  }

  /** Move the camera onto a surface point, in world metres: the camera keeps its distance and heading. */
  function focusWorldPoint(point: Vector3) {
    held.release();
    const delta = point.clone().sub(controls.target);
    const minDistance =
      point.y < bounds.min.y
        ? Math.min(controls.minDistance, CORD_MIN_DISTANCE_M)
        : controls.minDistance;
    moveCamera({
      position: camera.position.clone().add(delta),
      target: point.clone(),
      near: camera.near,
      far: camera.far,
      minDistance,
      maxDistance: controls.maxDistance,
    });
  }

  function capture(): CapturedCamera {
    const { position, target, up, near, far, minDistance, maxDistance } = scene.destination;
    return {
      position: position.clone(),
      target: target.clone(),
      up: up.clone(),
      near,
      far,
      minDistance,
      maxDistance,
      zoom,
      held: held.held,
    };
  }

  const toWorld = ([x, y, z]: readonly [number, number, number]) =>
    new Vector3(x, y, z).divideScalar(MM_PER_M);
  const toMillimetres = ({ x, y, z }: Vector3): [number, number, number] => [
    x * MM_PER_M,
    y * MM_PER_M,
    z * MM_PER_M,
  ];

  // A pan stops where its target would leave what is drawn, so the anatomy cannot be lost off the
  // stage; a target already further out is held there rather than pulled in.
  controls.addEventListener('start', () => {
    orbiting = true;
    const drawn = framingBounds().getBoundingSphere(new Sphere());
    controls.cursor.copy(drawn.center);
    controls.maxTargetRadius = Math.max(drawn.radius, controls.target.distanceTo(drawn.center));
  });
  // One handler, in the order the work has to run: the zoom the gesture ended on, then the refit it
  // deferred. Legacy registered two and was right only by their order (app.js:1830, 1840).
  controls.addEventListener('end', () => {
    orbiting = false;
    rememberZoom();
    if (fitPending !== null) {
      const before = fitPending;
      fitPending = null;
      refit(before);
      // The zoom read above was taken before this refit; it belongs to where the refit lands.
      rememberZoom();
    }
    if (dockPending) {
      dockPending = false;
      refitDock();
    }
  });
  controls.addEventListener('change', publishCamera);

  const cameraApi: EngineCamera = {
    get viewHeld() {
      return held.held;
    },
    get visibleRect(): Rect {
      return { ...scene.visibleRect };
    },
    get hostSize(): Size {
      return { ...scene.hostSize };
    },
    get view() {
      return shown;
    },

    setFramingSource(source) {
      framingSource = source;
    },
    setChromeInsets(insets: ChromeInsets, motion) {
      scene.setChromeInsets(insets, motion);
      publishViewport();
    },
    refitDock,

    frameCurrent,
    applyView: frameCurrent,
    frameRegions,
    frameRegion,
    frameLandmark,
    frameWhole,
    frameInternal,
    faceCut,
    recenter() {
      controls.target.copy(bounds.getCenter(new Vector3()));
    },
    fittedDistance: () => fittedDistance(heading()),
    keepFraming(before) {
      // A tap that selects raises the sheet before its gesture has ended; the refit waits for the lift.
      if (orbiting) fitPending = before;
      else refit(before);
    },
    focusPoint: (point: Vec3) => focusWorldPoint(rasToWorld(point)),

    orbitBy(turn: OrbitTurn) {
      held.release();
      turnFromKeyboard(controls, turn);
      rememberZoom();
    },
    dolly(factor) {
      held.release();
      // The same zoom as the wheel's, about the surface in the middle of the view.
      controls.dollyIn(factor);
      rememberZoom();
    },

    capture: () => capture() as unknown as CameraSnapshot,
    restore(name, snapshot, { immediate = false } = {}) {
      const pose = snapshot as unknown as CapturedCamera;
      view = requireView(name);
      framingFit({ immediate });
      camera.up.copy(pose.up);
      moveCamera(
        {
          position: pose.position.clone(),
          target: pose.target.clone(),
          near: pose.near,
          far: pose.far,
          minDistance: pose.minDistance,
          maxDistance: pose.maxDistance,
        },
        { immediate },
      );
      zoom = pose.zoom;
      if (pose.held) held.hold();
      else held.release();
    },
    /** A link's exact camera, placed in the framing just applied; only nearer limits are widened to admit it. */
    placeOrbit({ position, target, up }: Orbit, { immediate = false }: MoveOptions = {}) {
      const plan = scene.destination;
      if (!orbitWithin({ position, target }, plan.maxDistance * MM_PER_M)) {
        throw new RangeError(
          `Camera ${position} → ${target} mm is beyond the orbit limit of ${plan.maxDistance} m.`,
        );
      }
      const pose = { ...plan, position: toWorld(position), target: toWorld(target) };
      const distance = pose.position.distanceTo(pose.target);
      // A camera written at the limit may read back a rounding past it.
      pose.minDistance = Math.min(plan.minDistance, distance);
      pose.maxDistance = Math.max(plan.maxDistance, distance);
      camera.up.copy(up ? new Vector3(...up) : upFor(view));
      held.release();
      moveCamera(pose, { immediate });
      const fitted = fittedDistance(pose.position.clone().sub(pose.target).normalize());
      if (fitted > 0) zoom = distance / fitted;
    },
    orbitLink() {
      if (held.held || reference.active) return null;
      const { position, target, up } = scene.destination;
      return {
        position: toMillimetres(position),
        target: toMillimetres(target),
        ...(up.distanceTo(upFor(view)) > UP_DIFFERS ? { up: up.toArray() } : {}),
      };
    },
  };

  return {
    camera: cameraApi,
    focusWorldPoint,
    home: (direction) => ({
      center: framingBounds().getCenter(new Vector3()),
      distance: fittedDistance(direction),
    }),
    invalidate() {
      cachedBounds = null;
      cachedPoints = null;
    },
    onResize({ canvasChanged }) {
      publishViewport();
      if (canvasChanged) refitViewport();
      publishCamera();
    },
    onReference() {
      cachedBounds = null;
      cachedPoints = null;
      zoom = WHOLE_ZOOM;
      if (!reference.active || reference.bounds) frameCurrent(view, { immediate: true });
    },
    onReferenceReady() {
      if (reference.active) frameCurrent(view, { immediate: true });
    },
  };
}
