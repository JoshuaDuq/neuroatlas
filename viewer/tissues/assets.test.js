import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPalette } from './palette.js';

const directory = new URL('../../public/models/', import.meta.url);

test('cut palettes match every corresponding exported surface material', async () => {
  const metadata = JSON.parse(await readFile(new URL('tissue-labels.json', directory), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  // Cut-only regions have no mesh by construction, so there is no surface
  // material for them to agree with; their colour is checked separately below.
  const meshless = new Set(
    manifest.regions.filter((region) => region.kind === 'tissue-region').map((r) => r.id),
  );
  const materials = new Map();
  // nextbrain.glb is optional: it exists only where the warped volume does.
  const files = ['cortex-destrieux.glb', 'cortex-hcp-mmp.glb', 'structures.glb'];
  if (manifest.detail_levels.some((level) => level.file === 'nextbrain.glb')) {
    files.push('nextbrain.glb');
  }
  for (const file of files) {
    const bytes = await readFile(new URL(file, directory));
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    scene.traverse((mesh) => {
      if (!mesh.isMesh) return;
      materials.set(mesh.userData.region_id, mesh.material.color.toArray());
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
  }
  for (const record of Object.values(metadata.atlases)) {
    const palette = createPalette(record.labels, {
      hemisphere: 'both',
      atlasColors: true,
      cortexVisible: true,
      cortexOpacity: 1,
    }, manifest.appearance.tissue);
    for (const [code, label] of record.labels.entries()) {
      if (!label.region_id || meshless.has(label.region_id)) continue;
      const expected = materials.get(label.region_id);
      assert.ok(expected, label.region_id);
      expected.forEach((component, axis) =>
        assert.ok(Math.abs(component - palette[code * 4 + axis]) < 1e-6, label.region_id),
      );
    }
  }
});

test('cut-only palettes carry their published table colour unchanged', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const metadata = JSON.parse(await readFile(new URL('tissue-labels.json', directory), 'utf8'));
  const record = metadata.atlases.nextbrain;
  if (!record) return; // The warped volume is an optional source.
  const palette = createPalette(record.labels, {
    hemisphere: 'both',
    atlasColors: true,
    cortexVisible: true,
    cortexOpacity: 1,
  }, manifest.appearance.tissue);
  for (const [code, label] of record.labels.entries()) {
    label.color.forEach((component, axis) =>
      assert.ok(
        Math.abs(component / 255 - palette[code * 4 + axis]) < 1e-6,
        `${label.name} channel ${axis}`,
      ),
    );
  }
});
