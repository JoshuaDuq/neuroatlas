import assert from 'node:assert/strict';
import { test } from 'vitest';
import { earcut } from './earcut.js';

/** mulberry32: a seeded PRNG, so every run draws the same polygons. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('TISSUE-06 60 seeded polygons, half with a hole, triangulate without losing area', () => {
  const random = mulberry32(41);
  for (let step = 0; step < 60; step++) {
    const sides = 5 + Math.floor(random() * 40);
    const ring = (radius: number) =>
      Array.from({ length: sides }, (_, at) => {
        const angle = (at / sides) * 2 * Math.PI;
        const r = radius * (0.7 + 0.3 * random());
        return [r * Math.cos(angle), r * Math.sin(angle)];
      }).flat();
    const outer = ring(1);
    const holes = random() < 0.5 ? ring(0.2).reverse() : [];
    const data = [...outer, ...holes];
    const holeIndices = holes.length ? [outer.length / 2] : null;
    const triangles = earcut(data, holeIndices, 2);
    assert.ok(triangles.length >= 3, `polygon ${step} has a triangle`);
    assert.ok(earcut.deviation(data, holeIndices, 2, triangles) <= 1e-9, `polygon ${step}`);
  }
});
