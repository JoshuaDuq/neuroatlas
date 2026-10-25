import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, it } from 'vitest';
import { readRepoJson, readRepoYaml, repoRoot } from '../test/repo.ts';
import { TissueSections as LegacyTissueSections } from '../../viewer/tissues/gpu-sections.js';
import {
  BANDS as LEGACY_BANDS,
  addSolidSources as legacyAddSolidSources,
} from '../../viewer/tissues/solid-assets.js';
import { BANDS, addSolidSources } from '../src/lib/engine/tissues/solid-assets.ts';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import { TissueSections } from '../src/lib/engine/tissues/gpu-sections.ts';
import type { CutModel } from '../src/lib/engine/tissues/gpu-sections.ts';
import { Group, Plane, Raycaster, Vector3 } from 'three';
import { BrainSections as LegacySections } from '../../viewer/slices/sections.js';
import { renderSlice as legacyRenderSlice } from '../../viewer/slices/sampling.js';
import { Volume as LegacyVolume } from '../../viewer/slices/volume.js';
import { centeredFrame, createFrame, rasToWorld } from '../src/lib/engine/slices/coordinates.ts';
import { BrainSections } from '../src/lib/engine/slices/sections.ts';
import type { Appearance } from '../src/lib/engine/render/materials.ts';
import type { SectionsModel } from '../src/lib/engine/slices/sections.ts';
import { renderSlice } from '../src/lib/engine/slices/sampling.ts';
import { Volume } from '../src/lib/engine/slices/volume.ts';

/** mulberry32: a seeded PRNG, so every run draws the same samples. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const affine = [
  [1, 0, 0, -8],
  [0, 1, 0, -8],
  [0, 0, 1, -8],
  [0, 0, 0, 1],
];
const metadata = { shape: [16, 16, 16], order: 'F', voxel_to_surface_ras_mm: affine };

function volumes(random: () => number) {
  const mri = new Uint8Array(4096);
  const labels = new Uint16Array(4096);
  for (let i = 0; i < 4096; i++) {
    mri[i] = Math.floor(random() * 256);
    labels[i] = Math.floor(random() * 3);
  }
  const record = {
    labels: { 1: { name: 'A', color: [255, 0, 0] }, 2: { name: 'B', color: [0, 255, 0] } },
  };
  return {
    legacy: {
      mri: new LegacyVolume(metadata, mri),
      segmentation: new LegacyVolume(metadata, labels),
      metadata: record,
    },
    current: {
      mri: new Volume(metadata, mri),
      segmentation: new Volume(metadata, labels),
      metadata: record,
    },
  };
}

describe('E4a renderSlice', () => {
  it('is byte-identical to the legacy renderer over seeded volumes, cuts and windows', () => {
    const random = prng(4401);
    const { legacy, current } = volumes(random);
    for (let trial = 0; trial < 12; trial++) {
      const crosshair: [number, number, number] = [
        random() * 12 - 6,
        random() * 12 - 6,
        random() * 12 - 6,
      ];
      const frames = [
        createFrame('sagittal', crosshair),
        createFrame('coronal', crosshair),
        createFrame('axial', crosshair),
        centeredFrame('oblique', crosshair, { tilt: random() * 80, azimuth: random() * 360 - 180 }),
      ];
      const display = {
        size: 8 + trial,
        fieldOfView: 10 + random() * 10,
        windowCenter: random() * 255,
        windowWidth: 1 + random() * 254,
        overlay: trial % 2 === 0,
      };
      for (const frame of frames) {
        assert.deepStrictEqual(
          renderSlice(current, frame, display),
          legacyRenderSlice(legacy, frame, display),
        );
      }
    }
  });

  it('rejects the same invalid displays', () => {
    const { legacy, current } = volumes(prng(1));
    const frame = createFrame('axial', [0, 0, 0]);
    const display = { size: 4, fieldOfView: 8, windowCenter: 1, windowWidth: 1, overlay: false };
    for (const bad of [{ size: 1 }, { size: 2.5 }, { fieldOfView: 0 }, { windowWidth: 0 }]) {
      assert.throws(() => renderSlice(current, frame, { ...display, ...bad }), RangeError);
      assert.throws(() => legacyRenderSlice(legacy, frame, { ...display, ...bad }), RangeError);
    }
  });
});

function stubs(cordShown: boolean) {
  const region = { id: 'aseg:left:10', kind: 'structure', source_label_id: 1 };
  const model = Object.assign(new EventTarget(), {
    clippingPlanes: [] as Plane[],
    manifest: {
      supplemental_layers: [
        {
          id: 'zanatomy',
          bounds_ras_mm: [
            [-40.2, -60, -400.5],
            [40, 60.1, 20],
          ],
        },
        {
          id: 'other',
          bounds_ras_mm: [
            [-130.5, -1, -1],
            [1, 1, 150.2],
          ],
        },
      ],
    },
    state: {
      atlas: 'destrieux',
      hemisphere: 'both',
      cortexVisible: true,
      cortexOpacity: 1,
      spinalCordVisible: cordShown,
    },
    regions: new Map([[region.id, region]]),
    setCutState() {},
    setClippingPlanes(planes: Plane[]) {
      this.clippingPlanes = planes;
    },
    intersect: () => null,
  });
  const tissues = {
    group: new Group(),
    layers: new Map([['destrieux', {}]]),
    update() {},
    dispose() {},
  };
  return { model, tissues };
}

describe('E4a BrainSections geometry', () => {
  it('reports identical coordinate bounds, limit and offset range for every mode', () => {
    const random = prng(4402);
    for (const cordShown of [false, true]) {
      const a = stubs(cordShown);
      const b = stubs(cordShown);
      const legacy = new LegacySections(a.model, 'https://example.invalid/', a.tissues as never);
      const current = new BrainSections(
        b.model as unknown as SectionsModel,
        'https://example.invalid/',
        b.tissues as unknown as TissueSections,
      );
      assert.deepStrictEqual(current.coordinateBounds, legacy.coordinateBounds);
      assert.equal(current.coordinateLimit, legacy.coordinateLimit);
      for (const mode of ['off', 'sagittal', 'coronal', 'axial', 'oblique'] as const) {
        current.state.mode = mode;
        legacy.state.mode = mode;
        for (let trial = 0; trial < 20; trial++) {
          const tilt = random() * 90;
          const azimuth = random() * 360 - 180;
          Object.assign(current.state, { tilt, azimuth });
          Object.assign(legacy.state, { tilt, azimuth });
          assert.deepStrictEqual(current.offsetRange, legacy.offsetRange);
        }
      }
      current.dispose();
      legacy.dispose();
    }
  });
});

interface PublishedVolumes {
  segmentation: { file: string; dtype: string };
  mri: { file: string; dtype: string };
  display: {
    field_of_view_mm: number;
    texture_size: number;
    window_center: number;
    window_width: number;
  };
}

const publishedAtlas = readRepoJson<{ default: string }>('public/models/anatomies.json').default;
const modelDirectory = `public/models/${publishedAtlas}`;
const volumeRecord = readRepoJson<PublishedVolumes>(`${modelDirectory}/volumes.json`);
const manifest = readRepoJson<{ regions: { id: string }[] }>(`${modelDirectory}/manifest.json`);

function decode(file: string, dtype: string): Uint8Array | Uint16Array {
  const bytes = gunzipSync(readFileSync(resolve(repoRoot, modelDirectory, file)));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return dtype === '<u2' ? new Uint16Array(buffer) : new Uint8Array(buffer);
}

/** A sections object holding the published MRI and segmentation, as `load()` leaves it. */
function loadedSections(legacy: boolean) {
  const { model, tissues } = stubs(false);
  model.regions = new Map(manifest.regions.map((region) => [region.id, region])) as never;
  const { mri, segmentation, display } = volumeRecord;
  const VolumeClass = legacy ? LegacyVolume : Volume;
  const volumes = {
    metadata: volumeRecord,
    mri: new VolumeClass(mri as never, decode(mri.file, mri.dtype) as never),
    segmentation: new VolumeClass(
      segmentation as never,
      decode(segmentation.file, segmentation.dtype) as never,
    ),
  };
  const shown = {
    fieldOfView: display.field_of_view_mm,
    size: display.texture_size,
    windowCenter: display.window_center,
    windowWidth: display.window_width,
  };
  const sections = legacy
    ? new LegacySections(model, 'https://example.invalid/', tissues as never)
    : new BrainSections(
        model as unknown as SectionsModel,
        'https://example.invalid/',
        tissues as unknown as TissueSections,
      );
  Object.assign(sections, { volumes, display: shown });
  return sections as unknown as Pick<BrainSections, 'sample' | 'pixels'>;
}

function attempt<T>(run: () => T): T | string {
  try {
    return run();
  } catch (error) {
    return (error as Error).name;
  }
}

describe('E4a sample() and pixels() on the published volumes', () => {
  const legacy = loadedSections(true);
  const current = loadedSections(false);

  it('sample() is identical at seeded points and outside the grid', () => {
    const random = prng(4403);
    const points: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 1000],
      [Number.NaN, 0, 0],
    ];
    for (let i = 0; i < 2000; i++) {
      points.push([random() * 200 - 100, random() * 260 - 130, random() * 260 - 130]);
    }
    for (const point of points) {
      const expected = attempt(() => legacy.sample(point));
      const actual = attempt(() => current.sample(point));
      if (typeof expected === 'string' || typeof actual === 'string') {
        assert.equal(actual, expected);
        continue;
      }
      assert.ok(Object.is(actual.intensity, expected.intensity));
      assert.equal(actual.region, expected.region);
      assert.deepStrictEqual(actual, expected);
    }
  });

  it('pixels() is byte-identical for an oblique frame at the published size', () => {
    const frame = centeredFrame('oblique', [3, -12, 20], { tilt: 25, azimuth: 40 });
    assert.deepStrictEqual(current.pixels(frame), legacy.pixels(frame));
  });
});

describe('E4a TissueSections', () => {
  const { appearance } = readRepoYaml<{ appearance: Appearance }>('config/model.yaml');
  const regionIds = ['destrieux:left:1', 'destrieux:right:2', 'destrieux:left:3'];
  const hemispheres = ['left', 'right', 'left'];
  const regions = regionIds.map((id, index) => ({
    id,
    kind: 'cortex',
    hemisphere: hemispheres[index],
    networks: [{ network: ['Vis', 'Default', 'Limbic'][index], fraction: 1 }],
  }));
  const labels = [
    {
      source_label_id: 0,
      region_id: null,
      kind: 'tissue',
      hemisphere: 'midline',
      color: [0, 0, 0],
    },
    ...regionIds.map((id, index) => ({
      source_label_id: 11101 + index,
      region_id: id,
      kind: 'cortex',
      hemisphere: hemispheres[index],
      color: [20 + 80 * index, 220 - 60 * index, 60 + 50 * index],
    })),
  ];
  const labelMetadata = {
    shape: [6, 6, 6],
    order: 'F',
    labels,
    voxel_to_surface_ras_mm: [
      [-1, 0, 0, 3],
      [0, 0, 1, -3],
      [0, -1, 0, 3],
      [0, 0, 0, 1],
    ],
  };
  const mriMetadata = { ...labelMetadata, labels: undefined };
  const networks = {
    colors: { Vis: [120, 20, 20], Default: [20, 120, 20], Limbic: [20, 20, 120] },
  };
  const cabNp = {
    id: 'cab-np',
    atlas: 'destrieux',
    networks: ['A', 'B'],
    colors: { A: [200, 100, 0], B: [0, 100, 200] },
    regions: { [regionIds[0]!]: 'A', [regionIds[1]!]: 'B' },
  };
  const functionalRegions = {
    regions: { named: { [regionIds[0]!]: 'f1', [regionIds[2]!]: 'f2' } },
    levels: {
      named: [
        { id: 'f1', color: [250, 250, 0] },
        { id: 'f2', color: [0, 250, 250] },
      ],
    },
  };

  function build(legacy: boolean, codes: Uint16Array) {
    const model = {
      manifest: { appearance, networks },
      cabNp,
      functionalRegions,
      sourceColors: new Map(),
      layers: new Map(),
      state: {
        atlas: 'destrieux',
        hemisphere: 'both',
        cortexVisible: true,
        cortexOpacity: 1,
        surfaceColor: 'atlas',
        functionalLevel: 'named',
        isolatedRegion: null as string | null,
        hiddenRegions: new Set<string>(),
        paint: null as unknown,
      },
      regions: new Map(regions.map((region) => [region.id, region])),
    };
    const VolumeClass = legacy ? LegacyVolume : Volume;
    const sections = legacy
      ? new LegacyTissueSections(model, new URL('https://example.invalid/'))
      : new TissueSections(model as unknown as CutModel, new URL('https://example.invalid/'));
    const internals = sections as unknown as {
      anatomy: unknown;
      createAnatomy(volume: unknown): unknown;
      createLayer(metadata: unknown, volume: unknown): unknown;
      layers: Map<string, unknown>;
    };
    internals.anatomy = internals.createAnatomy(
      new VolumeClass(mriMetadata as never, new Uint8Array(216).fill(100) as never),
    );
    const layer = internals.createLayer(
      labelMetadata,
      new VolumeClass(labelMetadata as never, codes as never),
    ) as Layer;
    internals.layers.set('destrieux', layer);
    // Two structure solids, so the cap and capVisibleAt paths run.
    const boxes = regionIds.slice(0, 2).map((id, index) => {
      const mesh = new Mesh(
        new BoxGeometry(0.01, 0.01, 0.01),
        new MeshBasicMaterial({ side: DoubleSide }),
      );
      mesh.userData = { hemisphere: hemispheres[index], region_id: id };
      return mesh;
    });
    if (legacy) {
      legacyAddSolidSources(
        (sections as LegacyTissueSections).solids,
        boxes,
        (sections as LegacyTissueSections).anatomy,
        appearance,
        LEGACY_BANDS.structure,
      );
    } else {
      addSolidSources(
        (sections as TissueSections).solids,
        boxes,
        (sections as TissueSections).anatomy!,
        appearance,
        BANDS.structure,
      );
    }
    return { sections: sections as unknown as TissueSections, model, layer };
  }

  interface Layer {
    uniforms: Record<string, { value: unknown }>;
    palette: { image: { data: Float32Array } };
    mesh: { visible: boolean; position: Vector3; quaternion: { toArray(): number[] } };
  }

  function snapshot(sections: TissueSections, layer: Layer) {
    const uniforms = Object.fromEntries(
      Object.entries(layer.uniforms)
        .filter(([, uniform]) => !(uniform.value as { isTexture?: boolean }).isTexture)
        .map(([name, { value }]) => {
          const v = value as { elements?: number[]; toArray?(): number[] };
          return [name, v.elements ?? v.toArray?.() ?? value];
        }),
    );
    return {
      uniforms,
      palette: layer.palette.image.data,
      visible: layer.mesh.visible,
      position: layer.mesh.position.toArray(),
      quaternion: layer.mesh.quaternion.toArray(),
      solids: sections.solids.group.visible,
      solidVisibility: sections.solids.solids.map((solid) => solid.group.visible),
    };
  }

  function seededCodes(random: () => number) {
    return Uint16Array.from({ length: 216 }, () => Math.floor(random() * labels.length));
  }

  const hitSummary = (hit: ReturnType<TissueSections['intersect']>) =>
    hit && {
      distance: hit.distance,
      point: hit.point.toArray(),
      region: hit.region,
      label: hit.label,
    };

  it('matches the legacy cut, caps and picking over seeded labels, frames and display states', () => {
    const random = prng(4404);
    const codes = seededCodes(random);
    const a = build(true, codes);
    const b = build(false, codes.slice());
    const modes = ['sagittal', 'coronal', 'axial', 'oblique'] as const;
    const colours = ['tissue', 'atlas', 'network', 'cab-np', 'functional', 'mri'];
    const hemispheresShown = ['both', 'left', 'right'];
    const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
    const seenLabels = new Set<unknown>();
    const seenRegions = new Set<unknown>();
    let capHits = 0;
    for (let trial = 0; trial < 300; trial++) {
      const paint =
        random() < 0.25 ? { id: 'panel', colors: new Map([[regionIds[1], [240, 0, 240]]]) } : null;
      const state = {
        surfaceColor: colours[trial % colours.length],
        hemisphere: pick(hemispheresShown),
        isolatedRegion: pick([null, null, ...regionIds]),
        hiddenRegions: new Set(random() < 0.3 ? [pick(regionIds)] : []),
        paint,
      };
      Object.assign(a.model.state, state);
      Object.assign(b.model.state, state);
      const crosshair: [number, number, number] = [
        random() * 4 - 2,
        random() * 4 - 2,
        random() * 4 - 2,
      ];
      const frame = centeredFrame(pick(modes), crosshair, {
        tilt: random() * 80,
        azimuth: random() * 360 - 180,
      });
      const reverse = random() < 0.5;
      a.sections.update(frame, 'destrieux', reverse);
      b.sections.update(frame, 'destrieux', reverse);
      assert.deepStrictEqual(snapshot(b.sections, b.layer), snapshot(a.sections, a.layer));
      for (let ray = 0; ray < 3; ray++) {
        const target = rasToWorld([
          crosshair[0] + random() * 2 - 1,
          crosshair[1] + random() * 2 - 1,
          crosshair[2] + random() * 2 - 1,
        ]);
        const origin = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5)
          .normalize()
          .multiplyScalar(0.1)
          .add(target);
        const raycaster = new Raycaster(origin, target.clone().sub(origin).normalize());
        const expected = a.sections.intersect(raycaster);
        const actual = b.sections.intersect(raycaster);
        assert.deepStrictEqual(hitSummary(actual), hitSummary(expected));
        if (expected && actual) {
          assert.equal(actual.region, expected.region);
          assert.equal(actual.label, expected.label);
          assert.equal('source' in actual, 'source' in expected);
          if ('source' in actual) capHits++;
          seenLabels.add(actual.label?.source_label_id);
          seenRegions.add(actual.region?.id);
        }
      }
    }
    assert.ok(seenLabels.size >= 2, `hits covered ${seenLabels.size} labels`);
    assert.ok(seenRegions.size >= 2, `hits covered ${seenRegions.size} regions`);
    assert.ok(capHits > 5, `only ${capHits} hits landed on a cap`);
    a.sections.dispose();
    b.sections.dispose();
  });

  it('applies highlights to the layer like the legacy class', () => {
    const codes = seededCodes(prng(4405));
    const a = build(true, codes);
    const b = build(false, codes.slice());
    for (const highlight of [
      { hovered: regionIds[0] },
      { selected: regionIds[1] },
      { hovered: regionIds[2], selected: regionIds[0] },
      {},
    ]) {
      a.sections.setHighlight(highlight);
      b.sections.setHighlight(highlight);
      assert.deepStrictEqual(snapshot(b.sections, b.layer), snapshot(a.sections, a.layer));
    }
    a.sections.dispose();
    b.sections.dispose();
  });
});
