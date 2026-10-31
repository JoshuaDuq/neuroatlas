import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createFrame, pointOnFrame } from './coordinates.ts';
import { renderSlice } from './sampling.ts';
import { Volume } from './volume.ts';

const affine = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
const metadata = { shape: [4, 4, 4], order: 'F', voxel_to_surface_ras_mm: affine };
const data = new Uint8Array(64);
for (let z = 0; z < 4; z++)
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) data[x + 4 * (y + 4 * z)] = x + 10 * y + 40 * z;
const volumes = {
  mri: new Volume(metadata, data),
  segmentation: new Volume(metadata, new Uint16Array(64).fill(1)),
  metadata: { labels: { 1: { name: 'Test', color: [255, 0, 0] } } },
};
const display = { fieldOfView: 4, size: 4, windowCenter: 127.5, windowWidth: 255, overlay: false };

test('pixel centers, canvas top, and patient left/right agree in axial slices', () => {
  const frame = createFrame('axial', [1.5, 1.5, 1]);
  const pixels = renderSlice(volumes, frame, display);
  assert.deepEqual(Array.from(pixels.slice(0, 4)), [70, 70, 70, 255]);
  assert.deepEqual(Array.from(pixels.slice(-4)), [43, 43, 43, 255]);
  assert.deepEqual(pointOnFrame(frame, 0.125, 0.125, 4), [0, 3, 1]);
});

test('overlay preserves discrete source labels; background is transparent', () => {
  const frame = createFrame('axial', [1.5, 1.5, 1]);
  const pixels = renderSlice(volumes, frame, { ...display, overlay: true });
  assert.ok(pixels[0] > pixels[1]);
  const outside = renderSlice(volumes, createFrame('axial', [1.5, 1.5, 9]), display);
  assert.equal(outside[3], 0);
});

// Axial plane z = 1 at (1.5, 1.5): MRI 70 at the first pixel and 43 at the last (see above).
const frame = createFrame('axial', [1.5, 1.5, 1]);

test('SLICE-12 the grey level is the MRI value mapped through the window and clamped to 0..255', () => {
  // (70 - 90 + 10) * 255 / 20 < 0 and (70 - 40 + 10) * 255 / 20 > 255: both ends clamp.
  const dark = renderSlice(volumes, frame, { ...display, windowCenter: 90, windowWidth: 20 });
  assert.deepEqual(Array.from(dark.slice(0, 3)), [0, 0, 0]);
  const bright = renderSlice(volumes, frame, { ...display, windowCenter: 40, windowWidth: 20 });
  assert.deepEqual(Array.from(bright.slice(0, 3)), [255, 255, 255]);
  // Inside the window: (70 - 60 + 50) * 255 / 100 = 153.
  const inside = renderSlice(volumes, frame, { ...display, windowCenter: 60, windowWidth: 100 });
  assert.deepEqual(Array.from(inside.slice(0, 3)), [153, 153, 153]);
});

test('SLICE-13 a labelled pixel blends 0.55 of the grey with 0.45 of the label colour', () => {
  // Grey 70 under red: 0.55 * 70 + 0.45 * 255 = 153.25 and 0.55 * 70 = 38.5 (ties to even).
  const pixels = renderSlice(volumes, frame, { ...display, overlay: true });
  assert.deepEqual(Array.from(pixels.slice(0, 4)), [153, 38, 38, 255]);
  const plain = renderSlice(volumes, frame, display);
  assert.deepEqual(Array.from(plain.slice(0, 4)), [70, 70, 70, 255]);
});

test('shown agreement inks each voxel of the structure by which segmentation labels it, over the overlay', () => {
  // The structure is aseg label 1 and compared code 3; NextBrain has it where x < 2, and also at
  // x = 3, y = 3, where aseg labels nothing.
  const segmentation = new Uint16Array(64).fill(1);
  const compared = new Uint8Array(64);
  for (let z = 0; z < 4; z++)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        if (x < 2) compared[x + 4 * (y + 4 * z)] = 3;
        if (x === 3 && y === 3) {
          compared[x + 4 * (y + 4 * z)] = 3;
          segmentation[x + 4 * (y + 4 * z)] = 0;
        }
      }
  const shown = {
    ...volumes,
    segmentation: new Volume(metadata, segmentation),
    agreement: { structure: { code: 3, aseg_label: 1 }, compared: new Volume(metadata, compared) },
  };
  const pixels = renderSlice(shown, frame, { ...display, overlay: true });
  const at = (x: number, y: number) =>
    Array.from(pixels.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
  // Row 0 is y = 3, row 3 is y = 0. Grey 70 at (0, 3): 0.55 * 70 + 0.45 * 236 = 144.7.
  assert.deepEqual(at(0, 0), [145, 145, 145, 255]);
  // Grey 43 at (3, 0), aseg only: 0.55 * 43 + 0.45 * [235, 70, 210].
  assert.deepEqual(at(3, 3), [129, 55, 118, 255]);
  // (3, 3) is NextBrain's alone, and drawn although aseg has no label there.
  const [, , blue, alpha] = at(3, 0);
  assert.equal(alpha, 255);
  assert.ok(blue < at(3, 0)[0]!);
});

test('SLICE-14 a size outside 2..2048 or non-integer, a flat field of view or window is a RangeError', () => {
  for (const bad of [
    { size: 1 },
    { size: 2.5 },
    { size: 2049 },
    { fieldOfView: 0 },
    { fieldOfView: Number.NaN },
    { windowCenter: Number.NaN },
    { windowWidth: 0 },
  ]) {
    assert.throws(() => renderSlice(volumes, frame, { ...display, ...bad }), RangeError);
  }
  renderSlice(volumes, frame, { ...display, size: 2 });
});
