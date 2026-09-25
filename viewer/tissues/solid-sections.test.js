import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Plane, Raycaster, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { HIGHLIGHT_LIFT } from './highlight.js';
import { createSolidMaterial } from './solid-material.js';
import { SolidSections } from './solid-sections.js';

function fixture() {
  const source = new Mesh(new BoxGeometry(0.1, 0.1, 0.1),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.userData = { hemisphere: 'left', boundary: 'pial' };
  const sections = new SolidSections();
  sections.add(source, new MeshBasicMaterial(), 0);
  return { sections, source };
}

const plane = new Plane(new Vector3(0, 0, -1), 0);

test('caps reach the lower spinal cord in every orientation and retained side', () => {
  const source = new Mesh(new BoxGeometry(0.012, 0.48, 0.01),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.position.set(0.002, -0.3, 0.038);
  source.userData.region_id = 'zanatomy:midline:cord';
  const sections = new SolidSections();
  sections.add(source, new MeshBasicMaterial(), 2);
  const point = new Vector3(0.002, -0.5, 0.038);
  for (const normal of [new Vector3(1, 0, 0), new Vector3(0, 1, 0),
    new Vector3(0, 0, 1), new Vector3(1, 1, 1).normalize()]) {
    for (const side of [-1, 1]) {
      const direction = normal.clone().multiplyScalar(side);
      sections.update(new Plane().setFromNormalAndCoplanarPoint(direction, point));
      const ray = new Raycaster(point.clone().addScaledVector(direction, 0.1), direction.negate());
      assert.equal(sections.intersect(ray)?.region, 'zanatomy:midline:cord');
    }
  }
  sections.dispose();
});

function drawnTriangles(mesh) {
  if (!mesh.visible) return 0;
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const range = geometry.drawRange;
  const available = index ? index.count : position.count;
  const count = range.count === Infinity ? available : Math.min(available - range.start, range.count);
  return count / 3;
}

test('a background build draws the same cap as the synchronous one', { timeout: 20000 }, async () => {
  const { sections } = fixture();
  sections.update(plane);
  const ray = new Raycaster(new Vector3(0, 0, 0.2), new Vector3(0, 0, -1));
  assert.ok(sections.intersect(ray));
  const generation = sections.generation;
  const built = await sections.build(plane);
  if (built) {
    assert.equal(sections.applyBuild(plane, built, generation), true);
    assert.ok(sections.intersect(ray));
    assert.equal(sections.intersect(new Raycaster(
      new Vector3(0.08, 0, 0.2), new Vector3(0, 0, -1))), null);
  }
  sections.dispose();
});

test('a cut draws the plane section instead of stencilling the whole solid', () => {
  const source = new Mesh(new BoxGeometry(0.1, 0.1, 0.1, 18, 18, 18),
    new MeshBasicMaterial({ side: DoubleSide }));
  source.userData = { hemisphere: 'left', boundary: 'pial' };
  const sections = new SolidSections();
  sections.add(source, new MeshBasicMaterial(), 0);
  sections.update(plane);
  const [solid] = sections.solids;
  const sourceTriangles = source.geometry.index.count / 3;
  const drawn = drawnTriangles(solid.back) + drawnTriangles(solid.front) + drawnTriangles(solid.cap);
  assert.equal(solid.back.visible, false);
  assert.equal(solid.front.visible, false);
  assert.equal(solid.cap.material.stencilWrite, false);
  assert.ok(drawn > 0 && drawn < sourceTriangles / 5,
    `drew ${drawn} triangles from a ${sourceTriangles}-triangle solid`);
  assert.ok(sections.intersect(new Raycaster(new Vector3(0, 0, 0.2), new Vector3(0, 0, -1))));
  assert.equal(sections.intersect(new Raycaster(
    new Vector3(0.08, 0, 0.2), new Vector3(0, 0, -1))), null);
  sections.dispose();
});

test('cut hits are inside closed anatomy, from either retained side', () => {
  const { sections } = fixture();
  sections.update(plane);
  for (const direction of [-1, 1]) {
    const ray = new Raycaster(new Vector3(0.012, 0.009, -direction * 0.2),
      new Vector3(0, 0, direction));
    assert.ok(sections.intersect(ray));
    ray.ray.origin.x = 0.08;
    assert.equal(sections.intersect(ray), null);
  }
  sections.update(new Plane(new Vector3(0, 0, 1), -0.06));
  assert.equal(sections.intersect(new Raycaster(new Vector3(0, 0, 0.2),
    new Vector3(0, 0, -1))), null);
  sections.dispose();
});

test('a solid the plane misses is not drawn', () => {
  const { sections } = fixture();
  sections.update(new Plane(new Vector3(0, 0, -1), 0.4));
  assert.equal(sections.solids[0].group.visible, false);
  sections.update(plane);
  assert.equal(sections.solids[0].group.visible, true);
  sections.dispose();
});

test('a cut hit names the solid it landed in', () => {
  const { sections, source } = fixture();
  sections.update(plane);
  const hit = sections.intersect(new Raycaster(new Vector3(0.012, 0.009, 0.2),
    new Vector3(0, 0, -1)));
  assert.equal(hit.source, source);
});

const appearance = parse(
  readFileSync(new URL('../../config/model.yaml', import.meta.url), 'utf8')).appearance;

function parcels(...regions) {
  const sections = new SolidSections();
  for (const region of regions) {
    const source = new Mesh(new BoxGeometry(0.1, 0.1, 0.1),
      new MeshBasicMaterial({ side: DoubleSide }));
    source.userData = { hemisphere: 'left', kind: 'ribbon', region_id: region };
    sections.add(source, createSolidMaterial({}, appearance), 1);
  }
  return sections;
}

test('only the highlighted region lifts, and the solid keeps its painted colour', () => {
  const sections = parcels('destrieux:left:2', 'destrieux:left:9');
  const [quiet, lit] = sections.solids;
  lit.cap.material.color.set('#123456');
  sections.highlight({ hovered: 'destrieux:left:9' });
  assert.equal(quiet.cap.material.userData.highlightLift.value, 0);
  assert.equal(lit.cap.material.userData.highlightLift.value, HIGHLIGHT_LIFT.hovered);
  assert.equal(lit.cap.material.color.getHexString(), '123456');
  sections.dispose();
});

test('moving off a region puts its cut face back', () => {
  const sections = parcels('destrieux:left:2');
  const [solid] = sections.solids;
  sections.highlight({ hovered: 'destrieux:left:2' });
  sections.highlight({});
  assert.equal(solid.cap.material.userData.highlightLift.value, 0);
  sections.dispose();
});

test('a cut hit names the region its cap was painted as', () => {
  const sections = parcels('destrieux:left:2');
  const [solid] = sections.solids;
  solid.region = 'nextbrain:right:10119';
  sections.update(plane);
  const hit = sections.intersect(new Raycaster(new Vector3(0.012, 0.009, 0.2),
    new Vector3(0, 0, -1)));
  assert.equal(hit.region, 'nextbrain:right:10119');
  sections.dispose();
});

test('nested solids order enclosing first with tiered polygon offsets and bit-identical cap planes', () => {
  const outer = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial({ side: DoubleSide }));
  outer.userData = { segmentation_volume_mm3: 8000, region_id: 'cord' };
  const inner = new Mesh(new BoxGeometry(0.05, 0.05, 0.05), new MeshBasicMaterial({ side: DoubleSide }));
  inner.userData = { segmentation_volume_mm3: 125, region_id: 'tract' };

  const sections = new SolidSections();
  sections.add(inner, new MeshBasicMaterial(), 2);
  sections.add(outer, new MeshBasicMaterial(), 2);

  assert.equal(sections.solids[0].region, 'cord');
  assert.equal(sections.solids[1].region, 'tract');

  assert.equal(sections.solids[0].group.renderOrder, 1);
  assert.equal(sections.solids[1].group.renderOrder, 2);
  assert.equal(sections.solids[0].cap.material.polygonOffsetUnits, -1);
  assert.equal(sections.solids[1].cap.material.polygonOffsetUnits, -2);
  assert.ok(sections.solids[1].cap.material.polygonOffsetUnits < sections.solids[0].cap.material.polygonOffsetUnits);

  sections.update(plane);
  const [solidOuter, solidInner] = sections.solids;
  assert.ok(solidOuter.cap.position.equals(solidInner.cap.position));
  assert.ok(solidOuter.cap.quaternion.equals(solidInner.cap.quaternion));
  assert.ok(solidOuter.cap.scale.equals(solidInner.cap.scale));

  sections.dispose();
});

