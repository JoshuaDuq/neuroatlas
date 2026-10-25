import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
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
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { frameTo } from './camera-views.ts';
import * as outlineEdges from './outline-edges.ts';
import * as outlineOccluders from './outline-occluders.ts';
import { createPipeline, planFraming } from './scene.ts';

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
