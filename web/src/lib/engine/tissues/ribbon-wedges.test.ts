import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, vi } from 'vitest';
import { Box3, Mesh } from 'three';
import type { BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as assetCache from '../../core/assets/asset-cache.ts';
import { anatomies, readModel } from '../../core/catalog/test-support.ts';
import type { Manifest } from '../../types/index.ts';
import { modelDirectory } from '../model/test-support.ts';
import { loadRibbonSources } from './solid-assets.ts';
import { buildRibbonWedges } from './ribbon-wedges.ts';

/** Two triangles spanning a unit square, extruded one unit towards white. */
function square(...labels: number[]) {
  return {
    faces: new Uint32Array([0, 1, 2, 0, 2, 3]),
    pial: new Float32Array([0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
    white: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    labels: new Uint16Array(labels),
  };
}

/** A hole is an edge only one triangle carries; the stencil leaks through it. */
function openEdges(geometry: BufferGeometry): number {
  const index = geometry.getIndex()!.array;
  const counts = new Map<string, number>();
  for (let i = 0; i < index.length; i += 3) {
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ]) {
      const key = [index[i + a]!, index[i + b]!].sort((x, y) => x - y).join(':');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.values()].filter((count) => count !== 2).length;
}

/** Every directed edge appears exactly once, which is what the stencil counts. */
function windingConsistent(geometry: BufferGeometry): boolean {
  const index = geometry.getIndex()!.array;
  const seen = new Set<string>();
  for (let i = 0; i < index.length; i += 3) {
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ]) {
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
  assert.equal(openEdges(wedges.get(7)!), 0);
  assert.ok(windingConsistent(wedges.get(7)!));
});

test('majority vote splits triangles between parcels without opening either', () => {
  const wedges = buildRibbonWedges(square(3, 3, 9, 9));
  assert.deepEqual(
    [...wedges.keys()].sort((a, b) => a - b),
    [3, 9],
  );
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
  const position = buildRibbonWedges(square(7, 7, 7, 7))
    .get(7)!
    .getAttribute('position');
  assert.equal(position.count, 8);
  assert.deepEqual(Array.from(position.array.slice(0, 3)), [0, 0, 1]);
  assert.deepEqual(Array.from(position.array.slice(12, 15)), [0, 0, 0]);
});

test('TISSUE-10 surfaces that do not share one labelled vertex set are refused', () => {
  const input = square(7, 7, 7, 7);
  const message = 'Ribbon surfaces must share one labelled vertex set.';
  assert.throws(() => buildRibbonWedges({ ...input, white: input.white.slice(0, 9) }), { message });
  assert.throws(() => buildRibbonWedges({ ...input, labels: new Uint16Array(5) }), { message });
});

// The published ribbon: the envelopes and the label files of the default anatomy.
const directory = modelDirectory(anatomies.default);
const manifest = readModel<Manifest>(`${anatomies.default}/manifest.json`);
const bytes = async (file: string) => {
  const buffer = await readFile(new URL(file, directory));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
};
const envelopes = (async () => {
  const { scene } = await new GLTFLoader().parseAsync(await bytes('tissue-envelopes.glb'), '');
  const meshes: Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  return meshes;
})();

/** The label that owns a triangle: the one two vertices share, else the lowest. */
const owner = ([a, b, c]: number[]) =>
  a === b || a === c ? a! : b === c ? b! : Math.min(a!, b!, c!);

test.each(['destrieux', 'hcp-mmp'])(
  'TISSUE-11 and TISSUE-12 the published %s ribbon gives one solid per owning label inside its hemisphere, named by its region',
  async (atlas) => {
    const meshes = await envelopes;
    vi.spyOn(assetCache, 'fetchAsset').mockImplementation(async (url) =>
      bytes(String(url).split('/').pop()!),
    );
    const record = manifest.atlases.find((entry) => entry.id === atlas)!.ribbon_labels as {
      file: string;
      vertex_counts: Record<'left' | 'right', number>;
      region_ids: string[];
    };
    const labels = new Uint16Array(await bytes(record.file));
    const sources = await loadRibbonSources(manifest, 'http://x/', atlas, meshes);

    let at = 0;
    let expectedCount = 0;
    const hemispheres = ['left', 'right'] as const;
    for (const hemisphere of hemispheres) {
      const count = record.vertex_counts[hemisphere];
      const own = labels.subarray(at, at + count);
      at += count;
      const pial = meshes.find(
        (mesh) =>
          mesh.userData['hemisphere'] === hemisphere && mesh.userData['boundary'] === 'pial',
      )!;
      const faces = pial.geometry.getIndex()!.array;
      const owners = new Set<number>();
      for (let face = 0; face < faces.length; face += 3) {
        owners.add(owner([own[faces[face]!]!, own[faces[face + 1]!]!, own[faces[face + 2]!]!]));
      }
      expectedCount += owners.size;
      const mine = sources.filter((source) => source.userData['hemisphere'] === hemisphere);
      assert.equal(mine.length, owners.size, `${hemisphere}: one wedge per owning label`);
      pial.updateWorldMatrix(true, false);
      const hull = new Box3().setFromObject(pial).expandByScalar(1e-6);
      for (const source of mine) {
        source.geometry.computeBoundingBox();
        assert.ok(hull.containsBox(source.geometry.boundingBox!), source.userData['region_id']);
        assert.equal(source.userData['atlas'], atlas);
        assert.equal(source.userData['kind'], 'ribbon');
        assert.ok(record.region_ids.includes(source.userData['region_id']));
      }
    }
    assert.equal(sources.length, expectedCount);
    // Left solids come first.
    const firstRight = sources.findIndex((source) => source.userData['hemisphere'] === 'right');
    assert.ok(
      sources.slice(0, firstRight).every((source) => source.userData['hemisphere'] === 'left'),
    );
  },
  120_000,
);

test('TISSUE-12 an atlas without ribbon labels gets no parcel solids, and a missing envelope is named', async () => {
  const meshes = await envelopes;
  assert.deepEqual(await loadRibbonSources(manifest, 'http://x/', 'nextbrain', meshes), []);
  vi.spyOn(assetCache, 'fetchAsset').mockImplementation(async (url) =>
    bytes(String(url).split('/').pop()!),
  );
  await assert.rejects(loadRibbonSources(manifest, 'http://x/', 'destrieux', []), {
    message: 'Missing the left pial envelope.',
  });
});
