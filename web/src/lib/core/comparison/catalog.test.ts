import assert from 'node:assert/strict';
import { beforeAll, describe, test } from 'vitest';
import type { Manifest } from '../../types/index.ts';
import { labelOf } from '../catalog/labels.ts';
import { readModel } from '../catalog/test-support.ts';
import { createComparisonCatalog } from './catalog.ts';
import type { ComparisonData } from './catalog.ts';

const hash = (character: string) => character.repeat(64);
const ids = {
  d1: 'destrieux:left:1',
  d2: 'destrieux:left:2',
  du: 'destrieux:left:-1',
  h1: 'hcp-mmp:left:1',
  h2: 'hcp-mmp:left:2',
  hu: 'hcp-mmp:left:0',
  dr: 'destrieux:right:1',
  hr: 'hcp-mmp:right:1',
};

/** The tests mutate and malform the fixtures, so they are untyped records. */
type Fixture = { data: Record<string, any>; manifest: Record<string, any> };

function fixture(): Fixture {
  const atlases = [
    {
      id: 'destrieux',
      file: 'cortex-destrieux.glb',
      citation: 'https://doi.org/10.1016/j.neuroimage.2010.06.010',
    },
    { id: 'hcp-mmp', file: 'cortex-hcp-mmp.glb', citation: 'https://doi.org/10.1038/nature18933' },
  ];
  const names: Record<string, string> = {
    d1: 'G_and_S_frontomargin',
    d2: 'G_and_S_occipital_inf',
    du: 'Unknown',
    h1: 'L_V1_ROI',
    h2: 'L_MST_ROI',
    hu: 'Unknown',
    dr: 'G_and_S_frontomargin',
    hr: 'R_V1_ROI',
  };
  const regions: Record<string, unknown>[] = Object.entries(ids).map(([key, id]) => {
    const [atlas, hemisphere] = id.split(':');
    return {
      id,
      atlas,
      hemisphere,
      source_name: names[key],
      kind: ['du', 'hu'].includes(key) ? 'non-region' : 'cortex',
    };
  });
  regions.push({
    id: 'aseg:left:11',
    atlas: 'aseg',
    hemisphere: 'left',
    kind: 'structure',
    source_name: 'Left-Caudate',
  });
  const manifest = {
    anatomy: {
      id: 'snail',
      subject: 'subj_1',
      display_name: 'SNAIL subj_1',
      reconstruction: 'FreeSurfer 8.2.0',
      hcp_projected_from: 'fsaverage',
    },
    atlases,
    regions,
    atlas_comparison: { file: 'atlas-comparison.json', sha256: hash('f') },
  };
  const areas: [keyof typeof ids, keyof typeof ids, number][] = [
    ['d1', 'h1', 6],
    ['d1', 'h2', 3],
    ['d1', 'hu', 1],
    ['d2', 'h1', 2],
    ['d2', 'hu', 3],
    ['du', 'h1', 1],
    ['du', 'h2', 1],
    ['du', 'hu', 2],
    ['dr', 'hr', 4],
  ];
  const totals: Record<string, number> = {
    d1: 10,
    d2: 5,
    du: 4,
    h1: 9,
    h2: 4,
    hu: 6,
    dr: 4,
    hr: 4,
  };
  const data = {
    schema_version: 1,
    anatomy_id: 'snail',
    atlases: ['destrieux', 'hcp-mmp'],
    surface: 'pial',
    method: 'barycentric-vertex-cells',
    units: 'mm2',
    totals: Object.fromEntries(
      Object.entries(totals).map(([key, area]) => [ids[key as keyof typeof ids], area]),
    ),
    pairs: areas.map(([d, h, area], index) => ({
      region_ids: [ids[d], ids[h]],
      area_mm2: area,
      mesh_id: `overlap-${index}`,
    })),
    geometry: { file: 'atlas-overlaps.glb', sha256: hash('e') },
    sources: ['left', 'right'].map((hemisphere) => ({
      hemisphere,
      pial: { file: `${hemisphere}.pial`, sha256: hash('a') },
      annotations: atlases.map((atlas, index) => ({
        atlas: atlas.id,
        file: `${hemisphere}.${atlas.id}.annot`,
        sha256: hash(index ? 'c' : 'b'),
      })),
    })),
    atlas_assets: atlases.map((atlas, index) => ({
      atlas: atlas.id,
      file: atlas.file,
      citation: atlas.citation,
      sha256: hash(index ? 'd' : 'a'),
    })),
  };
  return { data, manifest };
}

const create = ({ data, manifest }: Fixture) =>
  createComparisonCatalog(data as ComparisonData, manifest as unknown as Manifest);

function csvRecords(csv: string) {
  const lines = csv.trimEnd().split('\r\n');
  const cells = (line: string) =>
    [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))/g)].map(([, quoted, plain]) =>
      quoted === undefined ? plain : quoted.replaceAll('""', '"'),
    );
  const headers = cells(lines.shift()!);
  return lines.map((line) =>
    Object.fromEntries(cells(line).map((value, index) => [headers[index], value])),
  );
}

test('comparison fractions use their directional whole-region denominator', () => {
  const catalog = create(fixture());
  assert.deepEqual(catalog.comparisonFor(ids.d1), {
    sourceRegionId: ids.d1,
    targetAtlas: 'hcp-mmp',
    totalAreaMm2: 10,
    rows: [
      { regionId: ids.h1, areaMm2: 6, fraction: 0.6, meshId: 'overlap-0' },
      { regionId: ids.h2, areaMm2: 3, fraction: 0.3, meshId: 'overlap-1' },
    ],
    unassignedAreaMm2: 1,
    unassignedFraction: 0.1,
  });
  const reverse = catalog.comparisonFor(ids.h1)!;
  assert.equal(reverse.targetAtlas, 'destrieux');
  assert.equal(reverse.totalAreaMm2, 9);
  assert.equal(reverse.rows[0].fraction, 6 / 9);
  assert.equal(reverse.unassignedFraction, 1 / 9);
  assert.notEqual(reverse.rows[0].fraction, 0.6);
});

test('all positive overlaps survive even far below display precision', () => {
  const { data, manifest } = fixture();
  const tinyId = 'hcp-mmp:left:3';
  manifest.regions.push({
    id: tinyId,
    atlas: 'hcp-mmp',
    hemisphere: 'left',
    source_name: 'L_V6_ROI',
    kind: 'cortex',
  });
  data.totals[ids.d1] += 1e-12;
  data.totals[tinyId] = 1e-12;
  data.pairs.push({ region_ids: [ids.d1, tinyId], area_mm2: 1e-12, mesh_id: 'tiny' });
  const catalog = create({ data, manifest });
  const tiny = catalog.comparisonFor(ids.d1)!.rows.at(-1)!;
  assert.equal(tiny.regionId, tinyId);
  assert.equal(tiny.areaMm2, 1e-12);
  assert.equal(tiny.fraction, 1e-12 / data.totals[ids.d1]);
  assert.equal(catalog.comparisonFor(tinyId)!.rows[0].fraction, 1);
});

test('noncortical and unassigned selections do not offer a comparison; unknown IDs fail', () => {
  const catalog = create(fixture());
  assert.equal(catalog.comparisonFor('aseg:left:11'), null);
  assert.equal(catalog.comparisonFor(ids.du), null);
  assert.throws(() => catalog.comparisonFor('missing'), /Unknown region/);
});

test('unassigned labels aggregate for display while CSV retains each label separately', () => {
  const { data, manifest } = fixture();
  const additional = 'hcp-mmp:left:-1';
  manifest.regions.push({
    id: additional,
    atlas: 'hcp-mmp',
    hemisphere: 'left',
    kind: 'non-region',
    source_name: 'Medial_wall',
  });
  data.totals[additional] = 0.5;
  data.totals[ids.d1] += 0.5;
  data.pairs.push({
    region_ids: [ids.d1, additional],
    area_mm2: 0.5,
    mesh_id: 'additional-unassigned',
  });
  const catalog = create({ data, manifest });
  const comparison = catalog.comparisonFor(ids.d1)!;
  assert.equal(comparison.unassignedAreaMm2, 1.5);
  assert.equal(comparison.unassignedFraction, 1.5 / 10.5);
  assert.equal(comparison.rows.length, 2);
  const exported = csvRecords(catalog.exportCsv(ids.d1));
  assert.equal(exported.length, 4);
  const unassigned = exported.filter((row) => row.target_kind === 'non-region');
  assert.deepEqual(
    unassigned.map((row) => row.target_region_id),
    [ids.hu, additional],
  );
  assert.deepEqual(
    unassigned.map((row) => row.target_source_name),
    ['Unknown', 'Medial_wall'],
  );
});

test('returned comparison rows cannot change the validated measurements', () => {
  const catalog = create(fixture());
  catalog.comparisonFor(ids.d1)!.rows[0].areaMm2 = 0;
  assert.equal(catalog.comparisonFor(ids.d1)!.rows[0].areaMm2, 6);
});

const malformed: [string, (data: Record<string, any>) => void][] = [
  [
    'schema',
    (data) => {
      data.schema_version = 2;
    },
  ],
  [
    'subject',
    (data) => {
      data.anatomy_id = 'aomic';
    },
  ],
  [
    'atlas order',
    (data) => {
      data.atlases.reverse();
    },
  ],
  [
    'surface',
    (data) => {
      data.surface = 'white';
    },
  ],
  [
    'method',
    (data) => {
      data.method = 'vertex-counts';
    },
  ],
  [
    'units',
    (data) => {
      data.units = 'm2';
    },
  ],
  [
    'missing totals',
    (data) => {
      delete data.totals;
    },
  ],
  [
    'missing region total',
    (data) => {
      delete data.totals[ids.d1];
    },
  ],
  [
    'unknown total',
    (data) => {
      data.totals.missing = 1;
    },
  ],
  [
    'zero total',
    (data) => {
      data.totals[ids.d1] = 0;
    },
  ],
  [
    'infinite total',
    (data) => {
      data.totals[ids.d1] = Infinity;
    },
  ],
  [
    'string total',
    (data) => {
      data.totals[ids.d1] = '10';
    },
  ],
  [
    'missing pairs',
    (data) => {
      delete data.pairs;
    },
  ],
  [
    'unknown pair ID',
    (data) => {
      data.pairs[0].region_ids[0] = 'missing';
    },
  ],
  [
    'swapped pair atlases',
    (data) => {
      data.pairs[0].region_ids.reverse();
    },
  ],
  [
    'mixed hemispheres',
    (data) => {
      data.pairs[0].region_ids[1] = ids.hr;
    },
  ],
  [
    'zero overlap',
    (data) => {
      data.pairs[0].area_mm2 = 0;
    },
  ],
  [
    'negative overlap',
    (data) => {
      data.pairs[0].area_mm2 = -6;
    },
  ],
  [
    'NaN overlap',
    (data) => {
      data.pairs[0].area_mm2 = NaN;
    },
  ],
  [
    'string overlap',
    (data) => {
      data.pairs[0].area_mm2 = '6';
    },
  ],
  [
    'duplicate pair',
    (data) => {
      data.pairs.push({ ...data.pairs[0], mesh_id: 'different' });
    },
  ],
  [
    'duplicate mesh ID',
    (data) => {
      data.pairs[1].mesh_id = data.pairs[0].mesh_id;
    },
  ],
  [
    'missing mesh ID',
    (data) => {
      delete data.pairs[0].mesh_id;
    },
  ],
  [
    'missing unassigned overlap',
    (data) => {
      data.pairs.splice(2, 1);
    },
  ],
  [
    'source marginal',
    (data) => {
      data.totals[ids.d1] += 0.001;
    },
  ],
  [
    'reverse marginal',
    (data) => {
      data.totals[ids.h1] += 0.001;
    },
  ],
  [
    'missing geometry',
    (data) => {
      delete data.geometry;
    },
  ],
  [
    'invalid geometry hash',
    (data) => {
      data.geometry.sha256 = 'wrong';
    },
  ],
  [
    'missing pial provenance',
    (data) => {
      delete data.sources[0].pial;
    },
  ],
  [
    'invalid source hash',
    (data) => {
      data.sources[0].pial.sha256 = hash('z');
    },
  ],
  [
    'missing annotation',
    (data) => {
      data.sources[0].annotations.pop();
    },
  ],
  [
    'duplicate annotation',
    (data) => {
      data.sources[0].annotations[1] = data.sources[0].annotations[0];
    },
  ],
  [
    'missing hemisphere source',
    (data) => {
      data.sources.pop();
    },
  ],
  [
    'duplicate hemisphere source',
    (data) => {
      data.sources[1] = data.sources[0];
    },
  ],
  [
    'missing atlas asset',
    (data) => {
      data.atlas_assets.pop();
    },
  ],
  [
    'invalid atlas hash',
    (data) => {
      delete data.atlas_assets[0].sha256;
    },
  ],
  [
    'missing citation',
    (data) => {
      delete data.atlas_assets[0].citation;
    },
  ],
  [
    'mismatched atlas file',
    (data) => {
      data.atlas_assets[0].file = 'other.glb';
    },
  ],
  [
    'mismatched citation',
    (data) => {
      data.atlas_assets[0].citation = 'other citation';
    },
  ],
];
for (const [name, change] of malformed) {
  test(`declared comparison rejects ${name}`, () => {
    const copy = fixture();
    change(copy.data);
    assert.throws(() => create(copy), /Invalid atlas comparison:/);
  });
}

test('comparison creation requires valid declared manifest metadata', () => {
  const changes: ((manifest: Record<string, any>) => void)[] = [
    (manifest) => {
      delete manifest.atlas_comparison;
    },
    (manifest) => {
      manifest.atlas_comparison.sha256 = 'wrong';
    },
    (manifest) => {
      manifest.regions[0].hemisphere = 'right';
    },
    (manifest) => {
      manifest.regions.push(manifest.regions[0]);
    },
  ];
  for (const change of changes) {
    const copy = fixture();
    change(copy.manifest);
    assert.throws(() => create(copy), /Invalid atlas comparison:/);
  }
});

test('table conservation permits only 1e-10 relative finite-precision error', () => {
  const copy = fixture();
  copy.data.totals[ids.d1] *= 1 + 5e-11;
  assert.ok(create(copy));
  copy.data.totals[ids.d1] = 10 * (1 + 2e-10);
  assert.throws(() => create(copy), /marginal|conserv/i);
});

test('CSV retains every target label, full numeric precision and reproducible provenance', () => {
  const { data, manifest } = fixture();
  const precise = 6.123456789012345;
  data.pairs[0].area_mm2 = precise;
  data.totals[ids.d1] = precise + 4;
  data.totals[ids.h1] = precise + 3;
  manifest.anatomy.subject = 'Subject, "one"';
  const catalog = create({ data, manifest });
  const csv = catalog.exportCsv(ids.d1, 'fr');
  const rows = csvRecords(csv);
  assert.equal(rows.length, 3);
  const first = rows.find((row) => row.target_region_id === ids.h1)!;
  assert.equal(first.area_mm2, String(precise));
  assert.equal(first.total_area_mm2, String(precise + 4));
  assert.equal(first.fraction, String(precise / (precise + 4)));
  assert.equal(first.source_region_id, ids.d1);
  assert.equal(first.source_region_name, labelOf(manifest.regions[0], 'fr')!.name);
  assert.equal(first.subject, manifest.anatomy.subject);
  assert.equal(first.anatomy_id, 'snail');
  assert.equal(first.method, data.method);
  assert.equal(first.schema_version, '1');
  assert.equal(first.reconstruction, manifest.anatomy.reconstruction);
  assert.deepEqual(JSON.parse(first.sources_json), data.sources);
  assert.deepEqual(JSON.parse(first.atlas_assets_json), data.atlas_assets);
  assert.equal(first.geometry_sha256, data.geometry.sha256);
  assert.equal(first.comparison_sha256, manifest.atlas_comparison.sha256);
  const unassigned = rows.find((row) => row.target_region_id === ids.hu)!;
  assert.equal(unassigned.target_kind, 'non-region');
  assert.equal(
    unassigned.target_region_name,
    labelOf(
      manifest.regions.find((region: { id: string }) => region.id === ids.hu),
      'fr',
    )!.name,
  );
  assert.equal(unassigned.target_source_name, 'Unknown');
  assert.equal(unassigned.area_mm2, '1');
  assert.throws(() => catalog.exportCsv('missing'), /Unknown region/);
  assert.throws(() => catalog.exportCsv(ids.d1, 'missing' as never), /language/i);
});

test('published CDMD data conserves every cortical source in both directions', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const data = readModel<ComparisonData>(`cdmd/${manifest.atlas_comparison!.file}`);
  const catalog = createComparisonCatalog(data, manifest);
  const cortical = manifest.regions.filter(
    (region) => region.kind === 'cortex' && data.atlases.includes(region.atlas!),
  );
  for (const region of cortical) {
    const comparison = catalog.comparisonFor(region.id)!;
    const measured = comparison.rows.reduce(
      (area, row) => area + row.areaMm2,
      comparison.unassignedAreaMm2,
    );
    assert.ok(
      Math.abs(measured - comparison.totalAreaMm2) <= comparison.totalAreaMm2 * 1e-10,
      region.id,
    );
    for (const row of comparison.rows) {
      const reverse = catalog
        .comparisonFor(row.regionId)!
        .rows.find((entry) => entry.regionId === region.id)!;
      assert.equal(reverse.areaMm2, row.areaMm2);
      assert.equal(reverse.meshId, row.meshId);
      assert.equal(row.fraction, row.areaMm2 / comparison.totalAreaMm2);
    }
    const rows = csvRecords(catalog.exportCsv(region.id));
    assert.equal(
      rows.length,
      data.pairs.filter((pair) => pair.region_ids.includes(region.id)).length,
    );
  }
});

const d1h1 = `${ids.d1}|${ids.h1}`;
const messageCases: [string, (f: Fixture) => void, string][] = [
  // the manifest
  [
    'a manifest without anatomy identity',
    (f) => delete f.manifest.anatomy,
    'missing subject identity',
  ],
  ['a blank subject', (f) => (f.manifest.anatomy.subject = ' '), 'missing subject identity'],
  [
    'no declared comparison file',
    (f) => delete f.manifest.atlas_comparison,
    'missing declared comparison file',
  ],
  [
    'a blank declared comparison file',
    (f) => (f.manifest.atlas_comparison.file = ' '),
    'missing declared comparison file',
  ],
  [
    'a declared hash that is not SHA-256',
    (f) => (f.manifest.atlas_comparison.sha256 = 'wrong'),
    'missing or invalid declared comparison SHA-256',
  ],
  ['no manifest regions', (f) => (f.manifest.regions = undefined), 'missing manifest regions'],
  [
    'a manifest region that is null',
    (f) => (f.manifest.regions[0] = null),
    'invalid or duplicate manifest region',
  ],
  [
    'a repeated manifest region',
    (f) => f.manifest.regions.push(f.manifest.regions[0]),
    'invalid or duplicate manifest region',
  ],
  [
    'a cortical region on a midline',
    (f) => (f.manifest.regions[0].hemisphere = 'midline'),
    `invalid cortical region metadata for ${ids.d1}`,
  ],
  [
    'a cortical region of kind structure',
    (f) => (f.manifest.regions[0].kind = 'structure'),
    `invalid cortical region metadata for ${ids.d1}`,
  ],
  [
    'a cortical region whose id names another side',
    (f) => (f.manifest.regions[0].hemisphere = 'right'),
    `invalid cortical region metadata for ${ids.d1}`,
  ],
  [
    'a cortical region with no source name',
    (f) => (f.manifest.regions[0].source_name = ''),
    `invalid cortical region metadata for ${ids.d1}`,
  ],
  [
    'a cortical region with no anatomical name',
    (f) => (f.manifest.regions[0].source_name = 'No_such_parcel_name'),
    `missing anatomical name for ${ids.d1}`,
  ],
  // identity
  ['a schema version of 2', (f) => (f.data.schema_version = 2), 'expected schema_version 1'],
  [
    'a schema version written "1"',
    (f) => (f.data.schema_version = '1'),
    'expected schema_version 1',
  ],
  [
    'another subject',
    (f) => (f.data.anatomy_id = 'aomic'),
    'comparison subject does not match manifest',
  ],
  [
    'the atlases in the wrong order',
    (f) => f.data.atlases.reverse(),
    'invalid atlas order or identity',
  ],
  ['one atlas only', (f) => (f.data.atlases = ['destrieux']), 'invalid atlas order or identity'],
  ['a white surface', (f) => (f.data.surface = 'white'), 'expected the original pial surface'],
  ['another method', (f) => (f.data.method = 'vertex-counts'), 'invalid area measurement method'],
  ['other units', (f) => (f.data.units = 'm2'), 'area units must be mm2'],
  ['no overlap geometry', (f) => delete f.data.geometry, 'missing overlap geometry file'],
  [
    'an overlap geometry hash that is not SHA-256',
    (f) => (f.data.geometry.sha256 = 'wrong'),
    'missing or invalid overlap geometry SHA-256',
  ],
  // sources
  ['no source provenance', (f) => delete f.data.sources, 'missing hemisphere source provenance'],
  ['one hemisphere source', (f) => f.data.sources.pop(), 'missing hemisphere source provenance'],
  [
    'a source of hemisphere both',
    (f) => (f.data.sources[0].hemisphere = 'both'),
    'invalid or duplicate source hemisphere',
  ],
  [
    'a repeated hemisphere source',
    (f) => (f.data.sources[1] = f.data.sources[0]),
    'invalid or duplicate source hemisphere',
  ],
  ['no pial source', (f) => delete f.data.sources[0].pial, 'missing left pial source file'],
  [
    'a pial hash that is not SHA-256',
    (f) => (f.data.sources[0].pial.sha256 = hash('z')),
    'missing or invalid left pial source SHA-256',
  ],
  ['one annotation only', (f) => f.data.sources[1].annotations.pop(), 'missing right annotations'],
  [
    'an annotation hash that is not SHA-256',
    (f) => delete f.data.sources[0].annotations[0].sha256,
    'missing or invalid left annotation source SHA-256',
  ],
  [
    'a repeated annotation atlas',
    (f) => (f.data.sources[0].annotations[1] = f.data.sources[0].annotations[0]),
    'invalid or duplicate left annotation atlas',
  ],
  [
    'an annotation of another atlas',
    (f) => (f.data.sources[0].annotations[0].atlas = 'aseg'),
    'invalid or duplicate left annotation atlas',
  ],
  // atlas assets
  [
    'no cortical asset provenance',
    (f) => delete f.data.atlas_assets,
    'missing cortical asset provenance',
  ],
  ['one cortical asset', (f) => f.data.atlas_assets.pop(), 'missing cortical asset provenance'],
  [
    'a manifest with no atlases',
    (f) => delete f.manifest.atlases,
    'missing cortical asset provenance',
  ],
  [
    'an asset hash that is not SHA-256',
    (f) => (f.data.atlas_assets[0].sha256 = 'wrong'),
    'missing or invalid cortical atlas asset SHA-256',
  ],
  [
    'a repeated cortical asset',
    (f) => (f.data.atlas_assets[1] = f.data.atlas_assets[0]),
    'invalid or duplicate cortical atlas asset',
  ],
  [
    'an asset of another atlas',
    (f) => (f.data.atlas_assets[0].atlas = 'aseg'),
    'invalid or duplicate cortical atlas asset',
  ],
  [
    'an asset file the manifest does not publish',
    (f) => (f.data.atlas_assets[0].file = 'other.glb'),
    'cortical asset file or citation does not match destrieux',
  ],
  [
    'an asset citation that differs',
    (f) => (f.data.atlas_assets[1].citation = 'other citation'),
    'cortical asset file or citation does not match hcp-mmp',
  ],
  [
    'an empty asset citation',
    (f) => (f.data.atlas_assets[0].citation = ''),
    'cortical asset file or citation does not match destrieux',
  ],
  // totals
  ...[undefined, null, [], 'x'].map((totals): [string, (f: Fixture) => void, string] => [
    `totals that are ${JSON.stringify(totals) ?? 'absent'}`,
    (f) => (f.data.totals = totals),
    'missing per-region area totals',
  ]),
  [
    'a region without a total',
    (f) => delete f.data.totals[ids.d1],
    'incomplete per-region area totals',
  ],
  [
    'a total for an extra region',
    (f) => (f.data.totals.extra = 1),
    'incomplete per-region area totals',
  ],
  [
    'a total for an unknown region in place of a known one',
    (f) => {
      delete f.data.totals[ids.dr];
      f.data.totals.missing = 1;
    },
    'unknown region or invalid total for missing',
  ],
  ...[0, -1, Infinity, NaN, '10', null].map((total): [string, (f: Fixture) => void, string] => [
    `a total of ${JSON.stringify(total) ?? String(total)}`,
    (f) => (f.data.totals[ids.d1] = total),
    `unknown region or invalid total for ${ids.d1}`,
  ]),
  // pairs
  ...[undefined, [], {}].map((pairs): [string, (f: Fixture) => void, string] => [
    `pairs that are ${JSON.stringify(pairs) ?? 'absent'}`,
    (f) => (f.data.pairs = pairs),
    'missing overlap pairs',
  ]),
  ['a pair that is null', (f) => (f.data.pairs[0] = null), 'invalid overlap region identifiers'],
  [
    'a pair with one region',
    (f) => (f.data.pairs[0].region_ids = ['a']),
    'invalid overlap region identifiers',
  ],
  [
    'a pair with three regions',
    (f) => f.data.pairs[0].region_ids.push('c'),
    'invalid overlap region identifiers',
  ],
  [
    'a pair whose ids are a string',
    (f) => (f.data.pairs[0].region_ids = 'ab'),
    'invalid overlap region identifiers',
  ],
  [
    'a pair naming an unknown region',
    (f) => (f.data.pairs[0].region_ids[0] = 'missing'),
    'overlap region atlas or hemisphere mismatch',
  ],
  [
    'a pair with the atlases swapped',
    (f) => f.data.pairs[0].region_ids.reverse(),
    'overlap region atlas or hemisphere mismatch',
  ],
  [
    'a pair across hemispheres',
    (f) => (f.data.pairs[0].region_ids[1] = ids.hr),
    'overlap region atlas or hemisphere mismatch',
  ],
  [
    'a repeated pair',
    (f) => f.data.pairs.push({ ...f.data.pairs[0], mesh_id: 'different' }),
    `duplicate overlap pair ${d1h1}`,
  ],
  [
    'a blank mesh id',
    (f) => (f.data.pairs[0].mesh_id = ''),
    'invalid or duplicate overlap mesh ID',
  ],
  [
    'a numeric mesh id',
    (f) => (f.data.pairs[0].mesh_id = 3),
    'invalid or duplicate overlap mesh ID',
  ],
  [
    'a repeated mesh id',
    (f) => (f.data.pairs[1].mesh_id = f.data.pairs[0].mesh_id),
    'invalid or duplicate overlap mesh ID',
  ],
  ...[0, -6, NaN, '6'].map((area): [string, (f: Fixture) => void, string] => [
    `an overlap area of ${JSON.stringify(area) ?? String(area)}`,
    (f) => (f.data.pairs[0].area_mm2 = area),
    `invalid overlap area for ${d1h1}`,
  ]),
  [
    'a removed pair',
    (f) => f.data.pairs.splice(2, 1),
    `overlap marginal does not conserve the whole area of ${ids.d1}`,
  ],
  [
    'a source total 0.001 too large',
    (f) => (f.data.totals[ids.d1] += 0.001),
    `overlap marginal does not conserve the whole area of ${ids.d1}`,
  ],
  [
    'a target total 0.001 too large',
    (f) => (f.data.totals[ids.h1] += 0.001),
    `overlap marginal does not conserve the whole area of ${ids.h1}`,
  ],
];

for (const [name, mutate, description] of messageCases) {
  test(`CAT-58 · refuses ${name}`, () => {
    const copy = fixture();
    mutate(copy);
    assert.throws(() => create(copy), { message: `Invalid atlas comparison: ${description}.` });
  });
}

test('CAT-58 · a manifest that is not a record has no subject identity, and data that is not a record has no schema', () => {
  assert.throws(() => createComparisonCatalog(fixture().data as ComparisonData, null as never), {
    message: 'Invalid atlas comparison: missing subject identity.',
  });
  for (const data of [null, [], 3]) {
    assert.throws(() => createComparisonCatalog(data as never, fixture().manifest as never), {
      message: 'Invalid atlas comparison: expected schema_version 1.',
    });
  }
});

test('CAT-57 · overlaps of equal area are listed by target id, whatever order the file gives', () => {
  const { data, manifest } = fixture();
  // d1 overlaps h1 and h2 by 3 mm² each, h2's pair first in the file.
  Object.assign(data.pairs[0], { area_mm2: 3 });
  Object.assign(data.pairs[1], { area_mm2: 3 });
  data.totals[ids.d1] = 7;
  data.totals[ids.h1] = 6;
  [data.pairs[0], data.pairs[1]] = [data.pairs[1], data.pairs[0]];
  const comparison = create({ data, manifest }).comparisonFor(ids.d1)!;
  assert.deepEqual(
    comparison.rows.map((row) => [row.regionId, row.areaMm2]),
    [
      [ids.h1, 3],
      [ids.h2, 3],
    ],
  );
});

test('CAT-59 · the CSV has the provenance columns, then the region columns, in a fixed order, one CRLF line per row', () => {
  const catalog = create(fixture());
  const csv = catalog.exportCsv(ids.d1);
  assert.ok(csv.endsWith('\r\n'));
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines.length, 4);
  assert.equal(
    lines[0],
    [
      'schema_version',
      'anatomy_id',
      'subject',
      'surface',
      'method',
      'units',
      'sources_json',
      'atlas_assets_json',
      'geometry_file',
      'geometry_sha256',
      'comparison_file',
      'comparison_sha256',
      'reconstruction',
      'hcp_projected_from',
      'source_atlas',
      'source_region_id',
      'source_region_name',
      'source_annotation_name',
      'target_atlas',
      'total_area_mm2',
      'target_region_id',
      'target_region_name',
      'target_source_name',
      'target_kind',
      'area_mm2',
      'fraction',
      'mesh_id',
    ].join(','),
  );
  assert.equal(catalog.exportCsv(ids.d1), catalog.exportCsv(ids.d1, 'en'));
  assert.notEqual(catalog.exportCsv(ids.d1, 'fr'), catalog.exportCsv(ids.d1, 'en'));
});

test('CAT-59 · an unknown language or a non-cortical region cannot be exported, by name', () => {
  const catalog = create(fixture());
  assert.throws(() => catalog.exportCsv(ids.d1, 'de' as never), {
    message: 'Unknown comparison export language: de',
  });
  assert.throws(() => catalog.exportCsv('aseg:left:11'), {
    message: 'Cannot export a cortical comparison for region: aseg:left:11',
  });
  assert.throws(() => catalog.exportCsv(ids.du), {
    message: `Cannot export a cortical comparison for region: ${ids.du}`,
  });
});

describe('CAT-60 · the published comparison', () => {
  let published: Manifest;
  let data: ComparisonData;
  let catalog: ReturnType<typeof createComparisonCatalog>;
  beforeAll(() => {
    published = readModel<Manifest>('cdmd/manifest.json');
    data = readModel<ComparisonData>(`cdmd/${published.atlas_comparison!.file}`);
    catalog = createComparisonCatalog(data, published);
  });

  test('CAT-60 · 1202 pairs and 512 totals measured by barycentric vertex cells', () => {
    assert.equal(data.pairs.length, 1202);
    assert.equal(Object.keys(data.totals).length, 512);
    assert.equal(data.method, 'barycentric-vertex-cells');
    const cortical = published.regions.filter(
      (r) => r.kind === 'cortex' && data.atlases.includes(r.atlas!),
    );
    assert.equal(cortical.length, 508);
  });

  test('CAT-60 · destrieux:left:38 overlaps 10 HCP-MMP areas of 2157.579 mm², the largest hcp-mmp:left:132', () => {
    const comparison = catalog.comparisonFor('destrieux:left:38')!;
    assert.equal(comparison.targetAtlas, 'hcp-mmp');
    assert.equal(comparison.totalAreaMm2, 2157.57944415253);
    assert.equal(comparison.rows.length, 10);
    const [first, second] = comparison.rows;
    assert.equal(first.regionId, 'hcp-mmp:left:132');
    assert.equal(first.areaMm2, 683.9536872313915);
    assert.ok(Math.abs(first.fraction - 0.317) < 1e-5);
    assert.equal(first.meshId, 'overlap:left:38:132');
    assert.equal(second.regionId, 'hcp-mmp:left:137');
    assert.equal(second.areaMm2, 460.2141596475145);
    assert.equal(comparison.unassignedAreaMm2, 0);
    assert.equal(csvRecords(catalog.exportCsv('destrieux:left:38')).length, 10);
  });
});
