import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FrontSide, HalfFloatType, PerspectiveCamera, Scene, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { paintOutlineEdges, sameMeshSet } from './outline-edges.js';
import { withOutlineOccluders } from './outline-occluders.js';

// Exercise the real pipeline construction without needing a WebGL context.
const source = readFileSync(new URL('./scene.js', import.meta.url), 'utf8');
const pipeline = source.slice(source.indexOf('  function createPipeline()'),
  source.indexOf('\n  /*\n   * A moving camera'));
function fixture() {
  const renderer = { getPixelRatio: () => 2, getRenderTarget: () => null, setRenderTarget() {} };
  const dependencies = { renderer, scene: new Scene(), camera: new PerspectiveCamera(), quality: { msaaSamples: 4 },
    EffectComposer, WebGLRenderTarget, HalfFloatType, RenderPass, OutlinePass, Vector2,
    FrontSide, withOutlineOccluders, paintOutlineEdges, sameMeshSet, OutputPass };
  return new Function(...Object.keys(dependencies), `${pipeline}; return createPipeline();`)(...Object.values(dependencies));
}

test('successive frames keep one image target and never write to the spare target', () => {
  const { composer, halo, core } = fixture();
  halo.enabled = core.enabled = true;
  const image = composer.readBuffer;
  const destinations = [];
  for (const pass of composer.passes) {
    pass.render = (renderer, write, read) => destinations.push(pass.renderToScreen ? null : read);
  }
  for (let i = 0; i < 3; i++) composer.render(0);
  assert.equal(composer.readBuffer, image);
  assert.ok(destinations.every(target => target === null || target === image));
  assert.ok(!destinations.includes(composer.writeBuffer));
});

test('the scene retains MSAA and cut stencil precision without resolving unused depth', () => {
  const { composer } = fixture();
  const target = composer.readBuffer;
  assert.equal(target.samples, 4);
  assert.equal(target.texture.type, HalfFloatType);
  assert.equal(target.depthBuffer, true);
  assert.equal(target.stencilBuffer, true);
  assert.equal(target.resolveDepthBuffer, false);
  assert.equal(target.resolveStencilBuffer, false);
});
