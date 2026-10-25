import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, onTestFinished, vi } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Data3DTexture,
  DataTexture,
  Float32BufferAttribute,
  Material,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RedFormat,
  ShaderLib,
  UnsignedByteType,
  Vector2,
  Vector3,
} from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { parse } from 'yaml';
import * as legacyMaterials from '../../viewer/render/materials.js';
import * as legacyMri from '../../viewer/render/mri-material.js';
import * as legacyFeather from '../../viewer/render/border-feather.js';
import * as legacyNetworks from '../../viewer/render/network-colors.js';
import * as legacyHighlight from '../../viewer/tissues/highlight.js';
import * as legacyLabelSampling from '../../viewer/tissues/label-sampling.js';
import * as legacyShader from '../../viewer/tissues/shader.js';
import * as legacySolid from '../../viewer/tissues/solid-material.js';
import * as legacyCap from '../../viewer/tissues/cap-labels.js';
import * as legacyPalette from '../../viewer/tissues/palette.js';
import * as legacyWhiteMatter from '../../viewer/tissues/white-matter.js';
import { Volume as LegacyVolume } from '../../viewer/slices/volume.js';
import * as materials from '../src/lib/engine/render/materials.ts';
import * as mri from '../src/lib/engine/render/mri-material.ts';
import * as feather from '../src/lib/engine/render/border-feather.ts';
import * as networkColors from '../src/lib/engine/render/network-colors.ts';
import * as highlight from '../src/lib/engine/tissues/highlight.ts';
import * as labelSampling from '../src/lib/engine/tissues/label-sampling.ts';
import * as cutShader from '../src/lib/engine/tissues/shader.ts';
import * as solid from '../src/lib/engine/tissues/solid-material.ts';
import * as cap from '../src/lib/engine/tissues/cap-labels.ts';
import * as palette from '../src/lib/engine/tissues/palette.ts';
import * as whiteMatter from '../src/lib/engine/tissues/white-matter.ts';
import { anatomies, asDisplaySettings, readModel } from '../src/lib/core/catalog/test-support.ts';
import type { FunctionalRegions } from '../src/lib/core/catalog/functional-regions.ts';
import type { CabNpPartition } from '../src/lib/core/catalog/networks.ts';
import type { Appearance } from '../src/lib/engine/render/materials.ts';
import type { NetworkMetadata } from '../src/lib/engine/render/network-colors.ts';
import type { Label, PaletteLookup } from '../src/lib/engine/tissues/palette.ts';
import type { Region } from '../src/lib/types/index.ts';

type Shader = WebGLProgramParametersWithUniforms;
type Legacy = (...args: never[]) => unknown;

/** mulberry32: a seeded PRNG, so every run draws the same corpus. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const models = new URL(`../../public/models/${anatomies.default}/`, import.meta.url);
const manifest = readModel<{
  regions: Region[];
  networks: NetworkMetadata;
  appearance: Appearance & {
    lighting: { hemisphere: number; key: number; fill: number; rim: number };
  };
}>(`${anatomies.default}/manifest.json`);
const tissueLabels = readModel<{ atlases: Record<string, { labels: Label[] }> }>(
  `${anatomies.default}/tissue-labels.json`,
);
const cabNp = readModel<CabNpPartition>(`${anatomies.default}/cab-np.json`);
const functional = readModel<FunctionalRegions>(`${anatomies.default}/functional-regions.json`);
const { appearance: configAppearance } = parse(
  readFileSync(new URL('../../config/model.yaml', import.meta.url), 'utf8'),
) as { appearance: Appearance };
const appearanceWithoutRanges: Appearance = { ...manifest.appearance };
delete appearanceWithoutRanges.field_ranges;

/** A value with every Three.js object reduced to its numbers, so identities and uuids drop out. */
function plain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  const object = value as Record<string, unknown> & {
    isTexture?: boolean;
    toArray?: () => unknown;
  };
  if (object.isTexture) {
    const texture = value as Data3DTexture;
    return {
      texture: texture.constructor.name,
      format: texture.format,
      type: texture.type,
      internalFormat: texture.internalFormat,
      minFilter: texture.minFilter,
      magFilter: texture.magFilter,
      unpackAlignment: texture.unpackAlignment,
      width: texture.image?.width,
      height: texture.image?.height,
      depth: (texture.image as { depth?: number } | undefined)?.depth,
      data: texture.image?.data ? Array.from(texture.image.data as ArrayLike<number>) : null,
    };
  }
  if (typeof object.toArray === 'function') return object.toArray();
  if (Array.isArray(value)) return value.map(plain);
  return Object.fromEntries(Object.entries(object).map(([key, entry]) => [key, plain(entry)]));
}

function stub(): Shader {
  // A fresh uniforms object: ShaderLib.physical's own would be shared, and mutated, by every compile.
  return { ...ShaderLib.physical, uniforms: {} } as unknown as Shader;
}

/** Compile `material` the way the renderer would and describe what it produced. */
function compile(material: Material) {
  const shader = stub();
  material.onBeforeCompile(shader, undefined as never);
  return {
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    uniforms: plain(shader.uniforms),
    key: material.customProgramCacheKey(),
  };
}

/** The state of the material itself, which the factories set before any shader exists. */
function describeMaterial(material: MeshPhysicalMaterial) {
  return {
    side: material.side,
    roughness: material.roughness,
    clearcoat: material.clearcoat,
    clearcoatRoughness: material.clearcoatRoughness,
    ior: material.ior,
    specularIntensity: material.specularIntensity,
    polygonOffset: material.polygonOffset,
    polygonOffsetFactor: material.polygonOffsetFactor,
    polygonOffsetUnits: material.polygonOffsetUnits,
    color: material.color.toArray(),
    userData: plain(material.userData),
  };
}

function stubMatchMedia(phone: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches: phone }));
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

function corticalMesh(withNetworks: boolean, count = 5) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
  for (const name of ['_sulc', '_concavity', '_t1']) {
    geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(count).fill(0.5), 1));
  }
  if (withNetworks) {
    geometry.setAttribute(
      '_network',
      new Float32BufferAttribute(new Float32Array(count).fill(1), 1),
    );
  }
  return new Mesh(geometry, new MeshStandardMaterial({ color: '#336699', roughness: 0.3 }));
}

const anatomyFixture = () => ({
  texture: new Data3DTexture(new Uint8Array(8), 2, 2, 2),
  worldToVoxel: new Matrix4().makeTranslation(1, 2, 3),
  volume: { shape: [2, 2, 2] as [number, number, number] },
});

const HIGHLIGHTS = ['0.0', 'lift', 'capLift'];

describe('the onBeforeCompile patches and their compositions compile to the same shader', () => {
  const compositions: {
    name: string;
    run: (impl: 'legacy' | 'new', anatomy: ReturnType<typeof anatomyFixture>) => Material[];
  }[] = [];

  const modules = (impl: 'legacy' | 'new') =>
    impl === 'legacy'
      ? {
          anatomical: legacyMaterials.createAnatomicalMaterial as Legacy,
          addMri: legacyMri.addMriAppearance as unknown as typeof mri.addMriAppearance,
          mriUniforms: legacyMri.createMriUniforms as unknown as typeof mri.createMriUniforms,
          addFeather: legacyFeather.addBorderFeather as unknown as typeof feather.addBorderFeather,
          cut: legacyShader.createCutMaterial as unknown as typeof cutShader.createCutMaterial,
          solid: legacySolid.createSolidMaterial as unknown as typeof solid.createSolidMaterial,
          addCap: legacyCap.addCapLabels as unknown as typeof cap.addCapLabels,
          capLabels: legacyCap.createCapLabels as unknown as typeof cap.createCapLabels,
          whiteMatter:
            legacyWhiteMatter.createWhiteMatter as unknown as typeof whiteMatter.createWhiteMatter,
        }
      : {
          anatomical: materials.createAnatomicalMaterial as unknown as Legacy,
          addMri: mri.addMriAppearance,
          mriUniforms: mri.createMriUniforms,
          addFeather: feather.addBorderFeather,
          cut: cutShader.createCutMaterial,
          solid: solid.createSolidMaterial,
          addCap: cap.addCapLabels,
          capLabels: cap.createCapLabels,
          whiteMatter: whiteMatter.createWhiteMatter,
        };

  const surface = (
    impl: 'legacy' | 'new',
    appearance: Appearance,
    withNetworks: boolean,
    region: object,
  ) => {
    const mesh = corticalMesh(withNetworks);
    return modules(impl).anatomical(
      mesh as never,
      region as never,
      appearance as never,
    ) as MeshPhysicalMaterial;
  };

  const whiteMatterRecord = {
    shape: [3, 2, 2],
    order: 'F',
    voxel_to_surface_ras_mm: [
      [-1, 0, 0, 10],
      [0, 0, 1, 0],
      [0, -1, 0, 0],
      [0, 0, 0, 1],
    ],
    applies_to: ['destrieux', 'hcp-mmp'],
    labels: [
      { source_label_id: 0, region_id: null },
      { source_label_id: 3024, region_id: 'wmparc:left:3024' },
      { source_label_id: 4035, region_id: 'wmparc:right:4035' },
    ],
  };
  const whiteMatterCodes = () => {
    const codes = new Uint8Array(12);
    codes[2] = 1;
    codes[9] = 2;
    return codes;
  };

  for (const appearance of [
    ['with field ranges', manifest.appearance],
    ['without field ranges', appearanceWithoutRanges],
    ['from config/model.yaml', configAppearance],
  ] as const) {
    for (const withNetworks of [false, true]) {
      for (const kind of ['cortex', 'non-region', 'structure', 'tissue-region']) {
        // Only cortical meshes are feathered (brain-atlas.js:416); the others take the MRI alone.
        const cortical = kind === 'cortex' || kind === 'non-region';
        const label = `${appearance[0]}, ${withNetworks ? 'networked' : 'plain'} ${kind}`;
        compositions.push({
          name: `anatomical surface, ${label}`,
          run: (impl) => [surface(impl, appearance[1], withNetworks, { id: 'r', kind })],
        });
        if (cortical) {
          compositions.push({
            name: `anatomical surface + feather, ${label}`,
            run: (impl) => {
              const material = surface(impl, appearance[1], withNetworks, { id: 'r', kind });
              modules(impl).addFeather(material, new DataTexture(new Float32Array(8), 2, 1));
              return [material];
            },
          });
        }
        for (const mark of HIGHLIGHTS) {
          compositions.push({
            name: `anatomical surface + MRI ${mark}, ${label}`,
            run: (impl, anatomy) => {
              const { addMri, mriUniforms } = modules(impl);
              const material = surface(impl, appearance[1], withNetworks, { id: 'r', kind });
              addMri(material, mriUniforms(anatomy), mark);
              return [material];
            },
          });
          // brain-atlas.js adds the MRI before the feather when the scan is already attached,
          // and the feather before it when the scan is attached afterwards.
          if (cortical) {
            compositions.push({
              name: `anatomical surface + MRI ${mark} + feather, ${label}`,
              run: (impl, anatomy) => {
                const { addMri, mriUniforms, addFeather } = modules(impl);
                const material = surface(impl, appearance[1], withNetworks, { id: 'r', kind });
                addMri(material, mriUniforms(anatomy), mark);
                addFeather(material, new DataTexture(new Float32Array(8), 2, 1));
                return [material];
              },
            });
          }
          if (cortical) {
            compositions.push({
              name: `anatomical surface + feather + MRI ${mark}, ${label}`,
              run: (impl, anatomy) => {
                const { addMri, mriUniforms, addFeather } = modules(impl);
                const material = surface(impl, appearance[1], withNetworks, { id: 'r', kind });
                addFeather(material, new DataTexture(new Float32Array(8), 2, 1));
                addMri(material, mriUniforms(anatomy), mark);
                return [material];
              },
            });
          }
        }
      }
    }
  }

  for (const mark of HIGHLIGHTS) {
    compositions.push({
      name: `plain material + MRI ${mark} (structures, white-matter surfaces)`,
      run: (impl, anatomy) => {
        const { addMri, mriUniforms } = modules(impl);
        const material = new MeshPhysicalMaterial({ color: '#abcdef' });
        addMri(material, mriUniforms(anatomy), mark);
        return [material];
      },
    });
    compositions.push({
      name: `cut material + MRI ${mark}`,
      run: (impl, anatomy) => {
        const { addMri, mriUniforms, cut } = modules(impl);
        const uniforms = {
          labelVolume: { value: null },
          labelPalette: { value: null },
          worldToVoxel: { value: new Matrix4() },
          volumeShape: { value: new Vector3(2, 2, 2) },
          highlightCodes: { value: new Vector2(-1, -1) },
          highlightLifts: { value: new Vector2() },
        };
        const material = cut(uniforms, manifest.appearance.tissue);
        addMri(material, mriUniforms(anatomy), mark);
        return [material];
      },
    });
  }
  compositions.push({
    name: 'cut material',
    run: (impl) => [
      modules(impl).cut(
        { labelVolume: { value: 7 }, t1Range: { value: [1, 2] } },
        manifest.appearance.tissue,
      ),
    ],
  });

  for (const withWhiteMatter of [false, true]) {
    for (const mark of HIGHLIGHTS) {
      const label = `${withWhiteMatter ? 'with' : 'without'} white matter, MRI ${mark}`;
      const build = (impl: 'legacy' | 'new', anatomy: ReturnType<typeof anatomyFixture>) => {
        const { solid: createSolid, whiteMatter: createWhiteMatter } = modules(impl);
        const wm = withWhiteMatter
          ? createWhiteMatter(
              whiteMatterRecord,
              new LegacyVolume(whiteMatterRecord, whiteMatterCodes()) as never,
            )
          : null;
        return { material: createSolid(anatomy, manifest.appearance, wm), wm };
      };
      compositions.push({
        name: `solid material, ${label}`,
        run: (impl, anatomy) => {
          const { addMri, mriUniforms } = modules(impl);
          const { material } = build(impl, anatomy);
          if (mark !== '0.0') addMri(material, mriUniforms(anatomy), mark);
          return [material];
        },
      });
      compositions.push({
        name: `solid material + cap labels, ${label}`,
        run: (impl, anatomy) => {
          const { addMri, mriUniforms, addCap, capLabels } = modules(impl);
          const { material } = build(impl, anatomy);
          addCap(material, capLabels());
          addMri(material, mriUniforms(anatomy), mark);
          return [material];
        },
      });
    }
  }

  for (const phone of [false, true]) {
    for (const { name, run } of compositions) {
      it(`${name}${phone ? ' on a phone' : ''}`, () => {
        stubMatchMedia(phone);
        // One scan for both sides, so texture identities do not differ.
        const anatomy = anatomyFixture();
        const legacy = run('legacy', anatomy);
        const current = run('new', anatomy);
        assert.equal(current.length, legacy.length);
        legacy.forEach((material, index) => {
          const next = current[index]!;
          assert.deepStrictEqual(
            describeMaterial(next as MeshPhysicalMaterial),
            describeMaterial(material as MeshPhysicalMaterial),
          );
          assert.deepStrictEqual(compile(next), compile(material));
        });
      });
    }
  }

  it('createAnatomicalMaterial fails on a missing shading attribute, as legacy does', () => {
    for (const impl of ['legacy', 'new'] as const) {
      const mesh = corticalMesh(false);
      mesh.geometry.deleteAttribute('_t1');
      assert.throws(
        () =>
          modules(impl).anatomical(
            mesh as never,
            { id: 'r', kind: 'cortex' } as never,
            manifest.appearance as never,
          ),
        /Missing source shading attribute _t1: r/,
      );
    }
  });
});

describe('white matter', () => {
  it('shares the GLSL chunks and behaves alike through update and highlight', () => {
    assert.equal(whiteMatter.WHITE_MATTER_UNIFORMS, legacyWhiteMatter.WHITE_MATTER_UNIFORMS);
    assert.equal(whiteMatter.WHITE_MATTER_LIFT, legacyWhiteMatter.WHITE_MATTER_LIFT);

    const record = {
      shape: [3, 2, 2],
      order: 'F',
      voxel_to_surface_ras_mm: [
        [-1, 0, 0, 10],
        [0, 0, 1, 0],
        [0, -1, 0, 0],
        [0, 0, 0, 1],
      ],
      applies_to: ['destrieux', 'hcp-mmp'],
      labels: [
        { source_label_id: 0, region_id: null },
        { source_label_id: 3024, region_id: 'wmparc:left:3024' },
        { source_label_id: 4035, region_id: 'wmparc:right:4035' },
      ],
    };
    const codes = new Uint8Array(12);
    codes[2] = 1;
    codes[9] = 2;
    const volume = new LegacyVolume(record, codes);
    const before = legacyWhiteMatter.createWhiteMatter(record, volume);
    const after = whiteMatter.createWhiteMatter(record, volume as never);
    const same = () => assert.deepStrictEqual(plain(after.uniforms), plain(before.uniforms));
    same();

    const random = prng(2);
    const regionIds = ['wmparc:left:3024', 'wmparc:right:4035', 'nope', null, undefined];
    for (let step = 0; step < 200; step++) {
      const pick = () => regionIds[Math.floor(random() * regionIds.length)];
      const state = {
        atlas: ['destrieux', 'hcp-mmp', 'nextbrain'][Math.floor(random() * 3)]!,
        isolatedRegion: pick() ?? null,
        hiddenRegions: random() < 0.3 ? undefined : new Set([pick()].filter(Boolean) as string[]),
      };
      before.update(state);
      after.update(state);
      const marked = { hovered: pick(), selected: pick() };
      before.setHighlight(marked);
      after.setHighlight(marked as never);
      same();
      assert.equal(after.active, before.active);
      const id = pick();
      assert.equal(after.holds(id as string), before.holds(id));
      const point = new Vector3(
        random() * 0.02 - 0.005,
        random() * 0.004 - 0.002,
        random() * 0.004 - 0.002,
      );
      assert.equal(after.regionAt(point), before.regionAt(point.toArray()));
    }
    before.setHighlight();
    after.setHighlight();
    same();
    assert.throws(
      () => legacyWhiteMatter.createWhiteMatter(record, { ...volume, data: new Uint16Array(12) }),
      /uint8/,
    );
    assert.throws(
      () =>
        whiteMatter.createWhiteMatter(record, { ...volume, data: new Uint16Array(12) } as never),
      /uint8/,
    );
    before.dispose();
    after.dispose();
  });
});

describe('cap labels', () => {
  it('creates and updates the same uniforms', () => {
    assert.deepStrictEqual(plain(cap.createCapLabels()), plain(legacyCap.createCapLabels()));
    const random = prng(3);
    const layer = {
      texture: new Data3DTexture(new Uint8Array(8), 2, 2, 2),
      palette: new DataTexture(new Uint8Array(4), 4, 1, RedFormat, UnsignedByteType),
      wedged: false,
      uniforms: {
        worldToVoxel: { value: new Matrix4().makeTranslation(1, 2, 3) },
        volumeShape: { value: new Vector3(2, 2, 2) },
        highlightCodes: { value: new Vector2(1, 2) },
        highlightLifts: { value: new Vector2(0.26, 0.45) },
      },
    };
    const before = legacyCap.createCapLabels();
    const after = cap.createCapLabels();
    for (let step = 0; step < 50; step++) {
      layer.wedged = random() < 0.5;
      const state = {
        surfaceColor: ['mri', 'atlas', 'network'][Math.floor(random() * 3)],
        isolatedRegion: random() < 0.5 ? null : 'destrieux:left:1',
      };
      legacyCap.updateCapLabels(before, layer, state);
      cap.updateCapLabels(after, layer as never, state as never);
      assert.deepStrictEqual(plain(after), plain(before));
    }
  });
});

describe('palette', () => {
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const lookups: [string, PaletteLookup | undefined][] = [
    ['no lookup', undefined],
    ['regions only', { regions }],
    ['full lookup', { regions, networks: manifest.networks, cabNp, functional }],
  ];
  const surfaceColors = ['atlas', 'tissue', 'network', 'cab-np', 'functional', 'mri'];

  it('colours and shows every label of every published atlas alike, bit for bit', () => {
    const random = prng(1);
    let compared = 0;
    for (const [atlas, record] of Object.entries(tissueLabels.atlases)) {
      const regionIds = record.labels.map((label) => label.region_id).filter(Boolean) as string[];
      for (const surfaceColor of surfaceColors) {
        for (const hemisphere of ['both', 'left', 'right']) {
          for (const isolated of [null, regionIds[Math.floor(random() * regionIds.length)]!]) {
            for (const [, lookup] of lookups) {
              const hidden = new Set(regionIds.filter(() => random() < 0.1));
              const paint =
                random() < 0.5
                  ? null
                  : {
                      id: 'deficit:test',
                      colors: new Map(
                        regionIds
                          .filter(() => random() < 0.2)
                          .map(
                            (id) => [id, [random() * 255, random() * 255, random() * 255]] as const,
                          ),
                      ),
                    };
              const state = asDisplaySettings({
                atlas,
                surfaceColor,
                hemisphere,
                isolatedRegion: isolated,
                hiddenRegions: hidden,
                paint,
                functionalLevel: random() < 0.5 ? 'sections' : 'named',
                cortexVisible: random() < 0.8,
                cortexOpacity: random() < 0.8 ? 1 : 0,
                internalSystem: null,
                detail: 'aseg',
                internalConstituents: new Set(),
              });
              const expected = legacyPalette.createPalette(
                record.labels,
                state,
                manifest.appearance.tissue,
                lookup,
              );
              const actual = palette.createPalette(
                record.labels,
                state,
                manifest.appearance.tissue,
                lookup,
              );
              assert.equal(actual.length, expected.length);
              for (let i = 0; i < expected.length; i++) {
                assert.ok(Object.is(actual[i], expected[i]), `${atlas} ${surfaceColor} ${i}`);
              }
              record.labels.forEach((label) => {
                assert.equal(
                  palette.labelVisible(label, state, lookup),
                  legacyPalette.labelVisible(label, state, lookup),
                );
              });
              compared += 1;
            }
          }
        }
      }
    }
    assert.ok(compared > 100);
  });

  it('exposes the same colour predicates', () => {
    for (const surfaceColor of surfaceColors) {
      for (const paint of [null, { id: 'x', colors: new Map() }]) {
        const state = { surfaceColor, paint } as never;
        assert.equal(palette.usesAtlasColors(state), legacyPalette.usesAtlasColors(state));
        assert.equal(palette.usesNetworkColors(state), legacyPalette.usesNetworkColors(state));
        assert.equal(palette.usesCabNpColors(state), legacyPalette.usesCabNpColors(state));
        assert.equal(
          palette.usesFunctionalColors(state),
          legacyPalette.usesFunctionalColors(state),
        );
        assert.equal(palette.usesPaint(state), legacyPalette.usesPaint(state));
      }
    }
  });

  it('tissueColor agrees over every manifest region and 200 seeded names', () => {
    const tissue = manifest.appearance.tissue;
    for (const region of manifest.regions) {
      assert.equal(
        materials.tissueColor(region, tissue),
        legacyMaterials.tissueColor(region, tissue),
      );
    }
    const random = prng(4);
    const words = [
      'Left',
      'Right',
      'Lateral',
      'Ventricle',
      'vent',
      'CSF',
      'White',
      'CC_Body',
      'callosum',
      'paraventricular',
      'nucleus',
      'Inf-Lat-Vent',
      'ctx',
      'thalamus',
      '3rd-Ventricle',
      'x',
      '',
      '_',
    ];
    for (let i = 0; i < 200; i++) {
      const name = Array.from(
        { length: 1 + Math.floor(random() * 3) },
        () => words[Math.floor(random() * words.length)],
      ).join(['-', '_', ' ', ''][Math.floor(random() * 4)]!);
      for (const kind of ['structure', 'tissue', 'tissue-region', 'cortex', 'non-region']) {
        for (const tissueName of [undefined, 'white', 'fluid', 'bogus']) {
          const region = { source_name: name, kind, tissue: tissueName };
          assert.equal(
            materials.tissueColor(region, tissue),
            legacyMaterials.tissueColor(region, tissue),
            JSON.stringify(region),
          );
        }
      }
    }
  });
});

describe('network colours', () => {
  const same = (indices: ArrayLike<number>) => {
    const actual = networkColors.networkColors(indices, manifest.networks);
    const expected = legacyNetworks.networkColors(indices, manifest.networks);
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < expected.length; i++) assert.ok(Object.is(actual[i], expected[i]), `${i}`);
  };

  it('agrees on the edge cases and on 10 000 seeded indices', () => {
    assert.equal(networkColors.NETWORK_COLOR_ITEM_SIZE, legacyNetworks.NETWORK_COLOR_ITEM_SIZE);
    same(new Float32Array([1, 2, 3, 4, 5, 6, 7, 0, 99, NaN, 0.4, 0.5, 1.5, 6.5, 7.49, 7.5, -1]));
    const random = prng(5);
    same(Float32Array.from({ length: 10_000 }, () => Math.floor(random() * 10)));
    same(Float32Array.from({ length: 1000 }, () => random() * 9));
  });

  it('attaches the same attribute, or none', () => {
    const random = prng(6);
    const build = () => {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        '_network',
        new BufferAttribute(
          Float32Array.from({ length: 50 }, () => Math.floor(random() * 9)),
          1,
        ),
      );
      return geometry;
    };
    const first = build();
    const second = first.clone();
    assert.equal(
      networkColors.attachNetworkColors(first, manifest.networks),
      legacyNetworks.attachNetworkColors(second, manifest.networks),
    );
    assert.deepStrictEqual(
      Array.from(first.getAttribute('_networkColor').array),
      Array.from(second.getAttribute('_networkColor').array),
    );
    const empty = new BufferGeometry();
    assert.equal(networkColors.attachNetworkColors(empty, manifest.networks), false);
    assert.equal(
      legacyNetworks.attachNetworkColors(new BufferGeometry(), manifest.networks),
      false,
    );
  });
});

describe('border feathering', () => {
  const sameFeather = (current: Mesh[], legacy: Mesh[]) => {
    current.forEach((mesh, slot) => {
      const actual = mesh.geometry.getAttribute('_feather') as BufferAttribute;
      const expected = legacy[slot]!.geometry.getAttribute('_feather') as BufferAttribute;
      assert.equal(actual.itemSize, expected.itemSize);
      assert.equal(actual.array.length, expected.array.length);
      for (let i = 0; i < expected.array.length; i++) {
        assert.ok(Object.is(actual.array[i], expected.array[i]), `slot ${slot} element ${i}`);
      }
    });
  };

  function strip(xs: number[]) {
    const positions = xs.flatMap((x) => [x, 0, 0, x, 1, 0]).map((value) => value / 1000);
    const index: number[] = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    return new Mesh(geometry, new MeshStandardMaterial());
  }

  function fan() {
    return [
      [0, 1],
      [1, 2],
      [2, 0],
    ].map(([a, b]) => {
      const angle = (k: number) => (k * 2 * Math.PI) / 3;
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
          [
            0,
            0,
            0,
            Math.cos(angle(a!)) / 1000,
            Math.sin(angle(a!)) / 1000,
            0,
            Math.cos(angle(b!)) / 1000,
            Math.sin(angle(b!)) / 1000,
            0,
          ],
          3,
        ),
      );
      geometry.setIndex([0, 1, 2]);
      return new Mesh(geometry, new MeshStandardMaterial());
    });
  }

  /** Two jittered grids that share one border column, whose positions are bit-equal. */
  function grids(seed: number) {
    const random = prng(seed);
    const columns = 6;
    const rows = 7;
    const border = Array.from({ length: rows }, (_, y) => [
      columns + random() * 0.3,
      y + random() * 0.4,
      random() * 0.3,
    ]);
    const build = (borderColumn: number, direction: 1 | -1) => {
      const positions: number[] = [];
      for (let column = 0; column <= columns; column++) {
        for (let y = 0; y < rows; y++) {
          const point =
            column === borderColumn
              ? border[y]!
              : [
                  columns + direction * (column - borderColumn) + random() * 0.3,
                  y + random() * 0.4,
                  random() * 0.3,
                ];
          positions.push(...point.map((value) => value / 1000));
        }
      }
      const index: number[] = [];
      for (let column = 0; column < columns; column++) {
        for (let y = 0; y + 1 < rows; y++) {
          const a = column * rows + y;
          const b = (column + 1) * rows + y;
          index.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(Float32Array.from(positions), 3),
      );
      geometry.setIndex(index);
      return new Mesh(geometry, new MeshStandardMaterial());
    };
    return [build(columns, -1), build(0, 1)];
  }

  it('shares its constants', () => {
    assert.equal(feather.FEATHER_RADIUS, legacyFeather.FEATHER_RADIUS);
    assert.equal(feather.FEATHER_ITEM_SIZE, legacyFeather.FEATHER_ITEM_SIZE);
  });

  it('agrees on strips, a fan, seeded grid pairs and every radius', () => {
    const cases: [string, () => Mesh[]][] = [
      ['strips', () => [strip([-3, -2, -1, 0]), strip([0, 1, 2, 3])]],
      ['apart', () => [strip([0, 1]), strip([5, 6])]],
      ['fan', fan],
      ...[11, 12, 13].map((seed): [string, () => Mesh[]] => [`grids ${seed}`, () => grids(seed)]),
    ];
    for (const [name, build] of cases) {
      for (const radius of [undefined, 0.0005, 0.0015, 0.01]) {
        const legacy = build();
        const current = build();
        legacyFeather.featherBorders(legacy, radius);
        feather.featherBorders(current, radius);
        sameFeather(current, legacy);
        // A border is only tested if something was feathered.
        if (radius === 0.0015 && name !== 'apart') {
          assert.ok(
            legacy.some((mesh) =>
              (mesh.geometry.getAttribute('_feather') as BufferAttribute).array.some(
                (value) => value !== 0,
              ),
            ),
            name,
          );
        }
      }
    }
  });

  it('agrees on the throws', () => {
    for (const radius of [0, -1, NaN]) {
      assert.throws(() => legacyFeather.featherBorders([strip([0, 1])], radius), RangeError);
      assert.throws(() => feather.featherBorders([strip([0, 1])], radius), RangeError);
    }
    const unindexed = () => {
      const mesh = strip([0, 1]);
      mesh.name = 'unindexed';
      mesh.geometry.setIndex(null);
      return mesh;
    };
    assert.throws(
      () => legacyFeather.featherBorders([unindexed()]),
      /Feathering needs indexed geometry: unindexed/,
    );
    assert.throws(
      () => feather.featherBorders([unindexed()]),
      /Feathering needs indexed geometry: unindexed/,
    );
  });

  it('agrees on the published cortex meshes', async () => {
    for (const file of ['cortex-destrieux.glb', 'cortex-hcp-mmp.glb']) {
      const bytes = readFileSync(new URL(file, models));
      const load = async () => {
        const { scene } = await new GLTFLoader().parseAsync(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
          '',
        );
        const meshes: Mesh[] = [];
        scene.traverse((object: Object3D) => {
          if (object instanceof Mesh && ['cortex', 'non-region'].includes(object.userData.kind)) {
            meshes.push(object);
          }
        });
        return meshes;
      };
      const legacy = await load();
      const current = await load();
      assert.ok(legacy.length > 1, file);
      legacyFeather.featherBorders(legacy);
      feather.featherBorders(current);
      sameFeather(current, legacy);
    }
  });

  it('writes the same palette texture over seeded colours and visibility', () => {
    const random = prng(7);
    const meshes = Array.from({ length: 9 }, () => {
      const mesh = strip([0, 1]);
      mesh.material.color.setRGB(random(), random(), random());
      mesh.visible = random() < 0.6;
      return mesh;
    });
    const before = legacyFeather.createFeatherPalette(meshes.length);
    const after = feather.createFeatherPalette(meshes.length);
    legacyFeather.writeFeatherPalette(before, meshes);
    feather.writeFeatherPalette(after, meshes);
    assert.deepStrictEqual(plain(after), plain(before));
  });
});

describe('MRI uniforms', () => {
  const anatomy = anatomyFixture();

  it('start alike and take the same window', () => {
    const before = legacyMri.createMriUniforms(anatomy);
    const after = mri.createMriUniforms(anatomy);
    assert.deepStrictEqual(plain(after), plain(before));
    for (const [center, width] of [
      [110, 200],
      [0, 1e-9],
      [-5.5, 1e6],
      [NaN, 180],
      [90, 0],
      [90, -1],
      [90, Infinity],
      [Infinity, 5],
    ] as const) {
      let legacyError: unknown;
      let currentError: unknown;
      try {
        legacyMri.setMriWindow(before, center, width);
      } catch (error) {
        legacyError = error;
      }
      try {
        mri.setMriWindow(after, center, width);
      } catch (error) {
        currentError = error;
      }
      assert.equal(
        (currentError as Error | undefined)?.constructor,
        (legacyError as Error | undefined)?.constructor,
      );
      assert.equal(
        (currentError as Error | undefined)?.message,
        (legacyError as Error | undefined)?.message,
      );
      assert.deepStrictEqual(plain(after), plain(before));
    }
  });

  it('take the same highlight, and refuse the same ones', () => {
    const before = legacyMri.createMriUniforms(anatomy);
    const after = mri.createMriUniforms(anatomy);
    for (const color of [
      '#4fb6e0',
      ' red ',
      'rgb(10, 200, 30)',
      'hsl(200 50% 50%)',
      '#fff',
      '',
      '   ',
      null,
      42,
      undefined,
      'notacolour',
    ]) {
      let legacyError: unknown;
      let currentError: unknown;
      try {
        legacyMri.setMriHighlight(before, color as never);
      } catch (error) {
        legacyError = error;
      }
      try {
        mri.setMriHighlight(after, color as never);
      } catch (error) {
        currentError = error;
      }
      assert.equal(
        (currentError as Error | undefined)?.constructor,
        (legacyError as Error | undefined)?.constructor,
      );
      assert.equal(
        (currentError as Error | undefined)?.message,
        (legacyError as Error | undefined)?.message,
      );
      assert.deepStrictEqual(plain(after), plain(before));
    }
  });
});

describe('highlight and label sampling', () => {
  it('shares the lift table, the GLSL and the lookups', () => {
    assert.deepStrictEqual(highlight.HIGHLIGHT_LIFT, legacyHighlight.HIGHLIGHT_LIFT);
    assert.equal(highlight.HIGHLIGHT_CHUNK, legacyHighlight.HIGHLIGHT_CHUNK);
    assert.equal(labelSampling.LABEL_AT, legacyLabelSampling.LABEL_AT);
    const ids = ['a', 'b', 'c', '', null, undefined];
    const states: { hovered?: string | null; selected?: string | null }[] = [{}];
    for (const hovered of ids) for (const selected of ids) states.push({ hovered, selected });
    for (const id of ids) {
      for (const state of states) {
        assert.ok(Object.is(highlight.liftFor(id, state), legacyHighlight.liftFor(id, state)));
      }
      assert.ok(Object.is(highlight.liftFor(id), legacyHighlight.liftFor(id)));
    }
  });

  it('indexes every published atlas the same way', () => {
    for (const record of Object.values(tissueLabels.atlases)) {
      assert.deepStrictEqual(
        highlight.codeIndex(record.labels),
        legacyHighlight.codeIndex(record.labels),
      );
    }
    const repeated = [
      { region_id: 'x' },
      { region_id: null },
      { region_id: 'x' },
      { region_id: '' },
    ];
    assert.deepStrictEqual(highlight.codeIndex(repeated), legacyHighlight.codeIndex(repeated));
  });
});
