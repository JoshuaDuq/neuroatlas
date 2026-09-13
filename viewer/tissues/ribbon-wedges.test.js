import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRibbonWedges } from './ribbon-wedges.js';

/** Two triangles spanning a unit square, extruded one unit towards white. */
function square(...labels) {
  return {
    faces: new Uint32Array([0, 1, 2, 0, 2, 3]),
    pial: new Float32Array([0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
    white: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    labels: new Uint16Array(labels),
  };
}

/** A hole is an edge only one triangle carries; the stencil leaks through it. */
function openEdges(geometry) {
  const index = geometry.getIndex().array;
  const counts = new Map();
  for (let i = 0; i < index.length; i += 3) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const key = [index[i + a], index[i + b]].sort((x, y) => x - y).join(':');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.values()].filter(count => count !== 2).length;
}

/** Every directed edge appears exactly once, which is what the stencil counts. */
function windingConsistent(geometry) {
  const index = geometry.getIndex().array;
  const seen = new Set();
  for (let i = 0; i < index.length; i += 3) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const key = `${index[i + a]}:${index[i + b]}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

test('a single-parcel patch extrudes to one closed solid', () => {
  const wedges = buildRibbonWedges(square(7, 7, 7, 7));
  assert.deepEqual([...wedges.keys()], [7]);
  assert.equal(openEdges(wedges.get(7)), 0);
  assert.ok(windingConsistent(wedges.get(7)));
});

test('majority vote splits triangles between parcels without opening either', () => {
  const wedges = buildRibbonWedges(square(3, 3, 9, 9));
  assert.deepEqual([...wedges.keys()].sort((a, b) => a - b), [3, 9]);
  for (const wedge of wedges.values()) {
    assert.equal(openEdges(wedge), 0);
    assert.ok(windingConsistent(wedge));
  }
});

test('a three-way triangle falls to the lowest label, as the build does', () => {
  const wedges = buildRibbonWedges({
    faces: new Uint32Array([0, 1, 2]),
    pial: new Float32Array([0, 0, 1, 1, 0, 1, 1, 1, 1]),
    white: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
    labels: new Uint16Array([8, 2, 5]),
  });
  assert.deepEqual([...wedges.keys()], [2]);
});

test('the wall carries pial and white coordinates unchanged', () => {
  const position = buildRibbonWedges(square(7, 7, 7, 7)).get(7).getAttribute('position');
  assert.equal(position.count, 8);
  assert.deepEqual([...position.array.slice(0, 3)], [0, 0, 1]);
  assert.deepEqual([...position.array.slice(12, 15)], [0, 0, 0]);
});
