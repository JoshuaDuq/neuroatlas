import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Plane,
  Raycaster,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computeBoundsTree } from 'three-mesh-bvh';
import * as legacyPlane from '../../viewer/tissues/plane-section.js';
import * as legacyWedges from '../../viewer/tissues/ribbon-wedges.js';
import * as legacySections from '../../viewer/tissues/solid-sections.js';
import * as legacyAssets from '../../viewer/tissues/solid-assets.js';
import * as legacyGlass from '../../viewer/tissues/glass-solids.js';
import * as legacySurfaces from '../../viewer/tissues/white-matter-surfaces.js';
import { Volume as LegacyVolume } from '../../viewer/slices/volume.js';
import { anatomies, asDisplaySettings, readModel } from '../src/lib/core/catalog/test-support.ts';
import { Volume } from '../src/lib/engine/slices/volume.ts';
import * as plane_ from '../src/lib/engine/tissues/plane-section.ts';
import * as wedges_ from '../src/lib/engine/tissues/ribbon-wedges.ts';
import * as sections_ from '../src/lib/engine/tissues/solid-sections.ts';
import * as assets_ from '../src/lib/engine/tissues/solid-assets.ts';
import * as glass_ from '../src/lib/engine/tissues/glass-solids.ts';
import * as surfaces_ from '../src/lib/engine/tissues/white-matter-surfaces.ts';
import type { CutReply, WorkerMessage } from '../src/lib/engine/tissues/section-worker.ts';
import type { Appearance } from '../src/lib/engine/render/materials.ts';
import type { Label, PaletteLookup } from '../src/lib/engine/tissues/palette.ts';
import type { Manifest } from '../src/lib/types/index.ts';

// Both asset caches read the published files from disk, so legacy and new see the same bytes.
const models = new URL(`../../public/models/${anatomies.default}/`, import.meta.url);
const readPublished = (url: string | URL): ArrayBuffer => {
  const bytes = readFileSync(new URL(String(url).split('/').pop()!, models));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};
vi.mock('../src/lib/core/assets/asset-cache.ts', async (original) => ({
  ...(await original<object>()),
  fetchAsset: async (url: string | URL) => readPublished(url),
}));
vi.mock('../../viewer/model/asset-cache.js', async (original) => ({
  ...(await original<object>()),
  fetchAsset: async (url: string | URL) => readPublished(url),
}));

/** mulberry32: a seeded PRNG, so every run draws the same corpus. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const manifest = readModel<Manifest>(`${anatomies.default}/manifest.json`);
const tissueLabels = readModel<{
  atlases: Record<string, { labels: Label[] }>;
  white_matter: {
    file: string;
    shape: number[];
    order: string;
    voxel_to_surface_ras_mm: number[][];
    labels: { source_label_id: number; region_id: string | null }[];
  };
}>(`${anatomies.default}/tissue-labels.json`);
const appearance = manifest.appearance as unknown as Appearance;

async function loadEnvelopes(): Promise<Mesh[]> {
  const bytes = readFileSync(new URL('tissue-envelopes.glb', models));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    '',
  );
  const meshes: Mesh[] = [];
  scene.traverse((object: Object3D) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  return meshes;
}
const envelopes = await loadEnvelopes();

const sameResult = (a: unknown, b: unknown) => assert.deepStrictEqual(a, b);

function seededPlanes(random: () => number, bounds: Mesh): Plane[] {
  bounds.geometry.computeBoundingBox();
  const box = bounds.geometry.boundingBox!;
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const planes: Plane[] = [];
  for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
    for (const sign of [1, -1]) {
      const normal = axis.clone().multiplyScalar(sign);
      const offset = (random() - 0.5) * 0.6 * size.dot(axis);
      planes.push(
        new Plane().setFromNormalAndCoplanarPoint(
          normal,
          center.clone().addScaledVector(axis, offset),
        ),
      );
    }
  }
  for (let i = 0; i < 2; i++) {
    const normal = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    planes.push(
      new Plane().setFromNormalAndCoplanarPoint(
        normal,
        center.clone().addScaledVector(normal, (random() - 0.5) * 0.02),
      ),
    );
  }
  return planes;
}

describe('plane-section', () => {
  it('cuts the four published envelopes identically, with and without a BVH', () => {
    const random = prng(31);
    assert.equal(envelopes.length, 4);
    for (const mesh of envelopes) {
      mesh.updateWorldMatrix(true, false);
      const geometry = mesh.geometry;
      const unindexed = geometry.clone();
      const withBvh = geometry.clone();
      withBvh.boundsTree = computeBoundsTree.call(withBvh, { indirect: true });
      const planes = seededPlanes(random, mesh);
      for (const plane of planes) {
        const after = plane_.sectionTriangles(withBvh, mesh.matrixWorld, plane);
        sameResult(after, legacyPlane.sectionTriangles(withBvh, mesh.matrixWorld, plane));
      }
      for (const plane of planes.slice(0, 2)) {
        sameResult(
          plane_.sectionTriangles(unindexed, mesh.matrixWorld, plane),
          legacyPlane.sectionTriangles(unindexed, mesh.matrixWorld, plane),
        );
      }
    }
  });

  it('agrees under a non-identity matrix and where the plane misses', () => {
    const geometry = new BoxGeometry(0.04, 0.04, 0.04, 6, 6, 6);
    const matrix = new Matrix4()
      .makeRotationFromEuler(new Euler(0.3, 0.2, 0.1))
      .setPosition(0.1, -0.2, 0.05);
    for (const plane of [
      new Plane(new Vector3(1, 0, 0), -0.1),
      new Plane(new Vector3(0, 0, 1), -5),
    ]) {
      sameResult(
        plane_.sectionTriangles(geometry, matrix, plane),
        legacyPlane.sectionTriangles(geometry, matrix, plane),
      );
    }
  });
});

const sides = ['left', 'right'] as const;
const ribbonRecord = (atlas: string) =>
  manifest.atlases.find((entry) => entry.id === atlas)!.ribbon_labels as {
    file: string;
    vertex_counts: Record<'left' | 'right', number>;
  };

function surfaceOf(hemisphere: string, boundary: string) {
  const mesh = envelopes.find(
    (entry) =>
      entry.userData['hemisphere'] === hemisphere && entry.userData['boundary'] === boundary,
  )!;
  mesh.updateWorldMatrix(true, false);
  const baked = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  return {
    position: baked.getAttribute('position').array as Float32Array,
    index: baked.getIndex()!.array,
  };
}

describe('ribbon-wedges', () => {
  it('builds the same wedges for both published atlases', () => {
    for (const atlas of ['destrieux', 'hcp-mmp']) {
      const record = ribbonRecord(atlas);
      const published = new Uint16Array(readPublished(record.file));
      let at = 0;
      for (const hemisphere of sides) {
        const count = record.vertex_counts[hemisphere];
        const labels = published.subarray(at, at + count);
        at += count;
        const pial = surfaceOf(hemisphere, 'pial');
        const white = surfaceOf(hemisphere, 'white');
        const input = { faces: pial.index, pial: pial.position, white: white.position, labels };
        const before = legacyWedges.buildRibbonWedges(input) as Map<number, BufferGeometry>;
        const after = wedges_.buildRibbonWedges(input);
        assert.deepStrictEqual([...after.keys()], [...before.keys()]);
        for (const [label, geometry] of after) {
          const legacy = before.get(label)!;
          assert.deepStrictEqual(
            geometry.getAttribute('position').array,
            legacy.getAttribute('position').array,
          );
          assert.deepStrictEqual(geometry.getIndex()!.array, legacy.getIndex()!.array);
          assert.deepStrictEqual(geometry.boundingBox, legacy.boundingBox);
        }
      }
    }
  });

  it('loads the same ribbon sources', async () => {
    for (const atlas of ['destrieux', 'hcp-mmp']) {
      const before = (await legacyAssets.loadRibbonSources(
        manifest,
        'http://x/',
        atlas,
        envelopes,
      )) as Mesh[];
      const after = await assets_.loadRibbonSources(manifest, 'http://x/', atlas, envelopes);
      assert.equal(after.length, before.length);
      after.forEach((mesh, at) => {
        assert.deepStrictEqual(mesh.userData, before[at]!.userData);
        assert.deepStrictEqual(
          mesh.geometry.getAttribute('position').array,
          before[at]!.geometry.getAttribute('position').array,
        );
        assert.deepStrictEqual(
          mesh.geometry.getIndex()!.array,
          before[at]!.geometry.getIndex()!.array,
        );
      });
    }
    assert.deepStrictEqual(
      await assets_.loadRibbonSources(manifest, 'http://x/', 'nextbrain', envelopes),
      [],
    );
  });
});

/** Parcel wedges and boxes cut by the same planes in both implementations. */
function solidSources(): Mesh[] {
  const record = ribbonRecord('destrieux');
  const published = new Uint16Array(readPublished(record.file));
  const labels = published.subarray(0, record.vertex_counts.left);
  const pial = surfaceOf('left', 'pial');
  const white = surfaceOf('left', 'white');
  const wedges = wedges_.buildRibbonWedges({
    faces: pial.index,
    pial: pial.position,
    white: white.position,
    labels,
  });
  const sources: Mesh[] = [];
  for (const [label, geometry] of [...wedges].filter((_, at) => at % 12 === 0).slice(0, 6)) {
    const mesh = new Mesh(geometry.clone());
    mesh.userData = {
      hemisphere: 'left',
      atlas: 'destrieux',
      kind: 'ribbon',
      region_id: `destrieux:left:${label}`,
    };
    sources.push(mesh);
  }
  const box = new Mesh(
    new BoxGeometry(0.1, 0.1, 0.1, 4, 4, 4),
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  box.userData = { hemisphere: 'left', boundary: 'pial', segmentation_volume_mm3: 5 };
  const nested = new Mesh(
    new BoxGeometry(0.03, 0.03, 0.03),
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  nested.userData = { region_id: 'cord', segmentation_volume_mm3: 1 };
  sources.push(box, nested);
  return sources;
}

function capSnapshot(solid: { cap: Mesh; group: Group; back: Mesh; sectioned?: boolean }) {
  const geometry = solid.cap.geometry;
  const position = geometry.getAttribute('position');
  const drawn = geometry.drawRange.count === Infinity ? position.count : geometry.drawRange.count;
  return {
    visible: solid.group.visible,
    sectioned: solid.sectioned,
    renderOrder: solid.group.renderOrder,
    offset: (solid.cap.material as MeshBasicMaterial).polygonOffsetUnits,
    positions: Array.from(position.array.slice(0, drawn * 3)),
    place: [
      solid.cap.position.toArray(),
      solid.cap.quaternion.toArray(),
      solid.cap.scale.toArray(),
    ],
    stencil: solid.back.visible,
  };
}

describe('SolidSections', () => {
  it('draws the same caps and answers the same rays on the published solids', () => {
    const before = new legacySections.SolidSections();
    const after = new sections_.SolidSections();
    for (const source of solidSources()) {
      const band = source.userData['kind'] === 'ribbon' ? 1 : 0;
      const a = source.clone();
      const b = source.clone();
      a.geometry = b.geometry = source.geometry;
      a.userData = b.userData = { ...source.userData };
      before.add(a, new MeshBasicMaterial(), band);
      after.add(b as sections_.SolidSource, new MeshBasicMaterial(), band);
    }
    onTestFinished(() => {
      before.dispose();
      after.dispose();
    });
    const random = prng(7);
    const bounds = after.bounds;
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const planes = [
      ...[
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ].flatMap(([x, y, z]) =>
        [1, -1].map((side) =>
          new Plane().setFromNormalAndCoplanarPoint(
            new Vector3(x!, y!, z!).multiplyScalar(side),
            center,
          ),
        ),
      ),
      ...[0, 1].map(() => {
        const normal = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
        return new Plane().setFromNormalAndCoplanarPoint(normal, center);
      }),
    ];
    for (const plane of planes) {
      before.update(plane);
      after.update(plane);
      assert.equal(after.generation, before.generation);
      assert.deepStrictEqual(after.solids.map(capSnapshot), before.solids.map(capSnapshot));
      for (let ray = 0; ray < 48; ray++) {
        const origin = plane.coplanarPoint(new Vector3()).addScaledVector(plane.normal, 0.2);
        origin.add(
          new Vector3(
            (random() - 0.5) * size.x,
            (random() - 0.5) * size.y,
            (random() - 0.5) * size.z,
          ),
        );
        const direction = plane.normal.clone().negate();
        if (ray % 4 === 0)
          direction
            .add(new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.4))
            .normalize();
        const a = before.intersect(new Raycaster(origin, direction));
        const b = after.intersect(new Raycaster(origin, direction));
        assert.equal(b === null, a === null);
        if (a && b) {
          assert.equal(Object.is(b.distance, a.distance), true);
          assert.deepStrictEqual(b.point.toArray(), a.point.toArray());
          assert.equal(b.faceIndex, a.faceIndex);
          assert.equal(b.region, a.region);
          assert.equal(
            after.solids.findIndex((s) => s.source === b.source),
            before.solids.findIndex((s) => s.source === a.source),
          );
        }
      }
    }
  });
});

describe('section worker', () => {
  it('returns the same buffers as the legacy worker and as the main-thread cut', async () => {
    const scope = globalThis as unknown as {
      onmessage: ((event: { data: unknown }) => void) | null;
    };
    const replies: CutReply[] = [];
    vi.stubGlobal('postMessage', (reply: CutReply) => replies.push(reply));
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    await import('../../viewer/tissues/section-worker.js');
    const legacyHandler = scope.onmessage!;
    scope.onmessage = null;
    await import('../src/lib/engine/tissues/section-worker.ts');
    const handler = scope.onmessage!;
    assert.notEqual(handler, legacyHandler);

    const sources = solidSources();
    const random = prng(11);
    sources.forEach((source, id) => {
      const geometry = source.geometry;
      geometry.boundsTree = computeBoundsTree.call(geometry, { indirect: true });
      const message: WorkerMessage = {
        type: 'store',
        id,
        position: geometry.getAttribute('position').array.slice() as Float32Array,
        index: geometry.getIndex()!.array.slice() as Uint32Array,
      };
      legacyHandler({ data: structuredClone(message) });
      handler({ data: structuredClone(message) });
    });
    for (let step = 0; step < 6; step++) {
      const normal = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      const plane = new Plane(normal, (random() - 0.5) * 0.04);
      const matrix = new Matrix4().identity();
      const jobs = [...sources.keys(), 99].map((id) => ({
        id,
        matrix: Array.from(matrix.elements),
      }));
      const message = {
        type: 'cut' as const,
        token: step,
        normal: normal.toArray() as [number, number, number],
        constant: plane.constant,
        jobs,
      };
      replies.length = 0;
      legacyHandler({ data: structuredClone(message) });
      handler({ data: structuredClone(message) });
      const [legacy, current] = replies as [CutReply, CutReply];
      assert.deepStrictEqual(current, legacy);
      sources.forEach((source, id) => {
        // The main-thread path walks the owner's indirect BVH, as the worker's copy does.
        const direct = plane_.sectionTriangles(source.geometry, matrix, plane);
        const reply = current.results.find((entry) => entry.id === id)!;
        assert.deepStrictEqual(reply.positions ?? undefined, direct.positions);
        assert.equal(reply.fallback, direct.fallback === true);
      });
    }
  });
});

describe('solid-assets', () => {
  const labelTable = tissueLabels.atlases['destrieux']!.labels;
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const lookup = { regions } as unknown as PaletteLookup;
  const makeSolids = () => {
    const make = (userData: Record<string, unknown>) => {
      const material = new MeshBasicMaterial();
      material.userData['tissueVariation'] = { value: 0 };
      material.userData['sampledLabels'] = { value: false };
      return {
        source: { userData, material: { color: new Color('#3c8a5a') } },
        cap: { material },
        visible: true,
        region: undefined as string | null | undefined,
      };
    };
    const parcel = labelTable.find((label) => label.kind === 'cortex' && label.region_id)!;
    return [
      make({ hemisphere: 'left', atlas: 'destrieux', kind: 'ribbon', region_id: parcel.region_id }),
      make({
        hemisphere: 'left',
        atlas: 'destrieux',
        kind: 'ribbon',
        region_id: 'destrieux:left:-1',
      }),
      make({ hemisphere: 'left', boundary: 'pial' }),
      make({ hemisphere: 'right', boundary: 'white' }),
      make({ hemisphere: 'left', region_id: 'aseg:left:11', detail: 'aseg' }),
      make({
        hemisphere: 'left',
        supplemental: true,
        mri_registered: false,
        region_id: 'zanatomy:left:x',
        source_name: 'Central canal',
        tissue: 'fluid',
      }),
    ];
  };
  const snapshot = (solids: ReturnType<typeof makeSolids>) =>
    solids.map((solid) => ({
      visible: solid.visible,
      region: solid.region,
      color: solid.cap.material.color.getHex(),
      variation: solid.cap.material.userData['tissueVariation'].value,
      sampled: solid.cap.material.userData['sampledLabels'].value,
    }));

  it('paints every solid kind the same under a grid of display states', () => {
    const before = legacyAssets.indexLabels(labelTable);
    const after = assets_.indexLabels(labelTable);
    assert.deepStrictEqual(after, before);
    const random = prng(5);
    const regionIds = [
      null,
      'destrieux:left:1',
      'aseg:left:11',
      labelTable.find((l) => l.kind === 'cortex')!.region_id,
    ];
    for (let step = 0; step < 300; step++) {
      const state = asDisplaySettings({
        hemisphere: ['both', 'left', 'right'][Math.floor(random() * 3)],
        cortexVisible: random() < 0.8,
        cortexOpacity: random() < 0.5 ? 1 : 0,
        surfaceColor: ['tissue', 'atlas', 'network', 'cab-np', 'functional', 'mri'][
          Math.floor(random() * 6)
        ],
        isolatedRegion: regionIds[Math.floor(random() * regionIds.length)],
        hiddenRegions: new Set(random() < 0.3 ? ['destrieux:left:1'] : []),
        internalVisible: random() < 0.8,
        internalSystem: null,
        detail: 'aseg',
        paint: null,
      });
      const options = {
        state,
        atlas: 'destrieux',
        detail: 'aseg',
        wedged: random() < 0.5,
        appearance,
        lookup,
      };
      const a = makeSolids();
      const b = makeSolids();
      legacyAssets.paintSolids({ solids: a }, { ...options, labels: before, whiteMatter: null });
      assets_.paintSolids({ solids: b }, { ...options, labels: after, whiteMatter: null });
      assert.deepStrictEqual(snapshot(b), snapshot(a));
    }
  });

  it('orders nested solids enclosing first', () => {
    const random = prng(3);
    const sources = Array.from({ length: 40 }, (_, at) => ({
      userData: {
        region_id: String(at),
        segmentation_volume_mm3: random() < 0.2 ? undefined : Math.floor(random() * 50),
      },
    }));
    assert.deepStrictEqual(assets_.enclosingFirst(sources), legacyAssets.enclosingFirst(sources));
  });
});

describe('Volume', () => {
  it('samples the published white-matter volume like the legacy class', () => {
    const record = tissueLabels.white_matter;
    const data = new Uint8Array(gunzipSync(readFileSync(new URL(record.file, models))));
    const before = new LegacyVolume(record, data);
    const after = new Volume(record, data);
    assert.deepStrictEqual(after.inverse, before.inverse);
    assert.deepStrictEqual(after.shape, before.shape);
    const random = prng(17);
    for (let step = 0; step < 400; step++) {
      const point: [number, number, number] = [
        (random() - 0.5) * 140,
        (random() - 0.5) * 140,
        (random() - 0.5) * 140,
      ];
      assert.equal(Object.is(after.label(point), before.label(point)), true);
      assert.equal(Object.is(after.linear(point), before.linear(point)), true);
      assert.deepStrictEqual(after.voxel(point), before.voxel(point));
    }
    for (const bad of [
      { ...record, order: 'C' },
      { ...record, shape: [1, 1] },
    ]) {
      expect(() => new Volume(bad, data)).toThrow('Unsupported volume shape or storage order.');
      expect(() => new LegacyVolume(bad, data)).toThrow(
        'Unsupported volume shape or storage order.',
      );
    }
  });
});

describe('glass-solids and white-matter-surfaces', () => {
  it('lights the same ribbon solids', () => {
    const random = prng(23);
    const sources = solidSources().slice(0, 4);
    const mine = () =>
      sources.map((source) => {
        const mesh = new Mesh(source.geometry.clone());
        mesh.userData = { ...source.userData };
        return mesh;
      });
    const before = legacyGlass.createGlassSolids(mine(), appearance);
    const after = glass_.createGlassSolids(mine(), appearance);
    const planes = [[new Plane()], null];
    for (let step = 0; step < 40; step++) {
      const hidden = new Set(
        sources.filter(() => random() < 0.4).map((s) => s.userData['region_id'] as string),
      );
      const color = [Math.floor(random() * 255), 20, 200] as const;
      const args = {
        solidOf: (id: string) => (id.length % 2 ? { color } : null),
        shown: (id: string) => !hidden.has(id),
        clippingPlanes: planes[step % 2] as Plane[] | null,
      };
      before.update(args);
      after.update(args);
      assert.equal(after.group.visible, before.group.visible);
      after.meshes.forEach((mesh, at) => {
        const legacy = before.meshes[at]!;
        assert.equal(mesh.visible, legacy.visible);
        assert.equal(mesh.material.color.getHex(), legacy.material.color.getHex());
        assert.equal(mesh.material.clippingPlanes, legacy.material.clippingPlanes);
        assert.equal(mesh.material.clearcoat, legacy.material.clearcoat);
        assert.equal(mesh.material.side, legacy.material.side);
      });
    }
  });

  it('exposes and draws the same white surfaces', () => {
    const regionList = manifest.regions.filter((region) => region.kind === 'cortex').slice(0, 30);
    const regionMap = new Map(regionList.map((region) => [region.id, region]));
    const group = () => {
      const root = new Group();
      for (const mesh of envelopes) {
        const copy = new Mesh(mesh.geometry, new MeshBasicMaterial());
        copy.userData = { ...mesh.userData };
        root.add(copy);
      }
      return root;
    };
    const before = legacySurfaces.createWhiteMatterSurfaces(group(), appearance);
    const after = surfaces_.createWhiteMatterSurfaces(group(), appearance);
    const random = prng(29);
    for (let step = 0; step < 100; step++) {
      const state = asDisplaySettings({
        cortexVisible: random() < 0.8,
        cortexOpacity: [0, 0.4, 1][Math.floor(random() * 3)],
        isolatedRegion: random() < 0.2 ? 'x' : null,
        hiddenRegions: new Set(regionList.filter(() => random() < 0.1).map((r) => r.id)),
        atlas: ['destrieux', 'hcp-mmp'][Math.floor(random() * 2)],
        hemisphere: ['both', 'left', 'right'][Math.floor(random() * 3)],
      });
      assert.deepStrictEqual(
        surfaces_.exposedWhiteMatter(state, regionMap),
        legacySurfaces.exposedWhiteMatter(state, regionMap),
      );
      const planes = random() < 0.5 ? null : [new Plane()];
      before.update(state, regionMap, planes);
      after.update(state, regionMap, planes);
      assert.equal(after.group.visible, before.group.visible);
      after.meshes.forEach((mesh, at) => {
        const legacy = before.meshes[at]!;
        for (const key of ['visible'] as const) assert.equal(mesh[key], legacy[key]);
        for (const key of ['opacity', 'transparent', 'depthWrite', 'clearcoat', 'side'] as const) {
          assert.equal(mesh.material[key], legacy.material[key]);
        }
      });
    }
    assert.throws(
      () => surfaces_.createWhiteMatterSurfaces(new Group(), appearance),
      /Expected one native left/,
    );
    assert.throws(
      () => legacySurfaces.createWhiteMatterSurfaces(new Group(), appearance),
      /Expected one native left/,
    );
  });
});

describe('earcut', () => {
  it('triangulates seeded polygons with holes like the vendored legacy copy', async () => {
    const legacy = await import('../../viewer/tissues/earcut.js');
    const current = await import('../src/lib/engine/tissues/earcut.js');
    const random = prng(41);
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
      const triangles = current.earcut(data, holeIndices, 2);
      assert.deepStrictEqual(triangles, legacy.earcut(data, holeIndices, 2));
      assert.equal(
        Object.is(
          current.earcut.deviation(data, holeIndices, 2, triangles),
          legacy.earcut.deviation(data, holeIndices, 2, triangles),
        ),
        true,
      );
    }
  });
});
