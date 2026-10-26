import { expect, test } from 'vitest';
import {
  CubeUVReflectionMapping,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderTarget,
  WebGLRenderer,
  FloatType,
} from 'three';
import type { Camera, Texture } from 'three';
import { createAnatomicalLighting } from './lighting.ts';
import type { LightingSettings } from './lighting.ts';

/** What a white metal sphere of this roughness reflects of the environment, as float pixels. */
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

const SETTINGS: LightingSettings = { hemisphere: 0.28, key: 1.8, fill: 0.5, rim: 0.7 };

function rig(camera: Camera) {
  const group = camera.children.find((child): child is Group => child instanceof Group)!;
  return group.children.filter(
    (child) => child instanceof HemisphereLight || child instanceof DirectionalLight,
  );
}

// The first reflect() compiles the PBR shader with an environment map on SwiftShader (about 2 s on an
// idle machine, once per renderer), so a loaded machine can exceed the browser project's 15 s default.
const SHADER_COMPILE_TIMEOUT_MS = 30_000;

// Real WebGL, because PMREMGenerator draws the studio room into a render target (decision 25 on #4).
test(
  'SHADER-33 and SHADER-34 the camera carries the light rig, the room is prefiltered and non-black at every roughness, and disposal clears both',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
    const camera = new PerspectiveCamera();
    const lighting = createAnatomicalLighting(renderer, camera, SETTINGS);

    // SHADER-33: a hemisphere light and three white directional lights aimed just ahead of the camera.
    const group = camera.children[0] as Group;
    expect(camera.children).toHaveLength(1);
    expect(group.children).toHaveLength(7);
    const [hemisphere, ...directional] = rig(camera) as [HemisphereLight, ...DirectionalLight[]];
    expect(hemisphere.color.getHex()).toBe(0xffffff);
    expect(hemisphere.groundColor.getHex()).toBe(0x777777);
    expect(hemisphere.intensity).toBe(0.28);
    expect(directional.map((light) => [light.color.getHex(), light.intensity])).toStrictEqual([
      [0xffffff, 1.8],
      [0xffffff, 0.5],
      [0xffffff, 0.7],
    ]);
    expect(directional.map((light) => light.position.toArray())).toStrictEqual([
      [-1.5, 2, 1],
      [2, 0.3, 0.5],
      [0.4, 1, -2],
    ]);
    for (const light of directional)
      expect(light.target.position.toArray()).toStrictEqual([0, 0, -1]);

    // SHADER-34: a PMREM texture that reflects something at every roughness.
    expect(lighting.texture.mapping).toBe(CubeUVReflectionMapping);
    for (const roughness of [0, 0.5, 1]) {
      const pixels = reflect(renderer, lighting.texture, roughness);
      expect(
        pixels.some((value, index) => index % 4 !== 3 && value > 0),
        `roughness ${roughness} is not black`,
      ).toBe(true);
    }

    lighting.dispose();
    expect(camera.children).toHaveLength(0);
    renderer.dispose();
  },
);
