import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { frameBounds } from './camera.js';

test('fits all anatomical bounds inside landscape and portrait viewports', () => {
  const bounds = new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1));
  for (const aspect of [1.7, 0.6]) {
    const camera = new PerspectiveCamera(35, aspect, 0.001, 10);
    const center = frameBounds(camera, bounds, new Vector3(-1, 0.3, -0.45).normalize());
    assert.deepEqual(center.toArray(), [0, 0.02, 0]);
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new Vector3(x, y, z).project(camera);
          assert.ok(Math.abs(projected.x) <= 0.93);
          assert.ok(Math.abs(projected.y) <= 0.93);
        }
      }
    }
  }
});
