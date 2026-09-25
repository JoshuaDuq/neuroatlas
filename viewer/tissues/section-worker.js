import { BufferAttribute, BufferGeometry, Matrix4, Plane, Vector3 } from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import { sectionTriangles } from './plane-section.js';

const stored = new Map();
const matrix = new Matrix4();
const normal = new Vector3();

globalThis.onmessage = event => {
  const message = event.data;
  if (message.type === 'store') {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(message.position, 3));
    if (message.index) geometry.setIndex(new BufferAttribute(message.index, 1));
    geometry.boundsTree = computeBoundsTree.call(geometry, { indirect: true });
    stored.set(message.id, geometry);
    return;
  }
  normal.fromArray(message.normal);
  const plane = new Plane(normal, message.constant);
  const results = [];
  const transfers = [];
  for (const job of message.jobs) {
    const geometry = stored.get(job.id);
    if (!geometry) {
      results.push({ id: job.id, fallback: true });
      continue;
    }
    matrix.fromArray(job.matrix);
    const section = sectionTriangles(geometry, matrix, plane);
    if (section.positions) transfers.push(section.positions.buffer);
    results.push({ id: job.id, positions: section.positions ?? null, fallback: section.fallback === true, empty: section.empty === true });
  }
  globalThis.postMessage({ token: message.token, results }, transfers);
};
