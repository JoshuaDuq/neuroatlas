import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPalette } from './palette.js';

const directory = new URL('../../public/models/', import.meta.url);

test('cut palettes match every corresponding exported surface material in both atlases', async () => {
  const metadata = JSON.parse(await readFile(new URL('tissue-labels.json', directory), 'utf8'));
  const materials = new Map();
  for (const file of ['cortex-destrieux.glb', 'cortex-hcp-mmp.glb', 'structures.glb']) {
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
    });
    for (const [code, label] of record.labels.entries()) {
      if (!label.region_id) continue;
      const expected = materials.get(label.region_id);
      assert.ok(expected, label.region_id);
      expected.forEach((component, axis) =>
        assert.ok(Math.abs(component - palette[code * 4 + axis]) < 1e-6, label.region_id),
      );
    }
  }
});
