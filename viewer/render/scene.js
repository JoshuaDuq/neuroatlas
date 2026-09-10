import {
  ACESFilmicToneMapping, Color, DirectionalLight, HalfFloatType, HemisphereLight,
  PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const TRANSITION_MS = 240;

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const prefersReducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Read a scene colour from the CSS token layer, the single source of truth. */
const token = name =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * The renderer, its passes, and the camera transition.
 *
 * Owns nothing about the interface: it is handed a host element and told what
 * to outline. Selection and hover are drawn here, over the render, so the
 * model never has to alter a material to show them.
 */
export function createScene(host) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.001, 10);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label',
    'Brain model. Drag to rotate, scroll to zoom, click a region to select.');
  host.prepend(renderer.domElement);

  scene.add(new HemisphereLight(0xf1f5ff, 0xa2a297, 1.0));
  const keyLight = new DirectionalLight(0xfff3df, 2.8);
  keyLight.position.set(-0.3, 0.45, -0.35);
  scene.add(keyLight);
  const fillLight = new DirectionalLight(0xe2ebf3, 0.55);
  fillLight.position.set(0.35, 0.12, 0.25);
  scene.add(fillLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.listenToKeyEvents(renderer.domElement);

  const renderTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));

  const occlusion = new GTAOPass(scene, camera, 1, 1);
  occlusion.updateGtaoMaterial({ radius: 0.006, thickness: 0.012, samples: 16 });
  occlusion.updatePdMaterial({ depthPhi: 0.002, normalPhi: 8, radius: 4 });
  occlusion.blendIntensity = 0.8;
  composer.addPass(occlusion);

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
  const core = new OutlinePass(new Vector2(1, 1), scene, camera);
  core.edgeStrength = 6;
  core.edgeThickness = 1;
  core.edgeGlow = 0;
  composer.addPass(halo);
  composer.addPass(core);
  composer.addPass(new OutputPass());

  let dirty = true;
  let transition = null;
  let hasTransparency = () => false;
  const invalidate = () => { dirty = true; };

  function applyTheme() {
    scene.background = new Color(token('--scene-background'));
    renderer.toneMappingExposure = Number(token('--scene-exposure')) || 1;
    halo.visibleEdgeColor.set(token('--scene-outline-halo'));
    halo.hiddenEdgeColor.set(token('--scene-outline-hidden'));
    core.visibleEdgeColor.set(token('--scene-outline-core'));
    core.hiddenEdgeColor.set(token('--scene-outline-hidden'));
    invalidate();
  }

  function setSize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  /** Selection gets both tones; hover gets the halo alone. */
  function setOutlined({ selected = [], hovered = [] } = {}) {
    halo.selectedObjects = [...new Set([...selected, ...hovered])];
    core.selectedObjects = selected;
    halo.enabled = halo.selectedObjects.length > 0;
    core.enabled = core.selectedObjects.length > 0;
    invalidate();
  }

  /**
   * Move to a framed destination. Orbit limits are applied on arrival, not on
   * departure: a tighter maxDistance would otherwise yank a distant camera.
   */
  function moveTo({ position, target, near, far, minDistance, maxDistance }) {
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
    const arrive = () => {
      controls.minDistance = minDistance;
      controls.maxDistance = maxDistance;
      controls.update();
    };
    if (prefersReducedMotion()) {
      camera.position.copy(position);
      controls.target.copy(target);
      arrive();
      invalidate();
      return;
    }
    transition = {
      from: { position: camera.position.clone(), target: controls.target.clone() },
      to: { position: position.clone(), target: target.clone() },
      started: performance.now(),
      arrive,
    };
    invalidate();
  }

  function step(now) {
    if (!transition) return;
    const t = Math.min((now - transition.started) / TRANSITION_MS, 1);
    const eased = easeInOut(t);
    camera.position.lerpVectors(transition.from.position, transition.to.position, eased);
    controls.target.lerpVectors(transition.from.target, transition.to.target, eased);
    if (t === 1) {
      transition.arrive();
      transition = null;
    }
    invalidate();
  }

  renderer.setAnimationLoop(now => {
    step(now);
    controls.update();
    if (!dirty) return;
    // A single opaque depth buffer cannot represent translucent cortex.
    occlusion.enabled = !hasTransparency();
    composer.render();
    dirty = false;
  });

  const onContextLost = event => {
    event.preventDefault();
    host.closest('#app')?.setAttribute('data-status', 'context-lost');
  };
  const onContextRestored = () => {
    host.closest('#app')?.setAttribute('data-status', 'ready');
    applyTheme();
    setSize();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

  const observer = new ResizeObserver(setSize);
  observer.observe(host);
  controls.addEventListener('change', invalidate);

  return {
    scene, camera, controls,
    domElement: renderer.domElement,
    applyTheme, setSize, setOutlined, moveTo, invalidate,
    set transparencyProbe(probe) { hasTransparency = probe; },
    get distanceToTarget() { return camera.position.distanceTo(controls.target); },
    get viewportHeight() { return host.getBoundingClientRect().height; },

    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.removeEventListener('change', invalidate);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      for (const pass of composer.passes) pass.dispose?.();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Where a camera would sit to frame these bounds, without moving it there. */
export function planFraming(camera, controls, bounds, direction, frameTo) {
  const start = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    near: camera.near,
    far: camera.far,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  };
  const target = frameTo(camera, controls, bounds, direction);
  const plan = {
    position: camera.position.clone(),
    target: target.clone(),
    near: camera.near,
    far: camera.far,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  };
  camera.position.copy(start.position);
  controls.target.copy(start.target);
  camera.near = start.near;
  camera.far = start.far;
  controls.minDistance = start.minDistance;
  controls.maxDistance = start.maxDistance;
  camera.updateProjectionMatrix();
  return plan;
}
