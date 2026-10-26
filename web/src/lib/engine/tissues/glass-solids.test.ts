import assert from 'node:assert/strict';
import { BoxGeometry, DoubleSide, Mesh, Plane } from 'three';
import { test } from 'vitest';
import { readModel } from '../../core/catalog/test-support.ts';
import type { Appearance } from '../render/materials.ts';
import { createGlassSolids } from './glass-solids.ts';

const { appearance } = readModel<{ appearance: Appearance }>('cdmd/manifest.json');

const wedge = (id: string) => {
  const mesh = new Mesh(new BoxGeometry(0.01, 0.01, 0.01));
  mesh.userData = { region_id: id, atlas: 'a', kind: 'ribbon' };
  return mesh;
};

test('TISSUE-36 a solid region of the glass brain is closed by its ribbon solid, only while its patch is drawn', () => {
  const solids = createGlassSolids([wedge('r1'), wedge('r2')], appearance);
  assert.equal(solids.group.visible, false);
  const [first] = solids.meshes;
  assert.equal(first!.material.side, DoubleSide);
  assert.equal(first!.material.polygonOffsetFactor, 1);
  assert.equal(first!.material.polygonOffsetUnits, 1);
  assert.equal(first!.material.clearcoat, 0.08);

  const planes = [new Plane()];
  solids.update({
    solidOf: (id) => (id === 'r1' ? { color: [255, 0, 0] } : null),
    shown: () => true,
    clippingPlanes: planes,
  });
  const [one, two] = solids.meshes;
  assert.equal(one!.visible, true);
  assert.deepEqual(one!.material.color.toArray(), [1, 0, 0]);
  assert.equal(two!.visible, false, 'no solid record: hidden');
  assert.equal(one!.material.clippingPlanes, planes);
  assert.equal(solids.group.visible, true);

  solids.update({
    solidOf: () => ({ color: [255, 0, 0] }),
    shown: (id) => id === 'r2',
    clippingPlanes: null,
  });
  assert.equal(one!.visible, false, 'patch not drawn: hidden');
  assert.equal(two!.visible, true);

  solids.update({
    solidOf: () => ({ color: [255, 0, 0] }),
    shown: () => false,
    clippingPlanes: null,
  });
  assert.equal(solids.group.visible, false);
});
