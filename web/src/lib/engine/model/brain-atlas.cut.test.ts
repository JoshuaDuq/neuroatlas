import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, test, vi } from 'vitest';
import { BrainSections } from '../slices/sections.ts';
import type { SectionsModel } from '../slices/sections.ts';
import { BrainAtlas } from './brain-atlas.ts';
import { modelDirectory, publishedLoader, readManifest } from './test-support.ts';

afterEach(() => vi.restoreAllMocks());

test(
  'the first cut builds its solids from the model’s meshes instead of downloading them again',
  { timeout: 120_000 },
  async () => {
    // cdmd publishes the cord the first cut also brings.
    const directory = modelDirectory('cdmd');
    const manifest = readManifest('cdmd');
    const parsed: string[] = [];
    const fetched: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const file = new URL(String(url)).pathname.split('/').at(-1)!;
      fetched.push(file);
      return new Response(await readFile(new URL(file, directory)));
    });
    const base = 'https://example.invalid/models/subject/';
    const model = new BrainAtlas(
      manifest,
      publishedLoader(directory, (file) => parsed.push(file)),
    );
    // The cut drives the model through this surface alone.
    const surface: SectionsModel = model;
    await model.initialize('destrieux');
    const sections = new BrainSections(surface, new URL('volumes.json', base));
    await sections.setMode('coronal');
    // The first cut brings the envelopes and the cord; nothing already held is fetched again.
    assert.deepEqual(parsed.sort(), [
      'cortex-destrieux.glb',
      'learning.glb',
      'spinal-cord.glb',
      'tissue-envelopes.glb',
    ]);
    assert.ok(
      fetched.every((file) => !file.endsWith('.glb')),
      `fetched ${fetched}`,
    );
    const solids = sections.tissues.solids.solids;
    const learning = model.layers.get('learning')!.meshes;
    const cord = model.layers.get('zanatomy')!.meshes;
    const wedges = model.ribbonWedges.get('destrieux')!;
    const shared = new Set(
      [...model.envelopes!, ...learning, ...cord, ...wedges].map((mesh) => mesh.geometry),
    );
    assert.equal(
      solids.length,
      model.envelopes!.length + learning.length + cord.length + wedges.length,
    );
    assert.ok(
      solids.every((solid) => shared.has(solid.source.geometry)),
      'every cut solid shares a model geometry',
    );
    const nucleus = solids.find((solid) => solid.source.userData['detail'] === 'learning')!;
    const mesh = learning.find((entry) => entry.geometry === nucleus.source.geometry)!;
    assert.ok(
      (
        nucleus.source.material as unknown as { color: { equals(other: unknown): boolean } }
      ).color.equals(model.sourceColors.get(mesh)),
      'a nucleus keeps its published colour',
    );
    assert.notEqual(nucleus.source.material, mesh.material);
    const ribbonFetches = fetched.filter((file) => file.endsWith('.labels')).length;
    assert.equal(await model.ensureRibbonWedges('destrieux', base), wedges);
    assert.equal(
      fetched.filter((file) => file.endsWith('.labels')).length,
      ribbonFetches,
      'wedges are kept per atlas',
    );

    // The linked MRI views take the T1 the cut already holds and fetch the segmentation alone.
    const before = fetched.length;
    await sections.load();
    assert.deepEqual(fetched.slice(before), ['aseg.volume']);
    assert.equal(sections.volumes!.mri, sections.tissues.anatomy!.volume);

    // Showing the cord afterwards downloads nothing more.
    await model.setSpinalCordVisible(true);
    assert.equal(
      parsed.filter((file) => file === manifest.supplemental_layers![0]!.file).length,
      1,
    );

    sections.dispose();
    for (const geometry of shared) {
      assert.ok(
        geometry.getAttribute('position').array.length > 0,
        'the model still owns its geometry',
      );
    }
    model.dispose();
  },
);
