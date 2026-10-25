import { expect, test } from 'vitest';
import {
  DirectionalLight,
  FloatType,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type { Camera, Texture } from 'three';
// @ts-expect-error TS7016: the legacy module is JavaScript and publishes no declarations.
import * as legacyNamespace from '../../../../../viewer/render/lighting.js';
import { createAnatomicalLighting } from './lighting.ts';
import type { LightingSettings } from './lighting.ts';

const legacyLighting: { createAnatomicalLighting: typeof createAnatomicalLighting } =
  legacyNamespace;

/** What a sphere of this roughness reflects of the environment, as float pixels. */
function reflect(renderer: WebGLRenderer, texture: Texture, roughness: number): Float32Array {
  const scene = new Scene();
  scene.add(
    new Mesh(
      new SphereGeometry(1, 32, 16),
      new MeshStandardMaterial({ envMap: texture, metalness: 1, roughness, color: 0xffffff }),
    ),
  );
  const camera = new PerspectiveCamera(30, 1, 0.1, 10);
  camera.position.set(0.5, 0.3, 4);
  camera.lookAt(0, 0, 0);
  const target = new WebGLRenderTarget(64, 64, { type: FloatType });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Float32Array(64 * 64 * 4);
  renderer.readRenderTargetPixels(target, 0, 0, 64, 64, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  return pixels;
}

// Real WebGL, because PMREMGenerator draws the studio room into a render target (decision 25 on #4).
const SETTINGS: LightingSettings = { hemisphere: 0.28, key: 1.8, fill: 0.5, rim: 0.7 };

const size = (texture: Texture) => texture.image as { width: number; height: number };

function rig(camera: Camera) {
  const group = camera.children.find((child): child is Group => child instanceof Group)!;
  return group.children.map((child) => ({
    type: child.constructor.name,
    color:
      child instanceof DirectionalLight || child instanceof HemisphereLight
        ? child.color.toArray()
        : null,
    groundColor: child instanceof HemisphereLight ? child.groundColor.toArray() : null,
    intensity:
      child instanceof DirectionalLight || child instanceof HemisphereLight
        ? child.intensity
        : null,
    position: child.position.toArray(),
  }));
}

test('the light rig and the environment match the legacy module under real WebGL', () => {
  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  const legacyCamera = new PerspectiveCamera();
  const camera = new PerspectiveCamera();
  const legacy = legacyLighting.createAnatomicalLighting(renderer, legacyCamera, SETTINGS);
  const current = createAnatomicalLighting(renderer, camera, SETTINGS);

  expect(rig(camera)).toStrictEqual(rig(legacyCamera));
  expect(rig(camera)).toHaveLength(7);
  const { texture } = current;
  const expected = legacy.texture;
  expect(texture.constructor).toBe(expected.constructor);
  for (const field of [
    'mapping',
    'format',
    'type',
    'colorSpace',
    'minFilter',
    'magFilter',
    'generateMipmaps',
  ] as const) {
    expect(texture[field], field).toBe(expected[field]);
  }
  expect([size(texture).width, size(texture).height]).toStrictEqual([
    size(expected).width,
    size(expected).height,
  ]);

  // The environment itself: every pixel a sphere reflects from it, at three roughnesses.
  for (const roughness of [0, 0.5, 1]) {
    const actual = reflect(renderer, texture, roughness);
    const wanted = reflect(renderer, expected, roughness);
    expect(
      actual.some((value) => value !== 0),
      'the environment is not black',
    ).toBe(true);
    expect(actual, `roughness ${roughness}`).toStrictEqual(wanted);
  }

  current.dispose();
  legacy.dispose();
  expect(camera.children).toHaveLength(0);
  expect(legacyCamera.children).toHaveLength(0);
  renderer.dispose();
});
