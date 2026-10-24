import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import { createCircuitCatalog } from './catalog.js';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const data = parse(await readFile(new URL('../../data/circuits.yaml', import.meta.url), 'utf8'));
const clinical = parse(await readFile(new URL('../../data/neuropsychology.yaml', import.meta.url), 'utf8'));
const deficitIds = clinical.deficits.map(deficit => deficit.id);
const published = await readJson('../../public/models/anatomies.json');
const manifests = await Promise.all(published.anatomies.map(({ id }) =>
  readJson(`../../public/models/${id}/manifest.json`)));

test('all nine tours resolve exact source landmarks on every published anatomy', () => {
  for (const manifest of manifests) {
    const catalog = createCircuitCatalog(data, manifest, deficitIds);
    assert.deepEqual(catalog.all.map(c => c.id), [
      'vision', 'memory', 'motor', 'hearing', 'touch', 'language', 'attention', 'cerebellar',
      'praxis',
    ]);
    assert.equal(catalog.all.reduce((count, circuit) => count + circuit.steps.length, 0), 39);
    assert.equal(catalog.contextMarginMm, 12);
    assert.equal(catalog.get('vision').steps.at(-1).region, 'hcp-mmp:left:1');
    assert.equal(catalog.get('memory').steps.at(-1).source_name, 'Thalamus');
    for (const circuit of catalog.all) {
      for (const step of circuit.steps) assert.ok(catalog.step(circuit.id, step.id));
      assert.ok(catalog.reference(circuit.references[0]).url.startsWith('https://'));
    }
  }
});

test('hearing uses the dorsal geniculate label without substituting a ventral relay', () => {
  for (const manifest of manifests) {
    const catalog = createCircuitCatalog(data, manifest, deficitIds);
    const hearing = catalog.get('hearing');
    assert.equal(hearing.steps[1].source_name, 'Dorsal medial geniculate nucleus');
    assert.equal(hearing.steps.at(-1).region, 'hcp-mmp:left:24');
  }
});

test('cerebellar output changes to contralateral thalamus after the left peduncle', () => {
  for (const manifest of manifests) {
    const catalog = createCircuitCatalog(data, manifest, deficitIds);
    const regions = new Map(manifest.regions.map(region => [region.id, region]));
    const circuit = catalog.get('cerebellar');
    // Where the brain publishes lobules, a lobule is the landmark and the left ones cover the dentate.
    if (regions.has('learning:lobule-v-left')) {
      assert.equal(circuit.steps[0].region, 'learning:lobule-v-left');
      assert.equal(circuit.steps[1].covering_regions.length, 10);
      assert.ok(circuit.steps[1].covering_regions.every(id => regions.get(id).hemisphere === 'left'));
    } else {
      assert.equal(circuit.steps[0].region, 'learning:cerebellar-cortex-left');
      assert.deepEqual(circuit.steps[1].covering_regions, ['learning:cerebellar-cortex-left']);
    }
    assert.deepEqual(circuit.steps[0].restores, circuit.steps[1].covering_regions);
    assert.deepEqual(circuit.steps.map(step => regions.get(step.region).hemisphere),
      ['left', 'left', 'left', 'right', 'right']);
    assert.equal(circuit.steps[2].source_name, 'Superior cerebellar peduncle');
    assert.equal(circuit.steps[3].source_name, 'Thalamus');
    assert.equal(circuit.steps[4].source_name, 'R_4_ROI');
  }
});

test('praxis visits the Grasp system, then the Use system, on the left hemisphere only', () => {
  for (const manifest of manifests) {
    const catalog = createCircuitCatalog(data, manifest, deficitIds);
    const regions = new Map(manifest.regions.map(region => [region.id, region]));
    const circuit = catalog.get('praxis');
    assert.equal(circuit.deficit, 'apraxia');
    assert.ok(circuit.steps.every(step => regions.get(step.region).hemisphere === 'left'));
    assert.deepEqual(circuit.steps.map(step => step.source_name),
      ['L_MIP_ROI', 'L_6a_ROI', 'L_MT_ROI', 'L_PFt_ROI', 'L_6v_ROI', 'G_temporal_middle']);
  }
});

test('covering geometry must be a different structure in the landmark’s atlas and hemisphere', () => {
  for (const coveringRegions of [
    ['missing'], ['learning:left:dentate'], ['learning:right:dentate'], ['hcp-mmp:left:24'], [],
  ]) {
    const invalid = structuredClone(data);
    const step = invalid.circuits.find(circuit => circuit.id === 'cerebellar').steps[1];
    delete step.alternatives;
    step.covering_regions = coveringRegions;
    assert.throws(() => createCircuitCatalog(invalid, manifests[0], deficitIds), /covering/i);
  }
});

test('a landmark with alternatives resolves to exactly one of them in each anatomy', () => {
  for (const manifest of manifests) {
    const both = structuredClone(data);
    const step = both.circuits.find(circuit => circuit.id === 'cerebellar').steps[2];
    step.alternatives = [{ name: step.name }];
    assert.throws(() => createCircuitCatalog(both, manifest, deficitIds), /2 forms/);
    const neither = structuredClone(data);
    const cortex = neither.circuits.find(circuit => circuit.id === 'cerebellar').steps[0];
    cortex.alternatives[0].region = 'learning:missing';
    cortex.region = 'learning:missing';
    assert.throws(() => createCircuitCatalog(neither, manifest, deficitIds), /0 forms/);
  }
});

test('incorrect source mappings and missing bilingual content fail visibly', () => {
  const invalid = structuredClone(data);
  invalid.circuits[0].steps[0].source_name = 'Invented tract';
  assert.throws(() => createCircuitCatalog(invalid, manifests[0], deficitIds), /source/i);
  const untranslated = structuredClone(data);
  delete untranslated.circuits[0].steps[0].explanation.fr;
  assert.throws(() => createCircuitCatalog(untranslated, manifests[0], deficitIds), /fr/);
});

test('invalid references, planes and clinical targets are rejected', () => {
  for (const change of [
    d => { d.circuits[0].references = ['missing']; },
    d => { d.circuits[0].steps[0].plane = 'invented'; },
    d => { d.circuits[0].deficit = 'invented'; },
    d => { d.circuits.push(d.circuits[0]); },
    d => { d.context_margin_mm = -1; },
    d => { d.circuits[0].name.extra = 'unquoted comma'; },
    d => { delete d.references[0].nbk; },
    d => { d.references.find(r => r.pmcid).pmcid = '5608081'; },
  ]) {
    const invalid = structuredClone(data);
    change(invalid);
    assert.throws(() => createCircuitCatalog(invalid, manifests[0], deficitIds));
  }
  const catalog = createCircuitCatalog(data, manifests[0], deficitIds);
  assert.throws(() => catalog.get('missing'), /Unknown circuit/);
  assert.throws(() => catalog.step('vision', 'missing'), /Unknown landmark/);
});
