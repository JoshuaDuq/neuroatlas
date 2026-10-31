import assert from 'node:assert/strict';
import type { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { test, vi } from 'vitest';
import { Volume } from '../slices/volume.ts';
import type { VolumeFile } from '../slices/volume.ts';
import type { TissueMetadata } from '../tissues/gpu-sections.ts';
import { createLesion } from './lesion.ts';

const identity = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
const label = (name: string, kind: string, region_id: string | null) => ({ name, kind, region_id });

/** A row of four 1 mm voxels at x = 0..3, storing `values`. */
const record = (file: string, values: number[], labels: object[]) => ({
  file,
  values,
  labels,
  shape: [4, 1, 1],
  order: 'F',
  voxel_to_surface_ras_mm: identity,
});

const metadata = {
  schema_version: 1,
  atlases: {
    destrieux: record(
      'd',
      [1, 2, 0, 1],
      [
        label('Unknown', 'tissue', null),
        label('ctx_lh_A', 'cortex', 'destrieux:left:1'),
        label('Left-Thalamus-Proper', 'tissue', 'aseg:left:10'),
      ],
    ),
    // Its own area, a Destrieux label where HCP-MMP assigns none, and the aseg again.
    'hcp-mmp': record(
      'h',
      [1, 2, 2, 3],
      [
        label('Unknown', 'tissue', null),
        label('L_V1_ROI', 'cortex', 'hcp-mmp:left:1'),
        label('ctx_lh_A', 'cortex', 'destrieux:left:1'),
        label('Left-Thalamus-Proper', 'tissue', 'aseg:left:10'),
      ],
    ),
  },
  white_matter: record(
    'w',
    [1, 1, 0, 0],
    [
      { source_label_id: 0, region_id: null },
      { source_label_id: 3001, region_id: 'wmparc:left:3001' },
    ],
  ),
} as unknown as TissueMetadata;

function lesion(tracts: Parameters<typeof createLesion>[0]['tracts'] = null) {
  const files = new Map(
    [...Object.values(metadata.atlases), metadata.white_matter!].map((entry) => [
      entry.file,
      (entry as unknown as { values: number[] }).values,
    ]),
  );
  return createLesion({
    model: {
      visibleMeshes: [],
      regions: new Map(),
      clippingPlanes: [],
      state: { cortexOpacity: 0.2 },
    },
    tissues: { loadMetadata: async () => {}, metadata },
    baseUrl: 'https://example.test/',
    tracts,
    invalidate: () => {},
    loadVolume: async (file: VolumeFile) =>
      new Volume(file, new Uint16Array(files.get(file.file)!)),
  });
}

test('reads each region from its own atlas volume, and the aseg from the tissue atlas once', async () => {
  // The sphere takes x = 0..2 of the four voxels.
  const measured = await lesion().measure({ centre: [1, 0, 0], radius: 1 });
  assert.deepEqual(
    measured.regions,
    new Map([
      ['destrieux:left:1', { inside: 1, whole: 2 }],
      ['aseg:left:10', { inside: 1, whole: 1 }],
      ['hcp-mmp:left:1', { inside: 1, whole: 1 }],
      ['wmparc:left:3001', { inside: 2, whole: 2 }],
    ]),
  );
  assert.deepEqual(
    measured.sizes,
    new Map([
      ['destrieux:left:1', 2],
      ['aseg:left:10', 1],
      ['hcp-mmp:left:1', 1],
      ['wmparc:left:3001', 2],
    ]),
  );
  assert.deepEqual(measured.tissue, { cortex: 1, white: 0, deep: 1, fluid: 0, outside: 1 });
  assert.equal(measured.volume, 3);
});

test('names the tissue at the centre, and the tissue class of each region it reaches', async () => {
  const measured = await lesion().measure({ centre: [1, 0, 0], radius: 1 });
  assert.deepEqual(measured.centre, { tissue: 'deep', region: 'aseg:left:10' });
  assert.deepEqual(
    measured.tissueOf,
    new Map([
      ['destrieux:left:1', 'cortex'],
      ['aseg:left:10', 'deep'],
    ]),
  );
  const atCortex = await lesion().measure({ centre: [3, 0, 0], radius: 0.5 });
  assert.deepEqual(atCortex.centre, { tissue: 'cortex', region: 'destrieux:left:1' });
  assert.deepEqual(atCortex.tissueOf, new Map([['destrieux:left:1', 'cortex']]));
});

test('refuses a radius that is not positive before drawing or measuring', async () => {
  const domain = lesion();
  assert.throws(() => domain.show({ centre: [0, 0, 0], radius: 0 }), RangeError);
  await assert.rejects(domain.measure({ centre: [0, 0, 0], radius: -2 }), RangeError);
});

test('has no tracts to count on an anatomy whose tracts are another subject’s', async () => {
  const domain = lesion();
  const sphere = { centre: [1, 0, 0], radius: 1 } as const;
  assert.deepEqual(domain.tractBundles(sphere), []);
  assert.deepEqual(await domain.measureTracts(sphere), []);
});

test('its footprint lets the streamlines show through while they are drawn, then is opaque again', async () => {
  const tracts = {
    bundles: [{ id: 'af-left' }],
    crossing: async () => [],
    showCrossing: vi.fn(async () => {}),
    clearCrossing: vi.fn(),
  };
  const domain = lesion(tracts);
  const sphere = { centre: [1, 0, 0], radius: 1 } as const;
  domain.show(sphere);
  const paint = () =>
    (domain.group.children[0] as Mesh<BufferGeometry, MeshStandardMaterial>).material;
  assert.equal(paint().opacity, 1);
  await domain.showTract('af-left', sphere);
  assert.deepEqual(tracts.showCrossing.mock.calls, [['af-left', sphere]]);
  assert.deepEqual([paint().opacity, paint().transparent, paint().depthWrite], [0.2, true, false]);
  domain.clearTract();
  assert.equal(tracts.clearCrossing.mock.calls.length, 1);
  assert.deepEqual([paint().opacity, paint().transparent, paint().depthWrite], [1, false, true]);
});
