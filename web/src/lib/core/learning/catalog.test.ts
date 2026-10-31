import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import { manifests } from '../clinical/test-support.ts';
import type { ClinicalData } from '../clinical/types.ts';
import { ownTractIds } from '../diffusion/catalogs.ts';
import { createCircuitCatalog } from './catalog.ts';
import type { AuthoredCircuit, CircuitData } from './catalog.ts';

const data = readRepoYaml<CircuitData>('data/circuits.yaml');
const archived = readRepoYaml<CircuitData & { withheld_pending_rework: string[] }>(
  'data/archived-circuit-tours.yaml',
);
const clinical = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');
const deficitIds = clinical.deficits.map((deficit) => deficit.id);
const published = manifests.map(([, manifest]) => manifest);

const clone = () => structuredClone(data) as { -readonly [K in keyof CircuitData]: any };
const circuitOf = (
  copy: ReturnType<typeof clone>,
  id: string,
): AuthoredCircuit & Record<string, any> =>
  copy.circuits.find((circuit: AuthoredCircuit) => circuit.id === id);
const create = (copy: object, manifest = published[0]) =>
  createCircuitCatalog(copy as CircuitData, manifest, deficitIds, ownTractIds(manifest.anatomy.id));

test('withdrawn tours remain source-checkable in the archive and cannot be opened as active circuits', () => {
  const activeIds = new Set(data.circuits.map((circuit) => circuit.id));
  assert.equal(archived.circuits.length, 34);
  assert.deepEqual(archived.withheld_pending_rework, ['hearing', 'touch', 'valuation']);
  assert.equal(
    [...data.circuits, ...archived.circuits].reduce(
      (sum, circuit) => sum + circuit.steps.length,
      0,
    ),
    128,
  );
  for (const manifest of published) {
    const catalog = create(data, manifest);
    const archive = create(archived, manifest);
    for (const circuit of archive.all) {
      assert.ok(!activeIds.has(circuit.id), circuit.id);
      assert.throws(() => catalog.get(circuit.id), { message: `Unknown circuit: ${circuit.id}` });
    }
  }
});

test('only the five retained pathway tours resolve exact source landmarks on every published anatomy', () => {
  for (const manifest of published) {
    const catalog = create(data, manifest);
    assert.deepEqual(
      catalog.all.map((c) => c.id),
      ['vision', 'memory', 'motor', 'cerebellar', 'corticospinal'],
    );
    assert.equal(
      catalog.all.reduce((count, circuit) => count + circuit.steps.length, 0),
      25,
    );
    assert.equal(catalog.contextMarginMm, 12);
    assert.equal(catalog.get('vision').steps.at(-1)!.region, 'hcp-mmp:left:1');
    assert.equal(catalog.get('memory').steps.at(-1)!.region, 'nextbrain:left:220');
    for (const circuit of catalog.all) {
      for (const step of circuit.steps) assert.ok(catalog.step(circuit.id, step.id));
      assert.ok(catalog.reference(circuit.references[0]).url.startsWith('https://'));
    }
  }
});

test('archived hearing uses the dorsal geniculate label without substituting a ventral relay', () => {
  for (const manifest of published) {
    const hearing = create(archived, manifest).get('hearing');
    assert.equal(hearing.steps[1].source_name, 'Dorsal medial geniculate nucleus');
    assert.equal(hearing.steps.at(-1)!.region, 'hcp-mmp:left:24');
  }
});

test('cerebellar output crosses to the right red nucleus and thalamus after the left peduncle', () => {
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
    assert.deepEqual(circuit.steps[0].restores, [
      ...circuit.steps[1].covering_regions!,
      ...circuit.steps[3].covering_regions!,
    ]);
    assert.deepEqual(circuit.steps[3].covering_regions, [
      'learning:right:midbrain',
      'learning:right:vta',
    ]);
    assert.deepEqual(
      circuit.steps.map((step) => regions.get(step.region)!.hemisphere),
      ['left', 'left', 'left', 'right', 'right', 'right'],
    );
    assert.equal(circuit.steps[2].source_name, 'Superior cerebellar peduncle');
    assert.equal(circuit.steps[3].source_name, 'Red nucleus');
    assert.equal(circuit.steps[4].source_name, 'Thalamus');
    assert.equal(circuit.steps[5].source_name, 'R_4_ROI');
  }
});

test('archived praxis visits the Grasp system, then the Use system, on the left hemisphere only', () => {
  for (const manifest of published) {
    const regions = new Map(manifest.regions.map((region) => [region.id, region]));
    const circuit = create(archived, manifest).get('praxis');
    assert.equal(circuit.deficit, 'apraxia');
    assert.ok(circuit.steps.every((step) => regions.get(step.region)!.hemisphere === 'left'));
    assert.deepEqual(
      circuit.steps.map((step) => step.source_name),
      ['L_MIP_ROI', 'L_6a_ROI', 'L_MT_ROI', 'L_PFt_ROI', 'L_6v_ROI', 'G_temporal_middle'],
    );
  }
});

test('a landmark’s tract is one of the anatomy’s own bundles; corticospinal draws it down to the crossing', () => {
  const unknown = clone();
  circuitOf(unknown, 'corticospinal').steps[0].tract = 'no-such-bundle';
  assert.throws(() => create(unknown), { message: 'Unknown tract bundle: no-such-bundle' });
  assert.throws(
    () => createCircuitCatalog(data, published[0], deficitIds, []),
    { message: 'Unknown tract bundle: cst-left' },
    'an anatomy whose tracts are another subject’s draws none',
  );
  assert.deepEqual(
    create(data)
      .get('corticospinal')
      .steps.map((step) => step.tract ?? null),
    ['cst-left', 'cst-left', 'cst-left', null],
  );
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

test('clinical source roles must be declared and refer to distinct cited works', () => {
  for (const clinicalReferences of [
    undefined,
    [],
    ['missing'],
    ['memory-anatomy'],
    ['visual-pathways', 'visual-pathways'],
  ]) {
    const invalid = clone();
    invalid.circuits[0].clinical_references = clinicalReferences;
    assert.throws(() => create(invalid), /clinical references/i);
  }
});

test('every tour directly cites supporting evidence for its linked clinical deficit', () => {
  const works = new Map(
    [...data.references, ...archived.references].map((reference) => [reference.id, reference.pmid]),
  );
  for (const circuit of [...data.circuits, ...archived.circuits]) {
    const sources = circuit.clinical_references;
    assert.ok(Array.isArray(sources) && sources.length, `${circuit.id}: no clinical references`);
    const pmids = new Set(sources.map((source) => works.get(source)));
    assert.ok(
      clinical.associations.some(
        (association) =>
          association.deficit === circuit.deficit &&
          association.evidence.some(
            (evidence) =>
              evidence.role === 'supporting' &&
              pmids.has(
                clinical.references.find((reference) => reference.id === evidence.reference)!.pmid,
              ),
          ),
      ),
      `${circuit.id}: no supporting clinical source for ${circuit.deficit}`,
    );
  }
});

test('published corrections require valid DOI links and both language summaries', () => {
  for (const corrections of [
    'correction',
    [{ doi: 'invalid', summary: { en: 'Correction', fr: 'Correction' } }],
    [{ doi: '10.1093/cercor/bhl065', summary: { en: 'Correction' } }],
  ]) {
    const invalid = clone();
    invalid.references[0].corrections = corrections;
    assert.throws(() => create(invalid), /correction/i);
  }
});

const RANGE = 'Circuit context margin must be positive millimetres.';
type Copy = ReturnType<typeof clone>;
const vision = (d: Copy): Record<string, any> => circuitOf(d, 'vision');
const firstStep = (d: Copy) => vision(d).steps[0] as Record<string, any>;
const cerebellarStep = (d: Copy, index: number) =>
  circuitOf(d, 'cerebellar').steps[index] as Record<string, any>;
const regionIds = (kind: string) =>
  published[0].regions.filter((region) => region.kind === kind).map((region) => region.id);

const otherAtlasStructure = published[0].regions.find(
  (region) =>
    region.kind === 'structure' && region.atlas === 'aseg' && region.hemisphere === 'left',
)!.id;

const rejections: [string, (d: Copy) => void, string, ErrorConstructor?][] = [
  ['a blank revision date', (d) => (d.revised = ' '), 'Missing text: revised'],
  ['a numeric revision date', (d) => (d.revised = 3), 'Missing text: revised'],
  ...[0, -1, NaN, Infinity, '12'].map(
    (margin): [string, (d: Copy) => void, string, ErrorConstructor] => [
      `a context margin of ${String(margin)}`,
      (d) => (d.context_margin_mm = margin),
      RANGE,
      RangeError,
    ],
  ),
  ['no circuits', (d) => (d.circuits = []), 'Empty circuit'],
  ['circuits that are not a list', (d) => (d.circuits = null), 'Empty circuit'],
  ['no references', (d) => (d.references = []), 'Empty reference'],
  ['a blank circuit id', (d) => (vision(d).id = ''), 'Missing text: circuit.id'],
  ['a repeated circuit', (d) => d.circuits.push(vision(d)), 'Duplicate circuit: vision'],
  [
    'a repeated reference',
    (d) => d.references.push(d.references[0]),
    'Duplicate reference: visual-pathways',
  ],
  [
    'a blank reference title',
    (d) => (d.references[0].title = ''),
    'Missing text: visual-pathways.title',
  ],
  [
    'a missing reference citation',
    (d) => delete d.references[0].citation,
    'Missing text: visual-pathways.citation',
  ],
  [
    'a reference URL that is not https',
    (d) => (d.references[0].url = 'http://example.org/'),
    'Invalid reference URL: visual-pathways',
  ],
  [
    'a reference URL that does not parse',
    (d) => (d.references[0].url = 'not a url'),
    'Invalid URL',
    TypeError,
  ],
  [
    'a reference with neither PMID nor NBK accession',
    (d) => delete d.references[0].nbk,
    'Missing PMID or NBK accession: visual-pathways',
  ],
  ...['NBK', 'nbk123', 'NBK12x'].map((nbk): [string, (d: Copy) => void, string] => [
    `an NBK accession written ${nbk}`,
    (d) => (d.references[0].nbk = nbk),
    'Missing PMID or NBK accession: visual-pathways',
  ]),
  ...['5608081', 'PMC', 'pmc1'].map((pmcid): [string, (d: Copy) => void, string] => [
    `a PMCID written ${pmcid}`,
    (d) => (d.references.find((r: Record<string, any>) => r.pmcid).pmcid = pmcid),
    `Invalid PMCID: ${data.references.find((r) => (r as any).pmcid)!.id}`,
  ]),
  [
    'a circuit name without French',
    (d) => delete vision(d).name.fr,
    'Missing text: vision.name.fr',
  ],
  [
    'a circuit summary without English',
    (d) => delete vision(d).summary.en,
    'Missing text: vision.summary.en',
  ],
  [
    'a circuit route that is not a translation',
    (d) => (vision(d).route = undefined),
    'Missing text: vision.route.en',
  ],
  [
    'a circuit scope with a third language',
    (d) => (vision(d).scope.extra = 'x'),
    'Unexpected translation field: vision.scope',
  ],
  [
    'a circuit clinical note with a third language',
    (d) => (vision(d).clinical.de = 'x'),
    'Unexpected translation field: vision.clinical',
  ],
  [
    'an unknown deficit',
    (d) => (vision(d).deficit = 'invented'),
    'Unknown clinical target: invented',
  ],
  ['no circuit references', (d) => (vision(d).references = []), 'Missing references: vision'],
  [
    'circuit references that are not a list',
    (d) => (vision(d).references = undefined),
    'Missing references: vision',
  ],
  [
    'an unknown circuit reference',
    (d) => (vision(d).references = ['missing']),
    'Unknown reference: missing',
  ],
  [
    'a repeated landmark',
    (d) => vision(d).steps.push(firstStep(d) as never),
    'Duplicate vision landmark: chiasm',
  ],
  [
    'a landmark source name that differs',
    (d) => (firstStep(d).source_name = 'Invented tract'),
    'Source mismatch: learning:midline:optic-chiasm',
  ],
  [
    'a landmark region the anatomy lacks',
    (d) => (firstStep(d).region = 'learning:missing'),
    'Unknown region: learning:missing',
  ],
  [
    'a tissue region as landmark',
    (d) => Object.assign(firstStep(d), tissueRegion()),
    `Unsupported landmark: ${regionIds('tissue-region')[0]}`,
  ],
  [
    'a non-region as landmark',
    (d) => Object.assign(firstStep(d), nonRegion()),
    `Unsupported landmark: ${regionIds('non-region')[0]}`,
  ],
  [
    'a landmark name without French',
    (d) => delete firstStep(d).name.fr,
    'Missing text: chiasm.name.fr',
  ],
  [
    'a landmark role without English',
    (d) => delete firstStep(d).role.en,
    'Missing text: chiasm.role.en',
  ],
  [
    'a landmark explanation with a third language',
    (d) => (firstStep(d).explanation.extra = 'x'),
    'Unexpected translation field: chiasm.explanation',
  ],
  [
    'a landmark mapping without French',
    (d) => delete firstStep(d).mapping.fr,
    'Missing text: chiasm.mapping.fr',
  ],
  [
    'a view that is not a camera preset',
    (d) => (firstStep(d).view = 'diagonal'),
    'Unknown view: diagonal',
  ],
  [
    'a view named like an object property',
    (d) => (firstStep(d).view = 'toString'),
    'Unknown view: toString',
  ],
  ['a missing view', (d) => delete firstStep(d).view, 'Unknown view: undefined'],
  [
    'an MRI plane that is not a plane',
    (d) => (firstStep(d).plane = 'invented'),
    'Unknown MRI plane: invented',
  ],
  ['a missing MRI plane', (d) => delete firstStep(d).plane, 'Unknown MRI plane: undefined'],
  ['no covering regions', (d) => setCovering(d, []), 'Empty covering regions: dentate'],
  [
    'covering regions that are not a list',
    (d) => setCovering(d, 'x'),
    'Empty covering regions: dentate',
  ],
  [
    'an unknown covering region',
    (d) => setCovering(d, ['missing']),
    'Unknown covering region: missing',
  ],
  [
    'the landmark itself as covering region',
    (d) => setCovering(d, ['learning:left:dentate']),
    'Invalid covering region: learning:left:dentate',
  ],
  [
    'a covering region on the other side',
    (d) => setCovering(d, ['learning:right:dentate']),
    'Invalid covering region: learning:right:dentate',
  ],
  [
    'a covering region of another atlas',
    (d) => setCovering(d, ['hcp-mmp:left:24']),
    'Invalid covering region: hcp-mmp:left:24',
  ],
  [
    'a covering structure of another atlas',
    (d) => setCovering(d, [otherAtlasStructure]),
    `Invalid covering region: ${otherAtlasStructure}`,
  ],
  [
    'a covering cortex',
    (d) => setCovering(d, [regionIds('cortex')[0]]),
    `Invalid covering region: ${regionIds('cortex')[0]}`,
  ],
];

function tissueRegion() {
  const region = published[0].regions.find((r) => r.kind === 'tissue-region')!;
  return { region: region.id, source_name: region.source_name };
}
function nonRegion() {
  const region = published[0].regions.find((r) => r.kind === 'non-region')!;
  return { region: region.id, source_name: region.source_name };
}
function setCovering(d: Copy, covering: unknown) {
  const step = cerebellarStep(d, 1);
  delete step.alternatives;
  step.covering_regions = covering;
}

describe('CAT-51 · the circuit records are checked before use', () => {
  for (const [name, mutate, message, kind = Error] of rejections) {
    test(`CAT-51 · refuses ${name}`, () => {
      const invalid = clone();
      mutate(invalid);
      assert.throws(
        () => create(invalid),
        (error: Error) => {
          assert.equal(error.constructor, kind);
          assert.equal(error.message, message);
          return true;
        },
      );
    });
  }

  test('CAT-51 · accepts a margin of 0.5 mm', () => {
    const copy = clone();
    copy.context_margin_mm = 0.5;
    assert.equal(create(copy).contextMarginMm, 0.5);
  });
});

describe('CAT-52 · a landmark resolves to one form and uncovers what others cover', () => {
  test('CAT-52 · zero or two forms fail with the count and the region', () => {
    const both = clone();
    const step = cerebellarStep(both, 2);
    step.alternatives = [{ name: step.name }];
    assert.throws(() => create(both), {
      message:
        '2 forms of landmark superior-peduncle resolve in this anatomy: learning:left:superior-cerebellar-peduncle',
    });
    const neither = clone();
    const cortex = cerebellarStep(neither, 0);
    cortex.region = 'learning:missing';
    for (const alternative of cortex.alternatives) alternative.region = 'learning:missing';
    assert.throws(() => create(neither), {
      message: '0 forms of landmark cortex resolve in this anatomy: learning:missing',
    });
  });

  test('CAT-52 · published cerebellar landmarks restore what landmarks 2 and 4 cover, except their own', () => {
    const circuit = create(data).get('cerebellar');
    const lobules = circuit.steps[1].covering_regions!;
    const midbrain = circuit.steps[3].covering_regions!;
    assert.equal(circuit.steps[0].region, 'learning:lobule-v-left');
    assert.equal(lobules.length, 10);
    for (const index of [0, 2, 4, 5]) {
      assert.deepEqual(circuit.steps[index].restores, [...lobules, ...midbrain]);
    }
    assert.deepEqual(circuit.steps[1].restores, midbrain);
    assert.deepEqual(circuit.steps[3].restores, lobules);
  });
});

test('CAT-53 · the published pathways: revision, margin, 23 references, five tours with their deficits and landmark counts', () => {
  const catalog = create(data);
  assert.equal(catalog.revised, '2026-10-31');
  assert.equal(catalog.contextMarginMm, 12);
  assert.equal(data.references.length, 23);
  for (const reference of data.references) {
    assert.ok(catalog.reference(reference.id).url.startsWith('https://'), reference.id);
  }
  assert.deepEqual(
    catalog.all.map((circuit) => [circuit.id, circuit.steps.length, circuit.deficit]),
    [
      ['vision', 4, 'hemianopia'],
      ['memory', 5, 'amnesia'],
      ['motor', 6, 'parkinsonism'],
      ['cerebellar', 6, 'ataxia'],
      ['corticospinal', 4, 'hemiparesis'],
    ],
  );
});

test('archived clinical landmarks trace to cited patient evidence; the occipital face landmark has a separate stimulation source', () => {
  const references = new Map(clinical.references.map((reference) => [reference.id, reference]));
  for (const id of [
    'face-perception',
    'swallowing',
    'cerebellar-cognition',
    'tactile-recognition',
  ]) {
    const circuit = archived.circuits.find((entry) => entry.id === id);
    assert.ok(circuit, `${id}: missing tour`);
    const clinicalPmids = new Set(
      archived.references
        .filter((reference) => circuit.clinical_references.includes(reference.id))
        .map((reference) => reference.pmid),
    );
    for (const step of circuit.steps) {
      // OFA perturbation in healthy observers is circuit evidence, not a prosopagnosia lesion.
      if (id === 'face-perception' && step.id === 'occipital') {
        const stimulation = archived.references.find((reference) => reference.pmid === '17764942');
        assert.ok(stimulation && circuit.references.includes(stimulation.id));
        assert.ok(!circuit.clinical_references.includes(stimulation.id));
        assert.equal(step.region, 'destrieux:right:2');
        continue;
      }
      assert.ok(
        clinical.associations.some(
          (association) =>
            association.deficit === circuit.deficit &&
            association.mappings.some((mapping) => mapping.region === step.region) &&
            association.evidence.some((evidence) => {
              const source = references.get(evidence.reference)!;
              return (
                evidence.role === 'supporting' &&
                ['lesion-mapping', 'case-series', 'case-report'].includes(source.method) &&
                clinicalPmids.has(source.pmid)
              );
            }),
        ),
        `${id}/${step.id}: no cited patient evidence maps this deficit and region`,
      );
    }
  }
});

test('each archived deficit tour cites patient lesion evidence supporting the same deficit and a visited region', () => {
  for (const id of ['speech-planning', 'writing', 'music', 'taste', 'olfaction', 'mentalizing']) {
    const circuit = archived.circuits.find((entry) => entry.id === id)!;
    const cited = new Set(
      archived.references
        .filter((reference) => circuit.references.includes(reference.id))
        .map((reference) => reference.pmid),
    );
    const supporting = clinical.associations.filter(
      (association) =>
        association.deficit === circuit.deficit &&
        association.mappings.some((mapping) =>
          circuit.steps.some((step) => step.region === mapping.region),
        ) &&
        association.evidence.some((evidence) => {
          const reference = clinical.references.find((entry) => entry.id === evidence.reference)!;
          return (
            evidence.role === 'supporting' &&
            ['lesion-mapping', 'case-series', 'case-report'].includes(reference.method) &&
            cited.has(reference.pmid)
          );
        }),
    );
    assert.ok(supporting.length, `${id}: no cited patient lesion evidence for its deficit`);
  }
});

test('every landmark in the six archived lesion tours has cited full-text patient lesion provenance for its deficit', () => {
  const references = new Map(clinical.references.map((reference) => [reference.id, reference]));
  for (const id of [
    'extinction',
    'copying',
    'cortical-hearing',
    'oral-praxis',
    'voices',
    'pontine-motor',
  ]) {
    const circuit = archived.circuits.find((entry) => entry.id === id);
    assert.ok(circuit, `${id}: missing tour`);
    const cited = new Set(
      archived.references
        .filter((reference) => circuit.clinical_references.includes(reference.id))
        .map((reference) => reference.pmid),
    );
    for (const step of circuit.steps) {
      assert.ok(
        clinical.associations.some(
          (association) =>
            association.deficit === circuit.deficit &&
            association.mappings.some((mapping) => mapping.region === step.region) &&
            association.evidence.some((evidence) => {
              const source = references.get(evidence.reference)!;
              return (
                evidence.role === 'supporting' &&
                source.scope === 'full-text' &&
                ['lesion-mapping', 'case-series', 'case-report'].includes(source.method) &&
                cited.has(source.pmid)
              );
            }),
        ),
        `${id}/${step.id}: no cited full-text patient lesion source maps this deficit and region`,
      );
    }
  }
});

test('CAT-54 · an unknown circuit, landmark or reference fails by name', () => {
  const catalog = create(data);
  assert.throws(() => catalog.get('missing'), { message: 'Unknown circuit: missing' });
  assert.throws(() => catalog.step('missing', 'chiasm'), { message: 'Unknown circuit: missing' });
  assert.throws(() => catalog.step('vision', 'missing'), { message: 'Unknown landmark: missing' });
  assert.throws(() => catalog.reference('missing'), { message: 'Unknown reference: missing' });
});
