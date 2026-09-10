import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Mesh, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { BrainAtlas } from '../viewer/brain-atlas.js';

const directory = new URL('../public/models/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
const parser = new GLTFLoader();
const model = new BrainAtlas(manifest, {
  async loadAsync(file) {
    const buffer = await readFile(new URL(file, directory));
    return parser.parseAsync(buffer.buffer.slice(buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength), '');
  },
});
await model.initialize('destrieux');
model.group.updateMatrixWorld(true);
const rays = Array.from({ length: 400 }, (_, index) => {
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const vertical = 1 - 2 * (index + .5) / 400;
  const radius = Math.sqrt(1 - vertical * vertical);
  const direction = new Vector3(Math.cos(angle) * radius, vertical, Math.sin(angle) * radius);
  return new Raycaster(direction.clone().multiplyScalar(.25), direction.negate());
});

function measure(raycast) {
  for (const mesh of model.visibleMeshes) mesh.raycast = raycast;
  const start = performance.now();
  const hits = rays.map(ray => {
    ray.firstHitOnly = true;
    const hit = ray.intersectObjects(model.visibleMeshes, false)[0];
    return hit ? [hit.object.userData.region_id, hit.distance] : null;
  });
  return { milliseconds: performance.now() - start, hits };
}

const standard = measure(Mesh.prototype.raycast);
const accelerated = measure(acceleratedRaycast);
for (let i = 0; i < rays.length; i++) {
  assert.equal(standard.hits[i]?.[0], accelerated.hits[i]?.[0]);
  if (standard.hits[i]) assert.ok(Math.abs(standard.hits[i][1] - accelerated.hits[i][1]) < 1e-9);
}
const result = {
  rays: rays.length, identical_selections: true,
  standard_total_ms: standard.milliseconds,
  accelerated_total_ms: accelerated.milliseconds,
  speedup: standard.milliseconds / accelerated.milliseconds,
  note: 'Local CPU raycasting benchmark; excludes rendering and does not measure frame rate.',
};
await writeFile(new URL('../deliverables/picking-benchmark.json', import.meta.url),
  JSON.stringify(result, null, 2) + '\n');
console.log(result);
model.dispose();
