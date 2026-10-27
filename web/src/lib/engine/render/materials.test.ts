import assert from 'node:assert/strict';
import { ShaderLib } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { afterEach, test, vi } from 'vitest';
import type { Region } from '../../types/index.ts';
import { createAnatomicalMaterial, tissueColor } from './materials.ts';
import type { AnatomicalUserData } from './materials.ts';
import { appearance, corticalMesh, patchCombinations } from './test-support.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const palette = appearance.tissue;
const region = (fields: object) => fields as Region;

test('SHADER-01 a region is drawn in its tissue class: the declared tissue, then the kind, then the name', () => {
  const colour = (fields: object) => tissueColor(fields, palette);
  assert.equal(colour({ tissue: 'white' }), '#e5dbc5');
  assert.equal(colour({ tissue: 'bogus', kind: 'cortex' }), '#c4a897');
  assert.equal(colour({ kind: 'non-region' }), '#c4a897');
  for (const name of ['Left-Lateral-Ventricle', 'Right-Inf-Lat-Vent', '3rd-Ventricle', 'CSF']) {
    assert.equal(colour({ source_name: name }), '#67777c', name);
  }
  for (const name of ['Left-Cerebral-White-Matter', 'CC_Body', 'corpus callosum']) {
    assert.equal(colour({ source_name: name }), '#e5dbc5', name);
  }
  for (const name of [
    'Left-paraventricular_nucleus_of_hypothalamus',
    'Right-periventricular_nucleus__supraoptic_portion',
    'Left-juxtaparaventricular_lateral_hypothalamic_area',
    'Left-Caudate',
    '',
  ]) {
    assert.equal(colour({ source_name: name }), '#a68d80', name);
  }
  assert.equal(colour({}), '#a68d80');
  assert.equal(colour({ tissue: 'fluid', source_name: 'Central canal' }), '#67777c');
});

test('SHADER-02 a surface keeps its published colour and takes the manifest lighting, without a coat on a phone', () => {
  const build = () =>
    createAnatomicalMaterial(
      corticalMesh(false) as never,
      region({ id: 'r', kind: 'cortex' }),
      appearance,
    );
  const material = build();
  assert.equal(material.color.getHexString(), '336699');
  assert.deepEqual(
    [
      material.roughness,
      material.clearcoat,
      material.clearcoatRoughness,
      material.ior,
      material.specularIntensity,
    ],
    [0.62, 0.08, 0.45, 1.38, 0.55],
  );
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const phone = build();
  assert.equal(phone.clearcoat, 0);
  assert.equal(phone.roughness, 0.62);
});

test('SHADER-03 a cortex without a one-value-per-vertex shading field is refused, a structure needs none', () => {
  const missing = (mutate: (mesh: ReturnType<typeof corticalMesh>) => void, name: string) => {
    const mesh = corticalMesh(false);
    mutate(mesh);
    assert.throws(
      () =>
        createAnatomicalMaterial(mesh as never, region({ id: 'r', kind: 'cortex' }), appearance),
      { message: `Missing source shading attribute ${name}: r` },
    );
  };
  missing((mesh) => mesh.geometry.deleteAttribute('_t1'), '_t1');
  missing(
    (mesh) => mesh.geometry.setAttribute('_sulc', { itemSize: 2, count: 5 } as never),
    '_sulc',
  );
  missing(
    (mesh) => mesh.geometry.setAttribute('_sulc', { itemSize: 1, count: 4 } as never),
    '_sulc',
  );
  const bare = corticalMesh(false);
  for (const name of ['_sulc', '_concavity', '_t1']) bare.geometry.deleteAttribute(name);
  const structure = createAnatomicalMaterial(
    bare as never,
    region({ id: 's', kind: 'structure' }),
    appearance,
  );
  assert.equal('tissueVariation' in structure.userData, false);
});

function compile(material: { onBeforeCompile: (shader: never, renderer: never) => void }) {
  const shader = {
    ...ShaderLib.physical,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader as never, undefined as never);
  return shader.uniforms as Record<string, { value: unknown }>;
}

test('SHADER-04 the shading fields are decoded over the manifest span, and read straight through without one', () => {
  const material = createAnatomicalMaterial(
    corticalMesh(false) as never,
    region({ id: 'r', kind: 'cortex' }),
    appearance,
  );
  const uniforms = compile(material);
  const decode = (name: string, stored: number) => {
    const [low, span] = uniforms[name]!.value as [number, number];
    return stored * span + low;
  };
  const near = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-4, `${actual} ≠ ${expected}`);
  near(decode('sulcDecode', 0.5), 1.6756);
  near(decode('t1Decode', 0.5), 121.1108);
  const { field_ranges: _ranges, ...unranged } = appearance;
  const raw = compile(
    createAnatomicalMaterial(
      corticalMesh(false) as never,
      region({ id: 'r', kind: 'cortex' }),
      unranged,
    ),
  );
  for (const name of ['sulcDecode', 'concavityDecode', 't1Decode']) {
    assert.deepEqual(raw[name]!.value, [0, 1]);
  }
});

test('SHADER-05 the surface starts with the T1 window of the manifest and 0.28 of variation', () => {
  const material = createAnatomicalMaterial(
    corticalMesh(false) as never,
    region({ id: 'r', kind: 'cortex' }),
    appearance,
  );
  const uniforms = compile(material);
  assert.deepEqual(uniforms['t1Range']!.value, [85, 180]);
  assert.equal((material.userData as AnatomicalUserData).tissueVariation.value, 0.28);
});

test('SHADER-07 a surface built with the network layer has a network mix at 0, one without has none', () => {
  const build = (networks: boolean) =>
    createAnatomicalMaterial(
      corticalMesh(networks) as never,
      region({ id: 'r', kind: 'cortex' }),
      appearance,
    );
  assert.deepEqual((build(true).userData as AnatomicalUserData).networkMix, { value: 0 });
  assert.equal((build(false).userData as AnatomicalUserData).networkMix, null);
});

test('SHADER-35 two materials with different patch sets never share a program key, and equal ones do', () => {
  const first = patchCombinations();
  assert.equal(first.size, 19);
  const keys = [...first.values()].map((material) => material.customProgramCacheKey());
  // The cut and plain materials differ by the MRI patch and mark alone, so every set needs its own key.
  assert.equal(new Set(keys).size, keys.length, 'keys are pairwise distinct');
  const second = patchCombinations();
  for (const [name, material] of first) {
    assert.equal(second.get(name)!.customProgramCacheKey(), material.customProgramCacheKey(), name);
  }
});

test('SHADER-06 the surface hands the shader the manifest fold ranges and strengths', () => {
  const material = createAnatomicalMaterial(
    corticalMesh(false) as never,
    region({ id: 'r', kind: 'cortex' }),
    appearance,
  );
  const uniforms = compile(material);
  assert.deepEqual(uniforms['concavityRange']!.value, [-0.08, 0.04]);
  assert.deepEqual(uniforms['foldRange']!.value, [-0.5, 1.8]);
  assert.deepEqual(uniforms['foldStrength']!.value, [0.48, 0.78]);
});
