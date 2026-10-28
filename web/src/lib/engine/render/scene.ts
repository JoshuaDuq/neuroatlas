import {
  NeutralToneMapping,
  NoToneMapping,
  Color,
  FrontSide,
  HalfFloatType,
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { Box3, Object3D, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { token } from './tokens.ts';
import { createAnatomicalLighting } from './lighting.ts';
import type { LightingSettings } from './lighting.ts';
import { fitScale, viewOffset, visibleRect } from './effective-viewport.ts';
import type { Rect, Size } from './effective-viewport.ts';
import { orbitPath } from './camera-path.ts';
import type { PathPose } from './camera-path.ts';
import type { FitScale } from './camera-views.ts';
import { levelOnOrbit } from './orbit-controls.ts';
import { gpuRendererName, isAppleSilicon, isIntegratedGpu } from './device.ts';
import { motionRatio, qualityProfile } from './quality.ts';
import { paintOutlineEdges, sameMeshSet } from './outline-edges.ts';
import { withOutlineOccluders } from './outline-occluders.ts';

const TRANSITION_MS = 240;
// How long the camera must rest before the full-resolution frame is drawn.
const SETTLE_MS = 150;

type Ease = (t: number) => number;

const easeInOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** CSS's cubic-bezier(x1, y1, x2, y2) at progress `x`: Newton's method finds the curve's t for x. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const along = (a: number, b: number) => (t: number) =>
    ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const x = along(x1, x2);
  const y = along(y1, y2);
  const slope = (t: number) => (3 * (1 - 3 * x2 + 3 * x1) * t + 2 * (3 * x2 - 6 * x1)) * t + 3 * x1;
  return (progress) => {
    let t = progress;
    for (let i = 0; i < 8; i += 1) t -= (x(t) - progress) / slope(t);
    return y(Math.min(Math.max(t, 0), 1));
  };
}
// The sheet's --ease-sheet, so the picture settles with the sheet that moved it.
const easeSheet = cubicBezier(0.32, 0.72, 0, 1);

const prefersReducedMotion = (): boolean =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** How much of each canvas edge the interface covers, in CSS pixels. */
export interface ChromeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The bands framing keeps clear: the stage dock's at the bottom, a colour key's at the top or right. */
export type FramingInset = Pick<ChromeInsets, 'top' | 'right' | 'bottom'>;

/** The manifest's `appearance.lighting`: the rig's intensities and the environment's. */
export interface Appearance {
  lighting: LightingSettings & { environment: number };
}

/** A framed destination. */
export interface CameraPlan {
  position: Vector3;
  target: Vector3;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
}

export interface CameraDestination extends CameraPlan {
  up: Vector3;
}

export interface SceneCallbacks {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onResize?: (change: { canvasChanged: boolean }) => void;
  /** Before the first frame of a camera move and the full-resolution frame at rest. */
  onMotion?: (moving: boolean) => void;
}

export interface Outlined {
  selected?: readonly Object3D[];
  hovered?: readonly Object3D[];
}

export interface MoveOptions {
  immediate?: boolean;
}

export interface SnapshotCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `frameTo` from `camera-views.ts`: frames bounds on the camera and returns the orbit target. */
export type FrameTo = (
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bounds: Box3,
  direction: Vector3,
  fit?: FitScale,
  points?: ArrayLike<number> | null,
) => Vector3;

/** An eased move between two sets of insets. */
interface InsetMove<Sides extends string> {
  from: Record<Sides, number>;
  to: Record<Sides, number>;
  started: number;
  ease: Ease;
}

interface Transition {
  path: (t: number) => PathPose;
  plan: CameraDestination;
  started: number;
  arrive: () => void;
  ease: Ease;
}

export interface Pipeline {
  composer: EffectComposer;
  halo: OutlinePass;
  core: OutlinePass;
  renderHalo: OutlinePass['render'];
  renderCore: OutlinePass['render'];
}

export interface PipelineOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  msaaSamples: number;
}

/**
 * The composer for one resolution: scene, a two-tone outline and the output pass.
 * Exported so a test can read the passes and their order without a GL context.
 */
export function createPipeline({
  renderer,
  scene,
  camera,
  msaaSamples,
}: PipelineOptions): Pipeline {
  const composer = new EffectComposer(
    renderer,
    new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      stencilBuffer: true,
      samples: msaaSamples,
      // Caps need these attachments during the scene draw; postprocessing
      // samples only colour, so copying depth and stencil serves no reader.
      resolveDepthBuffer: false,
      resolveStencilBuffer: false,
    }),
  );
  composer.addPass(new RenderPass(scene, camera));

  /*
   * Two passes make one two-tone outline. No single colour clears 3:1 against
   * all 512 atlas colours, but no colour can be close to both black and
   * white, so a light halo behind a dark core is legible over any of them.
   * The halo also carries hover on its own, which keeps hover and selection
   * visually distinct without a third pass.
   */
  const halo = new OutlinePass(new Vector2(1, 1), scene, camera);
  halo.edgeStrength = 6;
  halo.edgeThickness = 3;
  halo.edgeGlow = 0;
  halo.enabled = false;
  const core = new OutlinePass(new Vector2(1, 1), scene, camera);
  core.edgeStrength = 6;
  core.edgeThickness = 1;
  core.edgeGlow = 0;
  core.enabled = false;
  // The surface is front-facing. Matching that side keeps the silhouette and
  // does not rasterize the back of every triangle into the outline depth.
  for (const pass of [halo, core]) {
    pass.depthMaterial.side = FrontSide;
    pass.prepareMaskMaterial.side = FrontSide;
  }
  composer.addPass(halo);
  composer.addPass(core);
  for (const pass of [halo, core]) {
    const render = pass.render.bind(pass);
    pass.render = (...args) => withOutlineOccluders(pass, () => render(...args));
  }
  const renderHalo = halo.render.bind(halo);
  const renderCore = core.render.bind(core);
  // Selection draws both tones of one silhouette. The second pass would
  // render every mesh again for a mask the halo already built.
  core.render = function (
    this: OutlinePass,
    renderer,
    writeBuffer,
    readBuffer,
    deltaTime,
    maskActive,
  ) {
    if (this.enabled && halo.enabled && sameMeshSet(halo.selectedObjects, this.selectedObjects)) {
      paintOutlineEdges(
        this,
        halo.renderTargetMaskBuffer.texture,
        renderer,
        readBuffer,
        maskActive,
      );
      return;
    }
    renderCore(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  };
  const output = new OutputPass();
  // Every pass draws into readBuffer or the canvas. Swapping after output
  // would allocate a second full-size MSAA/depth/stencil target next frame.
  output.needsSwap = false;
  composer.addPass(output);
  return { composer, halo, core, renderHalo, renderCore };
}

/** An eased move between two sets of insets, as drawn at `now`. */
function insetsAt<Sides extends string>(
  { from, to, started, ease }: InsetMove<Sides>,
  now: number,
): { insets: Record<Sides, number>; done: boolean } {
  const t = Math.min(Math.max((now - started) / TRANSITION_MS, 0), 1);
  const eased = ease(t);
  const insets = Object.fromEntries(
    (Object.keys(to) as Sides[]).map((side) => [
      side,
      from[side] + (to[side] - from[side]) * eased,
    ]),
  ) as Record<Sides, number>;
  return { insets, done: t === 1 };
}

export interface EngineScene {
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  domElement: HTMLCanvasElement;
  applyTheme(): void;
  setAppearance(next: Appearance): void;
  setSize(): void;
  setOutlined(outlined?: Outlined): void;
  moveTo(plan: CameraPlan, options?: MoveOptions): void;
  invalidate(): void;
  /** Compile the outline programs before a pointer reaches a region. */
  warmOutlines(root: Object3D): void;
  /** Declare how much of the canvas the interface covers; `settle` is the sheet easing to a detent. */
  setChromeInsets(next: Partial<ChromeInsets>, options?: { settle?: boolean }): void;
  /** Keep framing clear of bands of the visible rectangle. Returns whether it changed. */
  setFramingInset(next?: Partial<FramingInset>, options?: MoveOptions): boolean;
  /** The canvas rectangle the interface leaves uncovered, in CSS pixels. */
  readonly visibleRect: Rect;
  /** The fraction of each frustum axis framing may use, for `planFraming`. */
  readonly viewportFit: { horizontal: number; vertical: number };
  /** Where the camera is headed: an eased move's plan, or where it already is. */
  readonly destination: CameraDestination;
  /** The canvas's CSS size, as of the last resize. */
  readonly hostSize: Size;
  readonly distanceToTarget: number;
  readonly viewportHeight: number;
  captureSnapshot(crop?: SnapshotCrop): { canvas: HTMLCanvasElement; ratio: number };
  setMriAppearance(active: boolean): void;
  dispose(): void;
}

/**
 * The renderer, its passes, and the camera transition.
 *
 * Owns nothing about the interface: it is handed a host element and told what
 * to outline. Selection and hover are drawn here, over the render, so the
 * model never has to alter a material to show them.
 */
export function createScene(
  host: HTMLElement,
  { onContextLost, onContextRestored, onResize, onMotion }: SceneCallbacks = {},
): EngineScene {
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.001, 10);
  // The composer owns MSAA and the stencil the cut caps use. The default
  // framebuffer cannot do both, so it stays single-sampled and unused for drawing.
  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
  });
  const gpu = gpuRendererName(renderer.getContext());
  const quality = qualityProfile({
    integrated: isIntegratedGpu(gpu),
    appleSilicon: isAppleSilicon(gpu),
  });
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(quality.pixelRatio);
  // Khronos PBR Neutral: a surface lit squarely shows its published colour,
  // where ACES shifted hues and bleached atlas and network colours alike.
  renderer.toneMapping = NeutralToneMapping;
  renderer.domElement.tabIndex = 0;
  // It takes the arrow keys itself; a screen reader's browse mode would eat them. The localized
  // aria-label and aria-roledescription are set by the facade from i18n (decision 28 on #4).
  renderer.domElement.setAttribute('role', 'application');
  host.prepend(renderer.domElement);
  // Read on every camera change and every frame of a sheet drag; the observer
  // below is the only thing that can change it.
  const initial = host.getBoundingClientRect();
  let hostSize: Size = { width: initial.width, height: initial.height };

  scene.add(camera);
  let lighting: ReturnType<typeof createAnatomicalLighting> | null = null;
  let appearance: Appearance | null = null;
  let mriAppearance = false;

  const controls = new OrbitControls(camera, renderer.domElement);
  // The anatomy is draggable and said so only once a pointer had moved over
  // it: picking wrote the cursor, and before that the canvas rested on `auto`.
  // The controls own this inline, including `grabbing` for the duration of an
  // orbit, which nothing else was providing.
  controls.cursorStyle = 'grab';
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.zoomToCursor = true;
  levelOnOrbit(controls);

  /*
   * How much of the canvas the interface is covering. On a phone the sheet
   * sits over the canvas rather than beside it, so the renderer is told what
   * the reader can see instead of being resized: resizing would reallocate
   * the composer target and both outline passes on every frame of a drag.
   */
  let chromeInsets: ChromeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  // Planning reads where the sheet is going; the image is offset by where it is drawn, which
  // eases after a settled sheet on its curve and tracks a dragged one.
  let chromeShown = chromeInsets;
  let chromeMove: InsetMove<keyof ChromeInsets> | null = null;
  // Framing also clears the stage dock and any colour key, which `chromeInsets` must not include:
  // they are placed by that rectangle and would push themselves along by their own size.
  const NO_INSET: FramingInset = Object.freeze({ top: 0, right: 0, bottom: 0 });
  let framingInset = NO_INSET;
  let framingShown = NO_INSET;
  let insetMove: InsetMove<keyof FramingInset> | null = null;
  const framingRect = (inset = framingInset, chrome = chromeInsets): Rect =>
    visibleRect(hostSize, {
      top: chrome.top + inset.top,
      right: chrome.right + inset.right,
      bottom: chrome.bottom + inset.bottom,
      left: chrome.left,
    });

  /*
   * A moving camera draws through a second, lower-resolution pipeline that the
   * output pass scales to the canvas; the frame after it settles is full
   * resolution. Both stay allocated: resizing targets mid-drag costs 15–50 ms.
   */
  const pipelineOptions = { renderer, scene, camera, msaaSamples: quality.msaaSamples };
  const settled = createPipeline(pipelineOptions);
  const moving = createPipeline(pipelineOptions);
  const pipelines = [settled, moving];
  const { halo, core, renderHalo, renderCore } = settled;
  let movingRatio: number | null = null;

  let dirty = true;
  let looping = false;
  let lastMotion = -Infinity;
  let showingMotion = false;
  let transition: Transition | null = null;
  const invalidate = () => {
    dirty = true;
    if (!looping) startLoop();
  };
  const cameraMoved = () => {
    lastMotion = performance.now();
    invalidate();
  };

  function setAppearance(next: Appearance) {
    appearance = next;
    lighting?.dispose();
    lighting = createAnatomicalLighting(renderer, camera, appearance.lighting);
    scene.environment = lighting.texture;
    scene.environmentIntensity = appearance.lighting.environment;
    invalidate();
  }

  function applyTheme() {
    scene.background = new Color(token('--scene-background'));
    const raw = token('--scene-exposure');
    const exposure = Number(raw);
    if (raw === '' || !Number.isFinite(exposure))
      throw new Error('The --scene-exposure token is not a number.');
    renderer.toneMappingExposure = exposure;
    for (const pipeline of pipelines) {
      pipeline.halo.visibleEdgeColor.set(token('--scene-outline-halo'));
      pipeline.halo.hiddenEdgeColor.set(token('--scene-outline-hidden'));
      pipeline.core.visibleEdgeColor.set(token('--scene-outline-core'));
      pipeline.core.hiddenEdgeColor.set(token('--scene-outline-hidden'));
    }
    invalidate();
  }

  function setMriAppearance(active: boolean) {
    if (mriAppearance === active) return;
    mriAppearance = active;
    renderer.toneMapping = active ? NoToneMapping : NeutralToneMapping;
    setSize();
  }

  /** The canvas rectangle the interface leaves uncovered. */
  function measureVisible(): Rect {
    return visibleRect(hostSize, chromeInsets);
  }

  /**
   * Slide the frustum so the anatomy sits in the middle of what is visible.
   *
   * The camera is not moved: moving it would drag the orbit target off the
   * anatomy and orbiting would swing the model around a point beside it.
   */
  function applyViewOffset() {
    const { width, height } = hostSize;
    if (!width || !height) return;
    const offset = viewOffset({ width, height }, framingRect(framingShown, chromeShown));
    if (offset) {
      camera.setViewOffset(
        offset.fullWidth,
        offset.fullHeight,
        offset.offsetX,
        offset.offsetY,
        offset.width,
        offset.height,
      );
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    invalidate();
  }

  function setSize() {
    const { width, height } = host.getBoundingClientRect();
    hostSize = { width, height };
    if (!width || !height) return;
    const ratio = mriAppearance ? quality.mriPixelRatio : quality.pixelRatio;
    if (renderer.getPixelRatio() !== ratio) {
      renderer.setPixelRatio(ratio);
      settled.composer.setPixelRatio(ratio);
    }
    const reduced = motionRatio(Math.min(ratio, quality.motionPixelRatio), width, height);
    if (movingRatio !== reduced) {
      movingRatio = reduced;
      moving.composer.setPixelRatio(reduced);
    }
    renderer.setSize(width, height);
    for (const pipeline of pipelines) pipeline.composer.setSize(width, height);
    // Allocated now rather than inside the first frame of a drag.
    renderer.initRenderTarget(moving.composer.readBuffer);
    camera.aspect = width / height;
    applyViewOffset();
    camera.updateProjectionMatrix();
    invalidate();
    // The scale bar is derived from the viewport height, so it is stale the
    // moment the viewport changes and cannot wait for the camera to move.
    onResize?.({ canvasChanged: true });
  }

  /** Selection gets both tones; hover gets the halo alone. */
  function setOutlined({ selected = [], hovered = [] }: Outlined = {}) {
    const ringed = [...new Set([...selected, ...hovered])];
    for (const pipeline of pipelines) {
      pipeline.halo.selectedObjects = ringed;
      pipeline.core.selectedObjects = [...selected];
      pipeline.halo.enabled = ringed.length > 0;
      pipeline.core.enabled = selected.length > 0;
    }
    invalidate();
  }

  /**
   * Move to a framed destination. Orbit limits are applied on arrival, not on
   * departure: a tighter maxDistance would otherwise yank a distant camera.
   */
  function moveTo(
    { position, target, near, far, minDistance, maxDistance }: CameraPlan,
    { immediate = false }: MoveOptions = {},
  ) {
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
    const arrive = () => {
      controls.minDistance = minDistance;
      controls.maxDistance = maxDistance;
      controls.update();
    };
    // The camera begins at the origin, inside the model. Animating the first
    // framing would swoop out of the brain on every load; the first paint
    // should simply be correct.
    if (immediate || prefersReducedMotion()) {
      transition = null;
      camera.position.copy(position);
      controls.target.copy(target);
      arrive();
      invalidate();
      return;
    }
    // Callers write the destination's up before planning, and between frames it stays theirs.
    const plan: CameraDestination = {
      position: position.clone(),
      target: target.clone(),
      up: camera.up.clone(),
      near,
      far,
      minDistance,
      maxDistance,
    };
    transition = {
      path: orbitPath(
        { quaternion: camera.quaternion, position: camera.position, target: controls.target },
        plan,
      ),
      plan,
      started: performance.now(),
      arrive,
      // A reframe for a settling sheet rides the sheet's curve, so the image arrives as one object.
      ease: chromeMove ? easeSheet : easeInOut,
    };
    invalidate();
  }

  function step(now: number) {
    const easing = Boolean(insetMove || chromeMove);
    if (easing || transition) lastMotion = now;
    if (insetMove) {
      const { insets, done } = insetsAt(insetMove, now);
      framingShown = insets;
      if (done) insetMove = null;
    }
    if (chromeMove) {
      const { insets, done } = insetsAt(chromeMove, now);
      chromeShown = insets;
      if (done) chromeMove = null;
    }
    if (easing) applyViewOffset();
    if (!transition) return;
    const t = Math.min(Math.max((now - transition.started) / TRANSITION_MS, 0), 1);
    const pose = transition.path(transition.ease(t));
    const { plan, arrive } = transition;
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    if (t === 1) {
      transition = null;
      arrive();
      // The last eased step can be below the controls' own change threshold; announce arrival.
      controls.dispatchEvent({ type: 'change' });
    } else {
      // The controls stand aside while the scene moves the camera, so the move announces itself,
      // with the up it is drawing for whoever reads the frame; then the destination's is restored.
      camera.quaternion.copy(pose.quaternion);
      camera.up.copy(pose.up);
      controls.dispatchEvent({ type: 'change' });
      camera.up.copy(plan.up);
    }
    invalidate();
  }

  function tick(now: number) {
    step(now);
    // Their damping and limits would pull against an orbit in flight; they take over on arrival.
    if (!transition) controls.update();
    // Solid cuts interleave winding masks and caps in a defined render order.
    renderer.sortObjects = true;
    const inMotion = performance.now() - lastMotion < SETTLE_MS;
    // The camera has come to rest on a reduced frame: redraw it at full resolution.
    if (!inMotion && showingMotion) dirty = true;
    if (!dirty && !transition && !insetMove && !inMotion) {
      renderer.setAnimationLoop(null);
      looping = false;
      return;
    }
    if (!dirty) return;
    if (inMotion !== showingMotion) onMotion?.(inMotion);
    (inMotion ? moving : settled).composer.render();
    showingMotion = inMotion;
    dirty = false;
  }

  function startLoop() {
    looping = true;
    renderer.setAnimationLoop(tick);
  }
  startLoop();

  // Reported upward rather than written to the DOM: the app owns status, and
  // a status written here would be overwritten by the next render.
  const handleLost = (event: Event) => {
    event.preventDefault();
    onContextLost?.();
  };
  const handleRestored = () => {
    // The environment map was rendered on the GPU and has no copy to re-upload: render it again.
    if (appearance) setAppearance(appearance);
    applyTheme();
    setSize();
    onContextRestored?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

  const observer = new ResizeObserver(setSize);
  observer.observe(host);
  controls.addEventListener('change', cameraMoved);
  // A reader who takes hold of the camera mid-orbit keeps it where it is drawn, roll included.
  const onGrab = () => {
    if (!transition) return;
    transition = null;
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  };
  controls.addEventListener('start', onGrab);

  return {
    scene,
    camera,
    controls,
    domElement: renderer.domElement,
    applyTheme,
    setAppearance,
    setSize,
    setOutlined,
    moveTo,
    invalidate,

    /**
     * Compile the outline programs before a pointer reaches a region.
     *
     * The first hover otherwise pays for those shaders inside the frame that
     * draws the ring. One sample mesh is enough: every region shares them.
     */
    warmOutlines(root) {
      let sample: Object3D | null = null;
      root.traverse((object) => {
        if (!sample && 'isMesh' in object && object.isMesh && object.visible) sample = object;
      });
      if (!sample) return;
      const mesh: Object3D = sample;
      const previous = {
        haloObjects: halo.selectedObjects,
        coreObjects: core.selectedObjects,
        haloOn: halo.enabled,
        coreOn: core.enabled,
        target: renderer.getRenderTarget(),
        override: scene.overrideMaterial,
        background: scene.background,
        visible: mesh.visible,
      };
      halo.selectedObjects = [mesh];
      core.selectedObjects = [mesh];
      halo.enabled = true;
      core.enabled = true;
      const target = settled.composer.readBuffer;
      try {
        renderHalo(renderer, target, target, 0, false);
        renderCore(renderer, target, target, 0, false);
      } finally {
        scene.overrideMaterial = previous.override;
        scene.background = previous.background;
        mesh.visible = previous.visible;
        halo.selectedObjects = previous.haloObjects;
        core.selectedObjects = previous.coreObjects;
        halo.enabled = previous.haloOn;
        core.enabled = previous.coreOn;
        renderer.setRenderTarget(previous.target);
      }
    },

    /**
     * Declare how much of the canvas the interface covers. Reported upward as
     * a resize, because everything derived from the viewport — framing, the
     * markers, the presets — is stale the moment it changes. A `settle` is the
     * sheet moving on its own curve, which the image's offset follows; otherwise
     * a finger is moving it and the offset tracks at once.
     */
    setChromeInsets(next, { settle = false } = {}) {
      const merged: ChromeInsets = { top: 0, right: 0, bottom: 0, left: 0, ...next };
      const same = (Object.keys(merged) as (keyof ChromeInsets)[]).every(
        (key) => merged[key] === chromeInsets[key],
      );
      if (same) return;
      chromeInsets = merged;
      if (settle && !prefersReducedMotion()) {
        chromeMove = { from: chromeShown, to: merged, started: performance.now(), ease: easeSheet };
        invalidate();
      } else {
        chromeMove = null;
        chromeShown = merged;
        applyViewOffset();
      }
      // Not a canvas resize: the sheet reports this on every frame of a drag,
      // and refitting there would fight the finger. The sheet reframes itself
      // when it settles on a detent.
      onResize?.({ canvasChanged: false });
    },

    /**
     * Keep framing clear of bands of the visible rectangle: the dock's at the bottom, a colour
     * key's at the top or right. The image slides with the camera's eased move. Returns whether
     * it changed.
     */
    setFramingInset({ top = 0, right = 0, bottom = 0 } = {}, { immediate = false } = {}) {
      const next: FramingInset = { top, right, bottom };
      if (
        (Object.keys(next) as (keyof FramingInset)[]).every(
          (side) => next[side] === framingInset[side],
        )
      ) {
        return false;
      }
      framingInset = next;
      if (immediate || prefersReducedMotion()) {
        insetMove = null;
        framingShown = next;
        applyViewOffset();
      } else {
        insetMove = {
          from: framingShown,
          to: next,
          started: performance.now(),
          ease: chromeMove ? easeSheet : easeInOut,
        };
        invalidate();
      }
      return true;
    },

    get visibleRect() {
      return measureVisible();
    },

    get viewportFit() {
      return fitScale(hostSize, framingRect());
    },

    get destination() {
      if (transition) return transition.plan;
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

    get hostSize() {
      return hostSize;
    },

    get distanceToTarget() {
      return camera.position.distanceTo(controls.target);
    },
    get viewportHeight() {
      return hostSize.height;
    },

    /**
     * The settled frame, copied pixel for pixel to a 2D canvas that can be annotated. `crop` is
     * the part of the canvas to keep, in CSS pixels; `ratio` is the copy's pixels per CSS pixel.
     */
    captureSnapshot(crop = { x: 0, y: 0, ...hostSize }) {
      settled.composer.render();
      const source = renderer.domElement;
      const ratio = source.width / hostSize.width;
      const [x, y, width, height] = [crop.x, crop.y, crop.width, crop.height].map((value) =>
        Math.round(value * ratio),
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('A 2D canvas context is unavailable for the snapshot.');
      // Read in the same task as the render: the drawing buffer is not preserved past it.
      context.drawImage(source, x, y, width, height, 0, 0, width, height);
      return { canvas, ratio };
    },

    setMriAppearance,

    dispose() {
      renderer.setAnimationLoop(null);
      looping = false;
      observer.disconnect();
      controls.removeEventListener('change', cameraMoved);
      controls.removeEventListener('start', onGrab);
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      controls.dispose();
      lighting?.dispose();
      for (const { composer } of pipelines) {
        for (const pass of composer.passes) pass.dispose?.();
        composer.dispose();
      }
      renderer.dispose();
      // dispose() frees three.js's objects but not the context; browsers cap live contexts.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

/**
 * Where a camera would sit to frame these bounds, without moving it there.
 *
 * `fit` is the fraction of each frustum axis the interface leaves uncovered,
 * from `scene.viewportFit`. It reaches `frameTo` unchanged, so framing fits
 * the anatomy to what the reader can see rather than to the whole canvas.
 */
export function planFraming(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bounds: Box3,
  direction: Vector3,
  frameTo: FrameTo,
  fit: FitScale,
  points: ArrayLike<number> | null = null,
): CameraPlan {
  const start = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    target: controls.target.clone(),
    near: camera.near,
    far: camera.far,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  };
  const target = frameTo(camera, controls, bounds, direction, fit, points);
  const plan = {
    position: camera.position.clone(),
    target: target.clone(),
    near: camera.near,
    far: camera.far,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  };
  // A plan is a dry run: the real camera must read exactly as it did before it.
  camera.position.copy(start.position);
  camera.quaternion.copy(start.quaternion);
  controls.target.copy(start.target);
  camera.near = start.near;
  camera.far = start.far;
  controls.minDistance = start.minDistance;
  controls.maxDistance = start.maxDistance;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return plan;
}
