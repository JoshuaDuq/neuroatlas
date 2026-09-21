import assert from 'node:assert/strict';
import test from 'node:test';
import { Matrix4, MeshPhysicalMaterial, ShaderLib } from 'three';
import { addMriAppearance, createMriUniforms, setMriHighlight, setMriWindow } from './mri-material.js';

test('surfaces share a live contrast window without recompiling or changing material colour', () => {
  const uniforms = createMriUniforms({ texture: null, worldToVoxel: new Matrix4(),
    volume: { shape: [2, 2, 2] } });
  const shaders = [];
  const materials = [new MeshPhysicalMaterial({ color: '#cc6633' }), new MeshPhysicalMaterial()];
  for (const material of materials) {
    addMriAppearance(material, uniforms);
    const shader = { uniforms: {}, ...ShaderLib.physical };
    material.onBeforeCompile(shader);
    shaders.push(shader);
  }
  const versions = materials.map(material => material.version);
  setMriWindow(uniforms, 110, 200);
  for (const shader of shaders) {
    assert.equal(shader.uniforms.scanVolume, uniforms.scanVolume);
    assert.deepEqual(shader.uniforms.scanWindow.value.toArray(), [110, 200]);
  }
  assert.deepEqual(materials.map(material => material.version), versions);
  assert.equal(materials[0].color.getHexString(), 'cc6633');
  for (const material of materials) material.dispose();
});

test('invalid MRI windows fail without mutating the current contrast', () => {
  const uniforms = createMriUniforms({ texture: null, worldToVoxel: new Matrix4(),
    volume: { shape: [2, 2, 2] } });
  setMriWindow(uniforms, 90, 180);
  for (const [center, width] of [[NaN, 180], [90, 0], [90, -1], [90, Infinity]]) {
    assert.throws(() => setMriWindow(uniforms, center, width), RangeError);
    assert.deepEqual(uniforms.scanWindow.value.toArray(), [90, 180]);
  }
});

function compiled(uniforms, highlight = 'lift') {
  const material = new MeshPhysicalMaterial();
  addMriAppearance(material, uniforms, highlight);
  const shader = { uniforms: {}, ...ShaderLib.physical };
  material.onBeforeCompile(shader);
  return { material, shader };
}

const rgb = color => color.toArray().map(value => Math.round(value * 255));

const anatomy = () => createMriUniforms({ texture: null, worldToVoxel: new Matrix4(),
  volume: { shape: [2, 2, 2] } });

test('a marked cut face takes the accent as hue instead of washing toward white', () => {
  const uniforms = anatomy();
  const { material, shader } = compiled(uniforms);
  assert.match(shader.fragmentShader, /uniform vec3 scanHighlight;/);
  // The scan is the luminance channel, so a mark that only moved luminance
  // would be indistinguishable from brighter tissue.
  assert.doesNotMatch(shader.fragmentShader, /mix\(gray, 1\.0/);
  material.dispose();
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
    assert.deepEqual(rgb(shader.uniforms.scanHighlight.value), [0x4f, 0xb6, 0xe0]);
  }
  assert.deepEqual(built.map(({ material }) => material.version), versions);
  for (const { material } of built) material.dispose();
});

test('an unreadable mark colour fails without mutating the current one', () => {
  const uniforms = anatomy();
  setMriHighlight(uniforms, '#4fb6e0');
  for (const bad of ['', '   ', null, 42, undefined]) {
    assert.throws(() => setMriHighlight(uniforms, bad), RangeError);
    assert.deepEqual(rgb(uniforms.scanHighlight.value), [0x4f, 0xb6, 0xe0]);
  }
});
