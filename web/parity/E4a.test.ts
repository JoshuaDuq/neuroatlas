import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { Group, Plane } from 'three';
import { BrainSections as LegacySections } from '../../viewer/slices/sections.js';
import { renderSlice as legacyRenderSlice } from '../../viewer/slices/sampling.js';
import { Volume as LegacyVolume } from '../../viewer/slices/volume.js';
import { centeredFrame, createFrame } from '../src/lib/engine/slices/coordinates.ts';
import { BrainSections } from '../src/lib/engine/slices/sections.ts';
import type { SectionsModel } from '../src/lib/engine/slices/sections.ts';
import { renderSlice } from '../src/lib/engine/slices/sampling.ts';
import { Volume } from '../src/lib/engine/slices/volume.ts';
import type { TissueSections } from '../src/lib/engine/tissues/gpu-sections.ts';

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
