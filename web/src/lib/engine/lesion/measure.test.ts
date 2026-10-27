import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Volume } from '../slices/volume.ts';
import {
  labelTotals,
  regionSizes,
  regionsInSphere,
  streamlinesCrossing,
  tissueClass,
  tissueInSphere,
  voxelsInSphere,
} from './measure.ts';

/** Every voxel stores its own linear index, so a count names exactly which voxels were taken. */
function indexed(shape: [number, number, number], affine: number[][]): Volume {
  const data = new Uint16Array(shape[0] * shape[1] * shape[2]);
  for (let i = 0; i < data.length; i++) data[i] = i;
  return new Volume({ shape, order: 'F', voxel_to_surface_ras_mm: affine }, data);
}

const identity = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
const at = (x: number, y: number, z: number, n = 5) => x + n * (y + n * z);

test('takes the voxels whose centres lie within the radius, the boundary included', () => {
  const counts = voxelsInSphere(indexed([5, 5, 5], identity), { centre: [2, 2, 2], radius: 1 });
  const taken = [...counts.keys()].sort((a, b) => a - b);
  const expected = [
    at(2, 2, 2),
    at(1, 2, 2),
    at(3, 2, 2),
    at(2, 1, 2),
    at(2, 3, 2),
    at(2, 2, 1),
    at(2, 2, 3),
  ].sort((a, b) => a - b);
  assert.deepEqual(taken, expected);
  assert.ok([...counts.values()].every((count) => count === 1));
});

test('measures in RAS millimetres through a flipped, scaled and shifted affine', () => {
  // 2 mm voxels, x mirrored, y and z swapped as FreeSurfer's conformed grid does.
  const affine = [
    [-2, 0, 0, 10],
    [0, 0, 2, -4],
    [0, -2, 0, 6],
    [0, 0, 0, 1],
  ];
  const volume = indexed([5, 5, 5], affine);
  // Voxel (1, 2, 3) sits at RAS (8, 2, 2). Its six face neighbours are 2 mm away, the diagonals 2.83.
  const counts = voxelsInSphere(volume, { centre: [8, 2, 2], radius: 2.5 });
  const taken = [...counts.keys()].sort((a, b) => a - b);
  const expected = [
    at(1, 2, 3),
    at(0, 2, 3),
    at(2, 2, 3),
    at(1, 1, 3),
    at(1, 3, 3),
    at(1, 2, 2),
    at(1, 2, 4),
  ].sort((a, b) => a - b);
  assert.deepEqual(taken, expected);
});

test('a sphere reaching past the grid counts only the voxels inside it', () => {
  const counts = voxelsInSphere(indexed([5, 5, 5], identity), { centre: [0, 0, 0], radius: 1 });
  assert.deepEqual(
    [...counts.keys()].sort((a, b) => a - b),
    [at(0, 0, 0), at(1, 0, 0), at(0, 1, 0), at(0, 0, 1)].sort((a, b) => a - b),
  );
  assert.equal(
    voxelsInSphere(indexed([5, 5, 5], identity), { centre: [40, 0, 0], radius: 3 }).size,
    0,
  );
});

test('rejects a radius that is not a positive finite number', () => {
  const volume = indexed([5, 5, 5], identity);
  for (const radius of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => voxelsInSphere(volume, { centre: [2, 2, 2], radius }), RangeError);
  }
});

test('totals count every voxel of each stored value', () => {
  const data = new Uint8Array([0, 1, 1, 2, 2, 2, 0, 0]);
  const volume = new Volume(
    { shape: [2, 2, 2], order: 'F', voxel_to_surface_ras_mm: identity },
    data,
  );
  assert.deepEqual(
    [...labelTotals(volume)].sort(([a], [b]) => a - b),
    [
      [0, 3],
      [1, 2],
      [2, 3],
    ],
  );
});

test('classes FreeSurfer labels as cortex, white matter, fluid, deep grey or outside the brain', () => {
  const label = (name: string, kind = 'tissue', region_id: string | null = null) => ({
    name,
    kind,
    region_id,
  });
  assert.equal(tissueClass(label('ctx_lh_G_precentral', 'cortex', 'destrieux:left:29')), 'cortex');
  assert.equal(tissueClass(label('L_V1_ROI', 'cortex', 'hcp-mmp:left:1')), 'cortex');
  for (const name of [
    'Left-Cerebral-White-Matter',
    'Right-Cerebellum-White-Matter',
    'WM-hypointensities',
    'CC_Central',
  ]) {
    assert.equal(tissueClass(label(name)), 'white', name);
  }
  for (const name of ['Left-Lateral-Ventricle', 'Right-Inf-Lat-Vent', '3rd-Ventricle', 'CSF']) {
    assert.equal(tissueClass(label(name)), 'fluid', name);
  }
  for (const name of ['Left-Thalamus-Proper', 'Brain-Stem', 'Right-Cerebellum-Cortex']) {
    assert.equal(tissueClass(label(name, 'tissue', 'aseg:left:10')), 'deep', name);
  }
  assert.equal(tissueClass(label('Unknown')), 'outside');
  assert.throws(() => tissueClass(label('Left-Mystery')), /Left-Mystery/);
});

test('reports each labelled region inside the sphere with its whole size, in mm³', () => {
  // Two 2 mm voxels of a region at x = 0 and x = 1; the sphere takes one of them.
  const affine = [
    [2, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 2, 0],
    [0, 0, 0, 1],
  ];
  const data = new Uint16Array([1, 1, 0, 2, 0, 0, 0, 0]);
  const volume = new Volume(
    { shape: [2, 2, 2], order: 'F', voxel_to_surface_ras_mm: affine },
    data,
  );
  const labels = [
    { name: 'Unknown', kind: 'tissue', region_id: null },
    { name: 'ctx_lh_A', kind: 'cortex', region_id: 'atlas:left:1' },
    { name: 'ctx_lh_B', kind: 'cortex', region_id: 'atlas:left:2' },
  ];
  const sphere = { centre: [0, 0, 0], radius: 1 } as const;
  assert.deepEqual(
    regionsInSphere(volume, labels, sphere, labelTotals(volume)),
    new Map([['atlas:left:1', { inside: 8, whole: 16 }]]),
  );
  assert.deepEqual(tissueInSphere(volume, labels, sphere), {
    cortex: 8,
    white: 0,
    deep: 0,
    fluid: 0,
    outside: 0,
  });
});

test('counts a streamline once when any of its points lies within the radius', () => {
  // Through the sphere twice; grazing its boundary; passing 0.1 mm outside it.
  const points = new Float32Array([
    -5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0.5, 0, 9, 9, 9, 3, 4, 0, 9, 9, 9, 5.1, 0, 0, 9, 9, 9,
  ]);
  const offsets = new Uint32Array([0, 5, 7, 9]);
  assert.equal(streamlinesCrossing(points, offsets, { centre: [0, 0, 0], radius: 5 }), 2);
});

test('sizes every labelled region of a volume in mm³, reached or not', () => {
  const affine = [
    [2, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 2, 0],
    [0, 0, 0, 1],
  ];
  const volume = new Volume(
    { shape: [2, 2, 2], order: 'F', voxel_to_surface_ras_mm: affine },
    new Uint16Array([1, 1, 0, 2, 0, 0, 0, 0]),
  );
  const labels = [
    { kind: 'tissue', region_id: null },
    { kind: 'cortex', region_id: 'atlas:left:1' },
    { kind: 'cortex', region_id: 'atlas:left:2' },
  ];
  assert.deepEqual(
    regionSizes(labels, labelTotals(volume), volume),
    new Map([
      ['atlas:left:1', 16],
      ['atlas:left:2', 8],
    ]),
  );
});
