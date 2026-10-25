import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import { manifests } from '../clinical/test-support.ts';
import type { ClinicalData } from '../clinical/types.ts';
import { createCircuitCatalog } from './catalog.ts';
import type { AuthoredCircuit, CircuitData } from './catalog.ts';

const data = readRepoYaml<CircuitData>('data/circuits.yaml');
const deficitIds = readRepoYaml<ClinicalData>('data/neuropsychology.yaml').deficits.map(
  (deficit) => deficit.id,
);
const published = manifests.map(([, manifest]) => manifest);

const clone = () => structuredClone(data) as { -readonly [K in keyof CircuitData]: any };
const circuitOf = (
  copy: ReturnType<typeof clone>,
  id: string,
): AuthoredCircuit & Record<string, any> =>
  copy.circuits.find((circuit: AuthoredCircuit) => circuit.id === id);
const create = (copy: object, manifest = published[0]) =>
  createCircuitCatalog(copy as CircuitData, manifest, deficitIds);

test('all nine tours resolve exact source landmarks on every published anatomy', () => {
  for (const manifest of published) {
    const catalog = create(data, manifest);
    assert.deepEqual(
      catalog.all.map((c) => c.id),
      [
        'vision',
        'memory',
        'motor',
        'hearing',
        'touch',
        'language',
        'attention',
        'cerebellar',
        'praxis',
      ],
    );
    assert.equal(
      catalog.all.reduce((count, circuit) => count + circuit.steps.length, 0),
      39,
    );
    assert.equal(catalog.contextMarginMm, 12);
    assert.equal(catalog.get('vision').steps.at(-1)!.region, 'hcp-mmp:left:1');
    assert.equal(catalog.get('memory').steps.at(-1)!.source_name, 'Thalamus');
    for (const circuit of catalog.all) {
      for (const step of circuit.steps) assert.ok(catalog.step(circuit.id, step.id));
      assert.ok(catalog.reference(circuit.references[0]).url.startsWith('https://'));
    }
  }
});

test('hearing uses the dorsal geniculate label without substituting a ventral relay', () => {
  for (const manifest of published) {
    const hearing = create(data, manifest).get('hearing');
    assert.equal(hearing.steps[1].source_name, 'Dorsal medial geniculate nucleus');
    assert.equal(hearing.steps.at(-1)!.region, 'hcp-mmp:left:24');
  }
});

test('cerebellar output changes to contralateral thalamus after the left peduncle', () => {
  for (const manifest of published) {
    const regions = new Map(manifest.regions.map((region) => [region.id, region]));
    const circuit = create(data, manifest).get('cerebellar');
    // Where the brain publishes lobules, a lobule is the landmark and the left ones cover the dentate.
    if (regions.has('learning:lobule-v-left')) {
      assert.equal(circuit.steps[0].region, 'learning:lobule-v-left');
      assert.equal(circuit.steps[1].covering_regions!.length, 10);
      assert.ok(
        circuit.steps[1].covering_regions!.every((id) => regions.get(id)!.hemisphere === 'left'),
      );
    } else {
      assert.equal(circuit.steps[0].region, 'learning:cerebellar-cortex-left');
      assert.deepEqual(circuit.steps[1].covering_regions, ['learning:cerebellar-cortex-left']);
    }
    assert.deepEqual(circuit.steps[0].restores, circuit.steps[1].covering_regions);
    assert.deepEqual(
      circuit.steps.map((step) => regions.get(step.region)!.hemisphere),
      ['left', 'left', 'left', 'right', 'right'],
    );
    assert.equal(circuit.steps[2].source_name, 'Superior cerebellar peduncle');
    assert.equal(circuit.steps[3].source_name, 'Thalamus');
    assert.equal(circuit.steps[4].source_name, 'R_4_ROI');
  }
});

test('praxis visits the Grasp system, then the Use system, on the left hemisphere only', () => {
  for (const manifest of published) {
    const regions = new Map(manifest.regions.map((region) => [region.id, region]));
    const circuit = create(data, manifest).get('praxis');
    assert.equal(circuit.deficit, 'apraxia');
    assert.ok(circuit.steps.every((step) => regions.get(step.region)!.hemisphere === 'left'));
    assert.deepEqual(
      circuit.steps.map((step) => step.source_name),
      ['L_MIP_ROI', 'L_6a_ROI', 'L_MT_ROI', 'L_PFt_ROI', 'L_6v_ROI', 'G_temporal_middle'],
    );
  }
});

test('covering geometry must be a different structure in the landmark’s atlas and hemisphere', () => {
  for (const coveringRegions of [
    ['missing'],
    ['learning:left:dentate'],
    ['learning:right:dentate'],
    ['hcp-mmp:left:24'],
    [],
  ]) {
    const invalid = clone();
    const step = circuitOf(invalid, 'cerebellar').steps[1] as Record<string, any>;
    delete step.alternatives;
    step.covering_regions = coveringRegions;
    assert.throws(() => create(invalid), /covering/i);
  }
});

describe('a landmark with alternatives resolves to exactly one of them in each anatomy', () => {
  for (const [id, manifest] of manifests) {
    test(id, () => {
      const both = clone();
      const step = circuitOf(both, 'cerebellar').steps[2] as Record<string, any>;
      step.alternatives = [{ name: step.name }];
      assert.throws(() => create(both, manifest), /2 forms/);
      const neither = clone();
      const cortex = circuitOf(neither, 'cerebellar').steps[0] as Record<string, any>;
      cortex.alternatives[0].region = 'learning:missing';
      cortex.region = 'learning:missing';
      assert.throws(() => create(neither, manifest), /0 forms/);
    });
  }
});

test('incorrect source mappings and missing bilingual content fail visibly', () => {
  const invalid = clone();
  (invalid.circuits[0].steps[0] as Record<string, any>).source_name = 'Invented tract';
  assert.throws(() => create(invalid), /source/i);
  const untranslated = clone();
  delete untranslated.circuits[0].steps[0].explanation.fr;
  assert.throws(() => create(untranslated), /fr/);
});

test('invalid references, planes and clinical targets are rejected', () => {
  const changes: ((d: ReturnType<typeof clone>) => void)[] = [
    (d) => {
      d.circuits[0].references = ['missing'];
    },
    (d) => {
      d.circuits[0].steps[0].plane = 'invented';
    },
    (d) => {
      d.circuits[0].deficit = 'invented';
    },
    (d) => {
      d.circuits.push(d.circuits[0]);
    },
    (d) => {
      d.context_margin_mm = -1;
    },
    (d) => {
      d.circuits[0].name.extra = 'unquoted comma';
    },
    (d) => {
      delete d.references[0].nbk;
    },
    (d) => {
      d.references.find((r: Record<string, any>) => r.pmcid).pmcid = '5608081';
    },
  ];
  for (const change of changes) {
    const invalid = clone();
    change(invalid);
    assert.throws(() => create(invalid));
  }
  const catalog = create(data);
  assert.throws(() => catalog.get('missing'), /Unknown circuit/);
  assert.throws(() => catalog.step('vision', 'missing'), /Unknown landmark/);
});

test('a landmark’s view must be one of the camera presets', () => {
  const invalid = clone();
  (invalid.circuits[0].steps[0] as Record<string, any>).view = 'diagonal';
  assert.throws(() => create(invalid), /Unknown view: diagonal/);
});
