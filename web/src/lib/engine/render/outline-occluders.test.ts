/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BoxGeometry, Mesh, PerspectiveCamera, Scene, Vector2 } from 'three';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { withOutlineOccluders } from './outline-occluders.ts';

function fixture() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 10;
  const box = (x: number, z: number, size = 1) => {
    const mesh = new Mesh(new BoxGeometry(size, size, size));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    return mesh;
  };
  const selected = box(0, 0);
  const blocking = box(0, 3);
  const beside = box(4, 0);
  const behind = box(0, -5);
  const pass = new OutlinePass(new Vector2(512, 512), scene, camera, [selected]);
  return { scene, camera, box, selected, blocking, beside, behind, pass };
}

test('outline depth only submits objects that can overlap the selection', () => {
  const { pass, selected, blocking, beside, behind } = fixture();
  withOutlineOccluders(pass, () => {
    assert.equal(selected.visible, true);
    assert.equal(blocking.visible, true);
    assert.equal(behind.visible, true);
    assert.equal(beside.visible, false);
  });
  assert.equal(beside.visible, true);
});

test('visibility is restored even when rendering fails, including previously hidden objects', () => {
  const { pass, beside, behind } = fixture();
  behind.visible = false;
  assert.throws(
    () =>
      withOutlineOccluders(pass, () => {
        assert.equal(beside.visible, false);
        throw new Error('lost context');
      }),
    /lost context/,
  );
  assert.equal(beside.visible, true);
  assert.equal(behind.visible, false);
});

test('an occluder whose bounds touch the selection is retained', () => {
  const { pass, box } = fixture();
  const touching = box(1, 0);
  withOutlineOccluders(pass, () => assert.equal(touching.visible, true));
});

test('selection crossing the near plane keeps the complete scene', () => {
  const { pass, camera, beside } = fixture();
  camera.position.z = 0.55;
  withOutlineOccluders(pass, () => assert.equal(beside.visible, true));
});

test('all selected objects and their possible occluders stay visible', () => {
  const { pass, box, beside } = fixture();
  pass.selectedObjects.push(beside);
  const blockingSecond = box(3, 3);
  withOutlineOccluders(pass, () => {
    assert.equal(beside.visible, true);
    assert.equal(blockingSecond.visible, true);
  });
});

test('a parent mesh cannot hide a child that overlaps the selection', () => {
  const { pass, beside, box } = fixture();
  const child = box(0, 0);
  beside.add(child);
  child.position.x = -4;
  withOutlineOccluders(pass, () => assert.equal(beside.visible, true));
});

test('an elongated structure outside the outline is culled even when its sphere overlaps', () => {
  const { pass, beside } = fixture();
  beside.scale.y = 20;
  withOutlineOccluders(pass, () => assert.equal(beside.visible, false));
  assert.equal(beside.visible, true);
});
