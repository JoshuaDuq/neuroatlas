import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { test } from 'vitest';
import { asDisplaySettings, readModel } from '../../core/catalog/test-support.ts';
import type { Region } from '../../types/index.ts';
import type { Appearance } from '../render/materials.ts';
import { createWhiteMatterSurfaces, exposedWhiteMatter } from './white-matter-surfaces.ts';

const { appearance } = readModel<{ appearance: Appearance }>('cdmd/manifest.json');

const region = (id: string, atlas: string, hemisphere: string) =>
  ({ id, atlas, hemisphere, kind: 'cortex' }) as Region;
const regions = new Map([
  ['d-left', region('d-left', 'destrieux', 'left')],
  ['h-left', region('h-left', 'hcp-mmp', 'left')],
]);
const state = (fields: object) =>
  asDisplaySettings({
    cortexVisible: true,
    cortexOpacity: 1,
    isolatedRegion: null,
    hiddenRegions: new Set(['d-left']),
    atlas: 'destrieux',
    hemisphere: 'both',
    ...fields,
  });

test('TISSUE-37 hiding a parcel of the shown atlas lays open the white matter of its hemisphere only', () => {
  assert.deepEqual([...exposedWhiteMatter(state({}), regions)], ['left']);
  assert.deepEqual([...exposedWhiteMatter(state({ hemisphere: 'right' }), regions)], []);
  assert.deepEqual([...exposedWhiteMatter(state({ atlas: 'hcp-mmp' }), regions)], []);
  assert.deepEqual([...exposedWhiteMatter(state({ cortexOpacity: 0 }), regions)], []);
  assert.deepEqual([...exposedWhiteMatter(state({ isolatedRegion: 'd-left' }), regions)], []);
  assert.throws(() => exposedWhiteMatter(state({ hiddenRegions: new Set(['nope']) }), regions), {
    message: 'Hidden region nope is not in the region index.',
  });
});

test('TISSUE-38 the exposed white surface is white tissue that follows the cortex opacity', () => {
  const root = new Group();
  for (const hemisphere of ['left', 'right']) {
    const mesh = new Mesh(new BoxGeometry(0.01, 0.01, 0.01), new MeshBasicMaterial());
    mesh.userData = { hemisphere, boundary: 'white' };
    root.add(mesh);
  }
  const surfaces = createWhiteMatterSurfaces(root, appearance);
  const [left, right] = surfaces.meshes;
  assert.equal(left!.material.color.getHexString(), 'e5dbc5');
  assert.equal(left!.userData['kind'], 'non-region');
  assert.equal(surfaces.group.visible, false);

  surfaces.update(state({ cortexOpacity: 0.4 }), regions, null);
  assert.equal(left!.visible, true);
  assert.equal(right!.visible, false);
  assert.equal(left!.material.opacity, 0.4);
  assert.equal(left!.material.transparent, true);
  assert.equal(left!.material.depthWrite, false);
  surfaces.update(state({}), regions, null);
  assert.equal(left!.material.opacity, 1);
  assert.equal(left!.material.transparent, false);
  assert.equal(left!.material.depthWrite, true);

  assert.throws(() => createWhiteMatterSurfaces(new Group(), appearance), {
    message: 'Expected one native left white-matter surface.',
  });
});
