// Where a click on a panel's picture lands in the head, in RAS millimetres, with fixed frames.
import { describe, expect, test } from 'vitest';
import type { PlaneFrame } from '../../lib/engine/api.ts';
import { pointOnPlane } from './mpr-draw.ts';

const axial: PlaneFrame = {
  center: [0, 0, 10],
  normal: [0, 0, 1],
  u: [1, 0, 0],
  v: [0, 1, 0],
  edges: ['A', 'R', 'P', 'L'],
};
const sagittal: PlaneFrame = {
  center: [-5, 0, 0],
  normal: [1, 0, 0],
  u: [0, -1, 0],
  v: [0, 0, 1],
  edges: ['S', 'P', 'I', 'A'],
};

describe('a click on the picture', () => {
  test('the middle of an axial picture is the frame centre', () => {
    expect(pointOnPlane(axial, 0.5, 0.5, 256)).toEqual([0, 0, 10]);
  });

  test("the top-left corner of an axial picture is left-anterior (screen right is the patient's right)", () => {
    expect(pointOnPlane(axial, 0, 0, 256)).toEqual([-128, 128, 10]);
    expect(pointOnPlane(axial, 1, 1, 256)).toEqual([128, -128, 10]);
  });

  test('a sagittal picture runs posterior to anterior across and inferior to superior down', () => {
    expect(pointOnPlane(sagittal, 0.75, 0.25, 200)).toEqual([-5, -50, 50]);
  });

  test('the field of view scales the reach', () => {
    expect(pointOnPlane(axial, 1, 0.5, 100)).toEqual([50, 0, 10]);
  });
});
