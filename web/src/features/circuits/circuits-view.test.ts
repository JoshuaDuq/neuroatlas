import { describe, expect, test } from 'vitest';
import type { Circuit } from '../../lib/core/learning/catalog.ts';
import { landmarkTotal, relatedLandmarks } from './circuits-view.ts';

/** A circuit with these landmark regions; the panel reads nothing else of it here. */
const circuit = (id: string, ...regions: string[]) =>
  ({ id, steps: regions.map((region) => ({ region })) }) as unknown as Circuit;

const circuits = [
  circuit('vision', 'chiasm', 'thalamus', 'cortex'),
  circuit('memory', 'hippocampus', 'thalamus'),
  circuit('hearing', 'cochlear-nucleus'),
];

describe('landmarkTotal', () => {
  test('is the sum of every circuit’s steps, not the number of circuits', () => {
    expect(landmarkTotal(circuits)).toBe(6);
    expect(landmarkTotal([])).toBe(0);
  });
});

describe('relatedLandmarks', () => {
  test('finds every step of every circuit on one of the regions, in catalogue order', () => {
    const found = relatedLandmarks(circuits, new Set(['thalamus']));
    expect(found.map(({ circuit: { id }, index }) => [id, index])).toEqual([
      ['vision', 1],
      ['memory', 1],
    ]);
  });

  test('a region and what holds it or is part of it each match their own step', () => {
    const found = relatedLandmarks(circuits, new Set(['hippocampus', 'chiasm', 'unrelated']));
    expect(found.map(({ circuit: { id }, index }) => [id, index])).toEqual([
      ['vision', 0],
      ['memory', 0],
    ]);
  });

  test('a region in no circuit has none', () => {
    expect(relatedLandmarks(circuits, new Set(['cerebellum']))).toEqual([]);
    expect(relatedLandmarks(circuits, new Set())).toEqual([]);
  });
});
