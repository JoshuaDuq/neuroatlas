import {
  NeutralToneMapping, NoToneMapping, Color, FrontSide, HalfFloatType,
  PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { token } from '../state/theme.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { createAnatomicalLighting } from './lighting.js';
import { fitScale, viewOffset, visibleRect } from './effective-viewport.js';
import { gpuRendererName, isAppleSilicon, isIntegratedGpu } from './device.js';
import { motionRatio, qualityProfile } from './quality.js';
import { paintOutlineEdges, sameMeshSet } from './outline-edges.js';

const TRANSITION_MS = 240;
// How long the camera must rest before the full-resolution frame is drawn.
const SETTLE_MS = 150;

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const prefersReducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The renderer, its passes, and the camera transition.
 *
 * Owns nothing about the interface: it is handed a host element and told what
 * to outline. Selection and hover are drawn here, over the render, so the
 * model never has to alter a material to show them.
 */
export function createScene(host, { onContextLost, onContextRestored, onResize } = {}) {
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
  // It takes the arrow keys itself; a screen reader's browse mode would eat them.
  renderer.domElement.setAttribute('role', 'application');
  renderer.domElement.setAttribute('aria-roledescription', '3D anatomy viewer');
  renderer.domElement.setAttribute('aria-label',
    'Brain model. Drag or use the arrow keys to rotate, scroll or press plus '
    + 'and minus to zoom, click a region to select.');
  host.prepend(renderer.domElement);
  // Read on every camera change and every frame of a sheet drag; the observer
  // below is the only thing that can change it.
  const initial = host.getBoundingClientRect();
  let hostSize = { width: initial.width, height: initial.height };

  scene.add(camera);
  let lighting = null;
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

  /*
   * How much of the canvas the interface is covering. On a phone the sheet
   * sits over the canvas rather than beside it, so the renderer is told what
   * the reader can see instead of being resized: resizing would reallocate
   * the composer target and both outline passes on every frame of a drag.
   */
  let chromeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  // Framing also clears the stage dock, which `chromeInsets` must not include:
  // the dock is placed by that rectangle and would lift itself by its own height.
  let framingInset = 0;
  let framingShown = 0;
  let insetMove = null;
  const framingRect = (bottom = framingInset) =>
    visibleRect(hostSize, { ...chromeInsets, bottom: chromeInsets.bottom + bottom });

  function createPipeline() {
    const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      stencilBuffer: true,
      samples: quality.msaaSamples,
    }));
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
    const renderHalo = halo.render.bind(halo);
    const renderCore = core.render.bind(core);
    // Selection draws both tones of one silhouette. The second pass would
    // render every mesh again for a mask the halo already built.
    core.render = function (renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
      if (this.enabled && halo.enabled && sameMeshSet(halo.selectedObjects, this.selectedObjects)) {
        paintOutlineEdges(this, halo.renderTargetMaskBuffer.texture, renderer, readBuffer, maskActive);
        return;
      }
      renderCore(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    };
    composer.addPass(new OutputPass());
    return { composer, halo, core, renderHalo, renderCore };
  }

  /*
   * A moving camera draws through a second, lower-resolution pipeline that the
   * output pass scales to the canvas; the frame after it settles is full
   * resolution. Both stay allocated: resizing targets mid-drag costs 15–50 ms.
   */
  const settled = createPipeline();
  const moving = createPipeline();
  const pipelines = [settled, moving];
  const { halo, core, renderHalo, renderCore } = settled;
  let movingRatio = null;

  let dirty = true;
  let looping = false;
  let lastMotion = -Infinity;
  let showingMotion = false;
  let transition = null;
  let hasTransparency = () => false;
  let hasSections = () => false;
  const invalidate = () => {
    dirty = true;
    if (!looping) startLoop();
  };
  const cameraMoved = () => {
    lastMotion = performance.now();
    invalidate();
  };

  function setAppearance(appearance) {
    lighting?.dispose();
    lighting = createAnatomicalLighting(renderer, camera, appearance.lighting);
    scene.environment = lighting.texture;
    scene.environmentIntensity = appearance.lighting.environment;
    invalidate();
  }

  function applyTheme() {
    scene.background = new Color(token('--scene-background'));
    renderer.toneMappingExposure = Number(token('--scene-exposure')) || 1;
    for (const pipeline of pipelines) {
      pipeline.halo.visibleEdgeColor.set(token('--scene-outline-halo'));
      pipeline.halo.hiddenEdgeColor.set(token('--scene-outline-hidden'));
      pipeline.core.visibleEdgeColor.set(token('--scene-outline-core'));
      pipeline.core.hiddenEdgeColor.set(token('--scene-outline-hidden'));
    }
    invalidate();
  }

  function setMriAppearance(active) {
    if (mriAppearance === active) return;
    mriAppearance = active;
    renderer.toneMapping = active ? NoToneMapping : NeutralToneMapping;
    setSize();
  }

  /** The canvas rectangle the interface leaves uncovered. */
  function measureVisible() {
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
    const offset = viewOffset({ width, height }, framingRect(framingShown));
    if (offset) {
      camera.setViewOffset(offset.fullWidth, offset.fullHeight,
        offset.offsetX, offset.offsetY, offset.width, offset.height);
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
    renderer.initRenderTarget(moving.composer.renderTarget1);
    renderer.initRenderTarget(moving.composer.renderTarget2);
    camera.aspect = width / height;
    applyViewOffset();
    camera.updateProjectionMatrix();
    invalidate();
    // The scale bar is derived from the viewport height, so it is stale the
    // moment the viewport changes and cannot wait for the camera to move.
    onResize?.({ canvasChanged: true });
  }

  /** Selection gets both tones; hover gets the halo alone. */
  function setOutlined({ selected = [], hovered = [] } = {}) {
    const ringed = [...new Set([...selected, ...hovered])];
    for (const pipeline of pipelines) {
      pipeline.halo.selectedObjects = ringed;
      pipeline.core.selectedObjects = selected;
      pipeline.halo.enabled = ringed.length > 0;
      pipeline.core.enabled = selected.length > 0;
    }
    invalidate();
  }

  /**
   * Move to a framed destination. Orbit limits are applied on arrival, not on
   * departure: a tighter maxDistance would otherwise yank a distant camera.
   */
  function moveTo({ position, target, near, far, minDistance, maxDistance },
    { immediate = false } = {}) {
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
    transition = {
      from: { position: camera.position.clone(), target: controls.target.clone() },
      to: { position: position.clone(), target: target.clone() },
      plan: { position: position.clone(), target: target.clone(), near, far, minDistance, maxDistance },
      started: performance.now(),
      arrive,
    };
    invalidate();
  }

  function step(now) {
    if (insetMove || transition) lastMotion = now;
    if (insetMove) {
      const t = Math.min((now - insetMove.started) / TRANSITION_MS, 1);
      framingShown = insetMove.from + (insetMove.to - insetMove.from) * easeInOut(Math.max(t, 0));
      if (t === 1) insetMove = null;
      applyViewOffset();
    }
    if (!transition) return;
    const t = Math.min((now - transition.started) / TRANSITION_MS, 1);
    const eased = easeInOut(t);
    camera.position.lerpVectors(transition.from.position, transition.to.position, eased);
    controls.target.lerpVectors(transition.from.target, transition.to.target, eased);
    if (t === 1) {
      transition.arrive();
      transition = null;
      // The last eased step can be below the controls' own change threshold; announce arrival.
      controls.dispatchEvent({ type: 'change' });
    }
    invalidate();
  }

  function tick(now) {
    step(now);
    controls.update();
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
  const handleLost = event => {
    event.preventDefault();
    onContextLost?.();
  };
  const handleRestored = () => {
    applyTheme();
    setSize();
    onContextRestored?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

  const observer = new ResizeObserver(setSize);
  observer.observe(host);
  controls.addEventListener('change', cameraMoved);

  return {
    scene, camera, controls,
    domElement: renderer.domElement,
    applyTheme, setAppearance, setSize, setOutlined, moveTo, invalidate,

    /**
     * Compile the outline programs before a pointer reaches a region.
     *
     * The first hover otherwise pays for those shaders inside the frame that
     * draws the ring. One sample mesh is enough: every region shares them.
     */
    warmOutlines(root) {
      let sample = null;
      root.traverse(object => {
        if (!sample && object.isMesh && object.visible) sample = object;
      });
      if (!sample) return;
      const previous = {
        haloObjects: halo.selectedObjects,
        coreObjects: core.selectedObjects,
        haloOn: halo.enabled,
        coreOn: core.enabled,
        target: renderer.getRenderTarget(),
        override: scene.overrideMaterial,
        background: scene.background,
        visible: sample.visible,
      };
      halo.selectedObjects = [sample];
      core.selectedObjects = [sample];
      halo.enabled = true;
      core.enabled = true;
      const target = settled.composer.renderTarget1;
      try {
        renderHalo(renderer, target, target, 0, false);
        renderCore(renderer, target, target, 0, false);
      } finally {
        scene.overrideMaterial = previous.override;
        scene.background = previous.background;
        sample.visible = previous.visible;
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
     * markers, the presets — is stale the moment it changes.
     */
    setChromeInsets(next) {
      const merged = { top: 0, right: 0, bottom: 0, left: 0, ...next };
      const same = Object.keys(merged).every(key => merged[key] === chromeInsets[key]);
      if (same) return;
      chromeInsets = merged;
      applyViewOffset();
      // Not a canvas resize: the sheet reports this on every frame of a drag,
      // and refitting there would fight the finger. The sheet reframes itself
      // when it settles on a detent.
      onResize?.({ canvasChanged: false });
    },

    /**
     * Keep framing clear of the bottom `bottom` pixels of the visible rectangle.
     * The image slides with the camera's eased move. Returns whether it changed.
     */
    setFramingInset({ bottom = 0 } = {}, { immediate = false } = {}) {
      if (bottom === framingInset) return false;
      framingInset = bottom;
      if (immediate || prefersReducedMotion()) {
        insetMove = null;
        framingShown = bottom;
        applyViewOffset();
      } else {
        insetMove = { from: framingShown, to: bottom, started: performance.now() };
        invalidate();
      }
      return true;
    },

    /** The canvas rectangle the interface leaves uncovered, in CSS pixels. */
    get visibleRect() { return measureVisible(); },

    /** The fraction of each frustum axis framing may use, for `planFraming`. */
    get viewportFit() {
      return fitScale(hostSize, framingRect());
    },

    /** Where the camera is headed: an eased move's plan, or where it already is. */
    get destination() {
      if (transition) return transition.plan;
      return {
        position: camera.position.clone(), target: controls.target.clone(),
        near: camera.near, far: camera.far,
        minDistance: controls.minDistance, maxDistance: controls.maxDistance,
      };
    },

    /** The canvas's CSS size, as of the last resize. */
    get hostSize() { return hostSize; },

    set sectionsProbe(probe) { hasSections = probe; },
    set transparencyProbe(probe) { hasTransparency = probe; },
    get distanceToTarget() { return camera.position.distanceTo(controls.target); },
    get viewportHeight() { return hostSize.height; },

    captureSnapshot() {
      settled.composer.render();
      return renderer.domElement.toDataURL('image/png');
    },

    setMriAppearance,

    dispose() {
      renderer.setAnimationLoop(null);
      looping = false;
      observer.disconnect();
      controls.removeEventListener('change', cameraMoved);
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      controls.dispose();
      lighting?.dispose();
      for (const { composer } of pipelines) {
        for (const pass of composer.passes) pass.dispose?.();
        composer.dispose();
      }
      renderer.dispose();
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
export function planFraming(camera, controls, bounds, direction, frameTo, fit, points = null) {
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
