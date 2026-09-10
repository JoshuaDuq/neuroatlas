import assert from 'node:assert/strict';
import test from 'node:test';
import { millimetresPerPixel, scaleBar } from './scale-bar.js';

test('millimetres per pixel follows the perspective frustum at the target', () => {
  // A 35 degree camera 0.5 m away spans 2 * 0.5 * tan(17.5 deg) metres.
  const expected = (2 * 0.5 * Math.tan((35 * Math.PI) / 360) * 1000) / 800;
  assert.ok(Math.abs(millimetresPerPixel(35, 0.5, 800) - expected) < 1e-9);
});

test('the bar snaps to a 1-2-5 sequence, never an arbitrary length', () => {
  assert.equal(scaleBar(35, 0.5, 800).millimetres, 50);
  assert.equal(scaleBar(35, 0.15, 800).millimetres, 10);
});

test('the drawn bar stays in its pixel window at every usable distance', () => {
  for (let distance = 0.03; distance <= 1.5; distance += 0.005) {
    for (const height of [400, 800, 1600]) {
      const { pixels, millimetres } = scaleBar(35, distance, height);
      assert.ok(pixels >= 60 && pixels <= 150,
        `${millimetres} mm drew ${pixels.toFixed(1)} px at ${distance.toFixed(3)} m`);
      assert.ok(/^[125]0*$|^[125]$|^0\.[125]$/.test(String(millimetres)),
        `${millimetres} is not a 1-2-5 value`);
    }
  }
});

test('the reported pixel length matches the reported millimetres', () => {
  const bar = scaleBar(35, 0.42, 900);
  const perPixel = millimetresPerPixel(35, 0.42, 900);
  assert.ok(Math.abs(bar.pixels * perPixel - bar.millimetres) < 1e-9);
});
