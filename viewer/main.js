import {
  ACESFilmicToneMapping, Box3, Color, DirectionalLight, HalfFloatType,
  HemisphereLight, PerspectiveCamera, Raycaster, Scene, Vector2,
  Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BrainAtlas } from './brain-atlas.js';
import { frameBounds } from './camera.js';
import './style.css';

const element = id => document.getElementById(id);
const viewport = element('viewport');
const inspector = element('inspector');
const scene = new Scene();
scene.background = new Color(0xf4f3ef);
const camera = new PerspectiveCamera(35, 1, 0.001, 10);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.domElement.setAttribute('aria-label', 'Brain model. Drag to rotate, scroll to zoom, click to select.');
renderer.domElement.tabIndex = 0;
viewport.prepend(renderer.domElement);

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
controls.minDistance = 0.025;
controls.maxDistance = 1.5;
controls.listenToKeyEvents(renderer.domElement);

const renderTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));
const occlusion = new GTAOPass(scene, camera, 1, 1);
occlusion.updateGtaoMaterial({ radius: 0.006, thickness: 0.012, samples: 16 });
occlusion.updatePdMaterial({ depthPhi: 0.002, normalPhi: 8, radius: 4 });
occlusion.blendIntensity = 0.8;
composer.addPass(occlusion);
const outline = new OutlinePass(new Vector2(1, 1), scene, camera);
outline.edgeStrength = 2.5;
outline.edgeThickness = 1;
outline.edgeGlow = 0;
outline.visibleEdgeColor.set(0x4c7364);
outline.hiddenEdgeColor.set(0x000000);
outline.enabled = false;
composer.addPass(outline);
composer.addPass(new OutputPass());

let model;
let dirty = true;
let hoverRegion = null;
let pointerStart = null;
let hoverFrame = null;
const raycaster = new Raycaster();
const bounds = new Box3();
const directions = {
  oblique: new Vector3(-1, 0.3, -0.45).normalize(),
  left: new Vector3(-1, 0, 0),
  right: new Vector3(1, 0, 0),
  anterior: new Vector3(0, 0, -1),
  posterior: new Vector3(0, 0, 1),
  superior: new Vector3(0, 1, 0),
  inferior: new Vector3(0, -1, 0),
};

function setView(view) {
  camera.up.set(0, 1, 0);
  if (view === 'superior') camera.up.set(0, 0, -1);
  if (view === 'inferior') camera.up.set(0, 0, 1);
  controls.target.copy(frameBounds(camera, bounds, directions[view]));
  controls.update();
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  inspector.dataset.view = view;
  dirty = true;
}

function updateOutline() {
  const ids = new Set([model.state.selectedRegion?.id, hoverRegion?.id]);
  outline.selectedObjects = model.visibleMeshes.filter(mesh => ids.has(mesh.userData.region_id));
  outline.enabled = outline.selectedObjects.length > 0;
  dirty = true;
}

function updateState() {
  const state = model.state;
  const region = state.selectedRegion;
  const atlas = model.manifest.atlases.find(atlas => atlas.id === state.atlas);
  // A single opaque depth buffer cannot represent translucent cortical layers.
  occlusion.enabled = !model.visibleMeshes.some(mesh => mesh.material.transparent);
  inspector.dataset.atlas = state.atlas;
  inspector.dataset.hemisphere = state.hemisphere;
  inspector.dataset.selectedRegion = region?.id ?? '';
  inspector.dataset.visibleMeshes = String(state.visibleMeshCount);
  element('viewer-state').textContent = JSON.stringify(state);
  element('atlas').value = state.atlas;
  element('hemisphere').value = state.hemisphere;
  element('cortex').checked = state.cortexVisible;
  element('opacity').value = state.cortexOpacity;
  element('opacity-value').value = `${Math.round(state.cortexOpacity * 100)}%`;
  element('atlas-colors').checked = state.atlasColors;
  element('selected-label').textContent = region?.label ?? 'Select a region';
  element('selected-description').textContent = region
    ? (region.kind === 'cortex' ? 'Cortical parcellation' : 'Volume-derived anatomical structure')
    : 'Click the surface, or hide the cortex to inspect internal anatomy.';
  element('selected-metadata').hidden = !region;
  element('selected-hemisphere').textContent = region?.hemisphere ?? '';
  element('selected-source').textContent = region?.source_label_id ?? '';
  element('selected-atlas').textContent = region?.atlas ?? '';
  element('isolate').disabled = !region || Boolean(state.isolatedRegion);
  element('atlas-note').textContent = state.atlas === 'hcp-mmp'
    ? 'HCP-MMP1.0 labels projected to fsaverage by Mills. '
    : 'Destrieux anatomical parcellation. ';
  element('model-status').textContent = `${atlas.label} · ${state.visibleMeshCount} visible meshes`;
  hoverRegion = null;
  element('hover-label').style.display = 'none';
  updateOutline();
}

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  return model.pick(raycaster);
}

function showError(error) {
  inspector.dataset.status = 'error';
  element('model-status').setAttribute('role', 'alert');
  element('model-status').textContent = error.message;
  console.error(error);
}

function resize() {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  dirty = true;
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(viewport);
controls.addEventListener('change', () => { dirty = true; });
renderer.setAnimationLoop(() => {
  controls.update();
  if (dirty) {
    composer.render();
    dirty = false;
  }
});

renderer.domElement.addEventListener('pointerdown', event => {
  pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
});
renderer.domElement.addEventListener('pointerup', event => {
  if (model && pointerStart?.button === 0 &&
      Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 5) {
    model.select(pick(event)?.id ?? null);
  }
  pointerStart = null;
});
renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; });
renderer.domElement.addEventListener('pointermove', event => {
  if (!model || event.buttons || hoverFrame !== null) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = null;
    hoverRegion = pick(event);
    const label = element('hover-label');
    label.textContent = hoverRegion?.label ?? '';
    label.style.display = hoverRegion ? 'block' : 'none';
    const rect = viewport.getBoundingClientRect();
    label.style.left = `${Math.min(event.clientX - rect.left + 16, rect.width - label.offsetWidth - 10)}px`;
    label.style.top = `${Math.min(event.clientY - rect.top + 16, rect.height - label.offsetHeight - 10)}px`;
    renderer.domElement.style.cursor = hoverRegion ? 'pointer' : 'grab';
    updateOutline();
  });
});
renderer.domElement.addEventListener('pointerleave', () => {
  if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
  hoverFrame = null;
  hoverRegion = null;
  element('hover-label').style.display = 'none';
  if (model) updateOutline();
});

element('atlas').addEventListener('change', async event => {
  element('model-controls').disabled = true;
  element('model-status').textContent = 'Loading cortical atlas…';
  inspector.dataset.status = 'loading';
  try {
    await model.setAtlas(event.target.value);
    inspector.dataset.status = 'ready';
  } catch (error) {
    showError(error);
  } finally {
    element('model-controls').disabled = false;
  }
});
element('hemisphere').addEventListener('change', event => model.setHemisphere(event.target.value));
element('cortex').addEventListener('change', event => model.setCortexVisible(event.target.checked));
element('opacity').addEventListener('input', event => model.setCortexOpacity(Number(event.target.value)));
element('atlas-colors').addEventListener('change', event => model.setAtlasColors(event.target.checked));
element('isolate').addEventListener('click', () => model.isolate());
element('reset').addEventListener('click', () => { model.reset(); setView('oblique'); });
for (const button of document.querySelectorAll('[data-view]')) {
  button.disabled = true;
  button.addEventListener('click', () => setView(button.dataset.view));
}

try {
  const manifestUrl = `${import.meta.env.BASE_URL}models/manifest.json`;
  model = await BrainAtlas.load(manifestUrl);
  scene.add(model.group);
  bounds.setFromObject(model.group);
  for (const atlas of model.manifest.atlases) {
    element('atlas').add(new Option(atlas.label, atlas.id));
  }
  model.addEventListener('change', updateState);
  resize();
  setView('oblique');
  updateState();
  element('loading').hidden = true;
  element('model-controls').disabled = false;
  for (const button of document.querySelectorAll('[data-view]')) button.disabled = false;
  inspector.dataset.status = 'ready';
} catch (error) {
  element('loading').textContent = `Unable to load brain model: ${error.message}`;
  showError(error);
}

window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
  resizeObserver.disconnect();
  controls.dispose();
  model?.dispose();
  for (const pass of composer.passes) pass.dispose();
  composer.dispose();
  renderer.dispose();
}, { once: true });
