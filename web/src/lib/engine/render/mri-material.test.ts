/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Data3DTexture, Matrix4, MeshPhysicalMaterial, ShaderLib } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import {
  addMriAppearance,
  createMriUniforms,
  setMriHighlight,
  setMriWindow,
} from './mri-material.ts';
import type { MriUniforms } from './mri-material.ts';

const anatomy = () =>
  createMriUniforms({
    texture: null,
    worldToVoxel: new Matrix4(),
    volume: { shape: [2, 2, 2] },
  });

function compiled(uniforms: MriUniforms, highlight = 'lift') {
  const material = new MeshPhysicalMaterial();
  addMriAppearance(material, uniforms, highlight);
  const shader = { ...ShaderLib.physical, uniforms: {} } as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, undefined as never);
  return { material, shader };
}

const rgb = (color: { toArray(): number[] }) =>
  color.toArray().map((value) => Math.round(value * 255));

test('surfaces share a live contrast window without recompiling or changing material colour', () => {
  const uniforms = anatomy();
  const shaders: WebGLProgramParametersWithUniforms[] = [];
  const materials = [new MeshPhysicalMaterial({ color: '#cc6633' }), new MeshPhysicalMaterial()];
  for (const material of materials) {
    addMriAppearance(material, uniforms);
    const shader = { ...ShaderLib.physical, uniforms: {} } as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, undefined as never);
    shaders.push(shader);
  }
  const versions = materials.map((material) => material.version);
  setMriWindow(uniforms, 110, 200);
  for (const shader of shaders) {
    assert.equal(shader.uniforms.scanVolume, uniforms.scanVolume);
    assert.deepEqual(shader.uniforms.scanWindow!.value.toArray(), [110, 200]);
  }
  assert.deepEqual(
    materials.map((material) => material.version),
    versions,
  );
  assert.equal(materials[0]!.color.getHexString(), 'cc6633');
  for (const material of materials) material.dispose();
});

test('invalid MRI windows fail without mutating the current contrast', () => {
  const uniforms = anatomy();
  setMriWindow(uniforms, 90, 180);
  for (const [center, width] of [
    [NaN, 180],
    [90, 0],
    [90, -1],
    [90, Infinity],
  ] as const) {
    assert.throws(() => setMriWindow(uniforms, center, width), RangeError);
    assert.deepEqual(uniforms.scanWindow.value.toArray(), [90, 180]);
  }
});

test('every surface shares one live mark colour without recompiling', () => {
  const uniforms = anatomy();
  const built = [compiled(uniforms, 'lift'), compiled(uniforms, 'capLift')];
  const versions = built.map(({ material }) => material.version);
  setMriHighlight(uniforms, '#4fb6e0');
  for (const { shader } of built) {
    assert.equal(shader.uniforms.scanHighlight, uniforms.scanHighlight);
    // The uniform carries the display bytes the token spells, because the
    // mark is mixed into a display grey and decoded with it.
    assert.deepEqual(rgb(shader.uniforms.scanHighlight!.value), [0x4f, 0xb6, 0xe0]);
  }
  assert.deepEqual(
    built.map(({ material }) => material.version),
    versions,
  );
  for (const { material } of built) material.dispose();
});

test('an unreadable mark colour fails without mutating the current one', () => {
  const uniforms = anatomy();
  setMriHighlight(uniforms, '#4fb6e0');
  for (const bad of ['', '   ', null, 42, undefined]) {
    assert.throws(() => setMriHighlight(uniforms, bad as never), RangeError);
    assert.deepEqual(rgb(uniforms.scanHighlight.value), [0x4f, 0xb6, 0xe0]);
  }
});

test('the scan texture handed in is the one the shader samples', () => {
  const texture = new Data3DTexture(new Uint8Array(8), 2, 2, 2);
  const uniforms = createMriUniforms({
    texture,
    worldToVoxel: new Matrix4(),
    volume: { shape: [2, 2, 2] },
  });
  assert.equal(uniforms.scanVolume.value, texture);
  assert.deepEqual(uniforms.scanShape.value.toArray(), [2, 2, 2]);
  texture.dispose();
});
