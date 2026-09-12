import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  DoubleSide,
  Raycaster,
  Vector3,
} from 'three';
import { BrainSections } from './sections.js';

function fixture() {
  const region = { id: 'aseg:left:10', kind: 'structure', source_label_id: 10 };
  const model = Object.assign(new EventTarget(), {
    clippingPlanes: [],
    state: { atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1 },
    regions: new Map([[region.id, region]]),
    setCutState(cut) {
      this.cut = cut;
    },
    setClippingPlanes(planes) {
      this.clippingPlanes = planes;
      this.dispatchEvent(new Event('change'));
    },
    intersect() {
      return null;
    },
  });
  const tissues = {
    group: new Group(),
    async load() {},
    layers: new Map([['destrieux', {}]]),
    update() {},
    intersect() {
      return null;
    },
    dispose() {},
  };
  return {
    model,
    tissues,
    sections: new BrainSections(model, new URL('https://example.invalid/volumes.json'), tissues),
    region,
  };
}

test('GPU cut plane preserves fractional coordinates and reverse-side clipping', async () => {
  const { sections, model } = fixture();
  await sections.setMode('coronal');
  sections.setOffset(0.5);
  await sections.update();
  assert.ok(Math.abs(model.clippingPlanes[0].distanceToPoint(new Vector3(0, 0, -0.0005))) < 1e-12);
  sections.setDisplay({ reverse: true });
  await sections.update();
  assert.ok(model.clippingPlanes[0].distanceToPoint(new Vector3(0, 0, -0.001)) > 0);
  await sections.setMode('off');
  assert.equal(sections.group.visible, false);
  assert.deepEqual(model.clippingPlanes, []);
  sections.dispose();
});

test('cut picking uses categorical source region IDs without opening the MRI reference', async () => {
  const { sections, tissues, region } = fixture();
  const mesh = new Mesh(
    new PlaneGeometry(0.02, 0.02),
    new MeshStandardMaterial({ side: DoubleSide }),
  );
  mesh.userData.region_id = region.id;
  tissues.group.add(mesh);
  tissues.intersect = (raycaster) => {
    const hit = raycaster.intersectObject(mesh)[0];
    return hit ? { ...hit, region } : null;
  };
  await sections.setMode('coronal');
  assert.equal(sections.volumes, null);
  assert.equal(
    sections.pick(new Raycaster(new Vector3(0, 0, 0.1), new Vector3(0, 0, -1))).id,
    region.id,
  );
  sections.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test('latest mode wins when the tissue volume load is still pending', async () => {
  const { sections, tissues } = fixture();
  let resolve;
  tissues.load = () =>
    new Promise((done) => {
      resolve = done;
    });
  const loading = sections.setMode('coronal');
  await sections.setMode('off');
  resolve();
  await loading;
  assert.equal(sections.state.mode, 'off');
  sections.dispose();
});

test('distant crosshair cannot invalidate an allowed oblique offset', async () => {
  const { sections } = fixture();
  await sections.setMode('oblique');
  sections.setAngles(45, 0);
  sections.setCrosshair([100, 0, -100]);
  sections.setOffset(60);
  await sections.update();
  assert.ok(sections.state.crosshair.every((value) => Math.abs(value) <= 128));
  assert.ok(
    Math.abs(new Vector3(...sections.state.crosshair).dot(sections.frame.normal) - 60) < 1e-10,
  );
  sections.dispose();
});

test('dragging reuses the attached clipping plane instead of updating all surface materials', async () => {
  const { sections, model } = fixture();
  await sections.setMode('axial');
  const planes = model.clippingPlanes;
  let changes = 0;
  model.addEventListener('change', () => changes++);
  for (let offset = -30; offset <= 30; offset += 0.5) sections.setOffset(offset);
  assert.equal(model.clippingPlanes, planes);
  assert.equal(changes, 0);
  assert.ok(Math.abs(planes[0].distanceToPoint(new Vector3(0, 0.03, 0))) < 1e-12);
  sections.dispose();
});

test('an unselectable tissue cut blocks selecting a surface behind it', async () => {
  const { sections, model, tissues, region } = fixture();
  model.intersect = () => ({ distance: 0.2, object: { userData: { region_id: region.id } } });
  tissues.intersect = () => ({ distance: 0.1, region: null });
  await sections.setMode('coronal');
  assert.equal(sections.pick(new Raycaster()), null);
  tissues.intersect = () => null;
  assert.equal(sections.pick(new Raycaster()), region);
  sections.dispose();
});
