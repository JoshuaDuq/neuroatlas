import { BufferAttribute, BufferGeometry, Matrix4, Plane, Vector3 } from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import { sectionTriangles } from './plane-section.ts';
import type { BvhGeometry } from './plane-section.ts';

/** Copies a solid's geometry into the worker, once, ahead of the first cut. */
export interface StoreMessage {
  type: 'store';
  id: number;
  position: Float32Array;
  index: Uint16Array | Uint32Array | null;
}

/** Cuts every listed solid by one plane. Any message that is not `store` is a cut. */
export interface CutMessage {
  type: 'cut';
  token: number;
  normal: [number, number, number];
  constant: number;
  jobs: { id: number; matrix: number[] }[];
}

export type WorkerMessage = StoreMessage | CutMessage;

export interface CutJobResult {
  id: number;
  positions?: Float32Array | null;
  fallback: boolean;
  empty?: boolean;
}

export interface CutReply {
  token: number;
  results: CutJobResult[];
}

/** The slice of a dedicated worker's global scope this module uses (the app's tsconfig is DOM). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage(message: CutReply, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;
const stored = new Map<number, BvhGeometry>();
const matrix = new Matrix4();
const normal = new Vector3();

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'store') {
    const geometry: BvhGeometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(message.position, 3));
    if (message.index) geometry.setIndex(new BufferAttribute(message.index, 1));
    geometry.boundsTree = computeBoundsTree.call(geometry, { indirect: true });
    stored.set(message.id, geometry);
    return;
  }
  normal.fromArray(message.normal);
  const plane = new Plane(normal, message.constant);
  const results: CutJobResult[] = [];
  const transfers: Transferable[] = [];
  for (const job of message.jobs) {
    const geometry = stored.get(job.id);
    if (!geometry) {
      results.push({ id: job.id, fallback: true });
      continue;
    }
    matrix.fromArray(job.matrix);
    const section = sectionTriangles(geometry, matrix, plane);
    if (section.positions) transfers.push(section.positions.buffer);
    results.push({
      id: job.id,
      positions: section.positions ?? null,
      fallback: section.fallback === true,
      empty: section.empty === true,
    });
  }
  scope.postMessage({ token: message.token, results }, transfers);
};
