import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, test, vi } from 'vitest';
import { Color, Plane, Raycaster, Vector3 } from 'three';
import { tissueColor } from '../render/materials.ts';
import type { Material, Mesh, MeshStandardMaterial } from 'three';
import type { AnatomicalUserData } from '../render/materials.ts';
import * as assetCache from '../../core/assets/asset-cache.ts';
import { readModel } from '../../core/catalog/test-support.ts';
import { anatomies } from '../../core/catalog/test-support.ts';
import { BrainAtlas } from './brain-atlas.ts';
import { modelDirectory, publishedLoader, readManifest } from './test-support.ts';

for (const { id: published } of anatomies.anatomies) {
  test(
    `${published}: published GLBs load in Three.js with manifest metadata and unchanged geometry`,
    { timeout: 120_000 },
    async () => {
      const manifest = readManifest(published);
      const atlas = new BrainAtlas(manifest, publishedLoader(modelDirectory(published)));
      await atlas.initialize('destrieux');
      const detail = manifest.detail_levels.find((level) => level.id === atlas.defaultDetail)!;
      assert.equal(atlas.state.detail, 'learning');
      // 148 Destrieux parcels; the two medial walls wait for the internal anatomy to be hidden and a
      // published cord waits to be shown.
      assert.equal(atlas.visibleMeshes.length, 148 + detail.region_count);
      // A scan that ends inside the medulla (SNAIL's) publishes no reference cord to show.
      if (manifest.supplemental_layers?.length) {
        const [cord] = manifest.supplemental_layers;
        assert.deepEqual(
          manifest.supplemental_layers.map((layer) => layer.id),
          ['pam50'],
        );
        await atlas.setSpinalCordVisible(true);
        assert.equal(atlas.visibleMeshes.length, 148 + detail.region_count + cord!.region_count);
        await atlas.setSpinalCordVisible(false);
      } else {
        await assert.rejects(atlas.setSpinalCordVisible(true), /does not publish a spinal cord/);
      }
      for (const entry of manifest.atlases) {
        await atlas.setAtlas(entry.id);
        const corticalMeshes = atlas.visibleMeshes.filter(
          (mesh) => mesh.userData['kind'] === 'cortex',
        );
        assert.equal(corticalMeshes.length, entry.region_count);
        for (const mesh of atlas.visibleMeshes) {
          assert.ok(mesh.geometry.getAttribute('normal'));
          if (['cortex', 'non-region'].includes(mesh.userData['kind'])) {
            for (const name of ['_sulc', '_concavity', '_t1']) {
              const field = mesh.geometry.getAttribute(name);
              assert.equal(field.count, mesh.geometry.attributes['position']!.count);
              assert.ok((field.array as Float32Array).every(Number.isFinite));
            }
          }
          assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
          assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
        }
        atlas.select(corticalMeshes[0]!.userData['region_id']);
        assert.equal(atlas.state.selectedRegion!.atlas, entry.id);
      }
      atlas.setCortexVisible(false);
      assert.equal(atlas.visibleMeshes.length, detail.region_count);
      atlas.select(atlas.visibleMeshes[0]!.userData['region_id']);
      assert.equal(atlas.state.selectedRegion!.kind, 'structure');
      atlas.setInternalSystem('Basal ganglia');
      assert.ok(atlas.visibleMeshes.length > 5);
      assert.ok(
        atlas.visibleMeshes.every(
          (mesh) =>
            atlas.regions.get(mesh.userData['region_id'])!.system_names!['en'] === 'Basal ganglia',
        ),
      );
      assert.throws(() => atlas.setInternalSystem('Imaginary system'), /Unknown internal/);
      const caudate = atlas.visibleMeshes.find(
        (mesh) => mesh.userData['region_id'] === 'learning:left:caudate',
      )!;
      atlas.select(caudate.userData['region_id']);
      atlas.isolate();
      assert.equal(atlas.visibleMeshes.length, 1);
      atlas.setInternalSystem('Brainstem');
      assert.equal(atlas.state.selectedRegion, null);
      assert.equal(atlas.state.isolatedRegion, null);
      atlas.reset();
      assert.equal(atlas.state.internalSystem, null);
      atlas.dispose();
    },
  );
}

// One published model, shared by the rules below and put back to destrieux / learning after each.
describe('the published CDMD model', () => {
  const published = 'cdmd';
  const manifest = readManifest(published);
  const sidecars = ['cab-np', 'functional-regions', 'neuropsych-domains', 'neurosynth-terms'].map(
    (name) => readModel<never>(`${published}/${name}.json`),
  );
  let model: BrainAtlas;

  beforeAll(async () => {
    model = new BrainAtlas(manifest, publishedLoader(modelDirectory(published)), ...sidecars);
    await model.initialize('destrieux');
  }, 120_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // reset() keeps the paint by design (ATLAS-40), so a case that painted must lift it.
    model.setPaint(null);
    model.reset();
    await model.setAtlas('destrieux');
    await model.setDetail('learning');
  });

  afterAll(() => model.dispose());

  test(
    'ATLAS-07 the aseg level holds 32 meshes, nextbrain 292 and the envelopes 4',
    { timeout: 120_000 },
    async () => {
      const meshes = async (detail: string) => {
        await model.setDetail(detail);
        return (model.layers.get(detail)?.meshes ?? []).length;
      };
      assert.equal(await meshes('aseg'), 32);
      assert.equal(await meshes('nextbrain'), 292);
      assert.equal((await model.ensureEnvelopes()).length, 4);
    },
  );

  test('ATLAS-26 network colour mixes the published network map into every cortex surface that carries it, and a paint turns it off', () => {
    const mixes = () =>
      (model.layers.get('destrieux')!.meshes as Mesh[]).flatMap((mesh) => {
        const { networkMix, tissueVariation } = (mesh.material as Material)
          .userData as AnatomicalUserData;
        return networkMix
          ? [
              {
                mix: networkMix.value,
                variation: tissueVariation.value,
                color: (mesh.material as MeshStandardMaterial).color.getHexString(),
                region: model.regions.get(mesh.userData['region_id'])!,
              },
            ]
          : [];
      });
    model.setSurfaceColor('network');
    const shown = mixes();
    assert.ok(shown.length >= 100, `${shown.length} networked surfaces`);
    for (const { mix, variation, color, region } of shown) {
      assert.deepEqual([mix, variation], [1, 0]);
      assert.equal(
        color,
        new Color(tissueColor(region, manifest.appearance.tissue)).getHexString(),
      );
    }
    model.setSurfaceColor('atlas');
    assert.ok(mixes().every(({ mix }) => mix === 0));
    model.setSurfaceColor('network');
    model.setPaint({
      id: 'function:a',
      colors: new Map([['destrieux:left:1', [1, 2, 3]]]),
    } as never);
    assert.ok(mixes().every(({ mix }) => mix === 0));
  });

  test('ATLAS-15 changing the detail level clears the internal system, its isolation and the selection', async () => {
    model.setInternalSystem('Basal ganglia');
    model.select('learning:left:caudate');
    model.isolate();
    assert.equal(model.settings.isolatedRegion, 'learning:left:caudate');
    await model.setDetail('aseg');
    assert.equal(model.settings.internalSystem, null);
    assert.equal(model.settings.internalConstituents.size, 0);
    assert.equal(model.settings.isolatedRegion, null);
    assert.equal(model.state.selectedRegion, null);
  });

  test(
    'ATLAS-46 every region with a mesh has a centroid in tenths of a millimetre, and right is right of left',
    { timeout: 120_000 },
    async () => {
      await model.setAtlas('hcp-mmp');
      for (const detail of ['aseg', 'nextbrain', 'learning']) await model.setDetail(detail);
      await model.setAtlas('destrieux');
      let found = 0;
      for (const id of model.regions.keys()) {
        const centroid = model.centroidOf(id);
        if (!centroid) continue;
        found += 1;
        for (const value of centroid)
          assert.ok(Math.abs(value * 10 - Math.round(value * 10)) < 1e-6, `${id}: ${value}`);
      }
      assert.ok(found >= 400, `${found} centroids`);
      assert.deepEqual(
        ['destrieux:left:1', 'destrieux:right:1'].map((id) => model.centroidOf(id)),
        [
          [-17.4, 52.3, 35.9],
          [22.7, 53.7, 36.1],
        ],
      );
      for (const id of model.regions.keys()) {
        const [, side, label] = id.split(':');
        if (!id.startsWith('destrieux:left:') || Number(label) < 1) continue;
        const left = model.centroidOf(id);
        const right = model.centroidOf(`destrieux:right:${label}`);
        if (left && right) assert.ok(right[0] > left[0], `${id}: ${side}`);
      }
    },
  );

  /** Fibonacci-sphere rays at 0.25 m aimed at the centre, as scripts/benchmark-picking.mjs lays them. */
  const rays = Array.from({ length: 100 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 100;
    const r = Math.sqrt(1 - y * y);
    const direction = new Vector3(
      Math.cos(Math.PI * (3 - Math.sqrt(5)) * i) * r,
      y,
      Math.sin(Math.PI * (3 - Math.sqrt(5)) * i) * r,
    );
    return new Raycaster(direction.clone().multiplyScalar(0.25), direction.negate());
  });

  function picks() {
    return rays.map((ray) => model.pick(ray));
  }

  test('ATLAS-45 a pick lands on a drawn region of the right side, in every display state', () => {
    for (const [origin, direction, hemisphere] of [
      [[0.25, 0, 0], [-1, 0, 0], 'right'],
      [[-0.25, 0, 0], [1, 0, 0], 'left'],
    ] as const) {
      const region = model.pick(new Raycaster(new Vector3(...origin), new Vector3(...direction)));
      assert.equal(region?.kind, 'cortex');
      assert.equal(region?.atlas, 'destrieux');
      assert.equal(region?.hemisphere, hemisphere);
    }
    const everything = picks();
    assert.ok(everything.filter(Boolean).length > 30, 'more than 30 % of the rays hit');
    for (const region of everything) {
      if (region) assert.ok(model.canSelect(region) && region.kind !== 'non-region', region.id);
    }

    model.setHemisphere('left');
    assert.ok(picks().every((region) => region?.hemisphere !== 'right'));
    model.setHemisphere('both');

    model.setCortexVisible(false);
    assert.ok(picks().every((region) => region?.kind !== 'cortex'));
    model.setCortexVisible(true);

    const target = everything.find(Boolean)!;
    model.select(target.id);
    model.isolate();
    assert.ok(picks().every((region) => !region || region.id === target.id));
    model.clearIsolation();
    model.hideRegions([target.id]);
    assert.ok(picks().every((region) => region?.id !== target.id));
  });

  test('ATLAS-45 under a clipping plane a pick is still a drawn, selectable region, and the plane changes what is picked', () => {
    model.setPaint(null);
    const open = picks();
    model.setClippingPlanes([new Plane(new Vector3(0.3, 0.5, 0.8).normalize(), 0.01)]);
    const clipped = picks();
    for (const region of clipped) {
      if (region) assert.ok(model.canSelect(region) && region.kind !== 'non-region', region.id);
    }
    assert.ok(
      clipped.some((region, at) => region?.id !== open[at]?.id),
      'the plane changes a pick',
    );
  });

  test(
    'ATLAS-11 loading from the published manifest reads its sidecars, reports progress and disposes a model that fails to open',
    { timeout: 120_000 },
    async () => {
      vi.spyOn(assetCache, 'fetchAsset').mockImplementation(async (url, options) => {
        const bytes = await readFile(
          new URL(String(url).split('/').pop()!, modelDirectory(published)),
        );
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        options?.onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength });
        return buffer;
      });
      vi.stubGlobal('location', { href: 'https://example.invalid/' });
      const url = `https://example.invalid/models/${published}/manifest.json`;
      const progress: { loaded: number; total: number }[] = [];
      const loaded = await BrainAtlas.load(url, 'hcp-mmp', {
        onProgress: (event) => progress.push({ ...event }),
      });
      assert.equal(loaded.settings.atlas, 'hcp-mmp');
      assert.equal(loaded.settings.detail, 'learning');
      assert.deepEqual(loaded.cabNp, sidecars[0]);
      assert.deepEqual(loaded.functionalRegions, sidecars[1]);
      assert.deepEqual(loaded.domains, sidecars[2]);
      const last = progress.at(-1)!;
      assert.ok(last.total > 0 && last.loaded === last.total);
      loaded.dispose();

      const dispose = vi.spyOn(BrainAtlas.prototype, 'dispose');
      await assert.rejects(BrainAtlas.load(url, 'no-such-atlas'));
      assert.equal(dispose.mock.calls.length, 1);
    },
  );
});
