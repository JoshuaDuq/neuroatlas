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

test('solid caps use the exact source geometry and ordered stencil passes', () => {
  const { sections, source } = fixture();
  const [solid] = sections.solids;
  sections.update(plane);
  assert.equal(solid.back.geometry, source.geometry);
  assert.equal(solid.front.geometry, source.geometry);
  assert.ok(solid.back.renderOrder < solid.front.renderOrder);
  assert.ok(solid.front.renderOrder < solid.cap.renderOrder);
  assert.equal(solid.back.material.colorWrite, false);
  assert.equal(solid.back.material.depthWrite, false);
  assert.equal(solid.back.material.clippingPlanes[0], sections.plane);
  assert.equal(solid.cap.material.stencilWrite, true);
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
