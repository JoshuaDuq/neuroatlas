import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { labelOf } from '../catalog/labels.js';
import { createComparisonCatalog } from './catalog.js';

const hash = character => character.repeat(64);
const ids = {
  d1: 'destrieux:left:1', d2: 'destrieux:left:2', du: 'destrieux:left:-1',
  h1: 'hcp-mmp:left:1', h2: 'hcp-mmp:left:2', hu: 'hcp-mmp:left:0',
  dr: 'destrieux:right:1', hr: 'hcp-mmp:right:1',
};

function fixture() {
  const atlases = [
    { id: 'destrieux', file: 'cortex-destrieux.glb', citation: 'https://doi.org/10.1016/j.neuroimage.2010.06.010' },
    { id: 'hcp-mmp', file: 'cortex-hcp-mmp.glb', citation: 'https://doi.org/10.1038/nature18933' },
  ];
  const names = { d1: 'G_and_S_frontomargin', d2: 'G_and_S_occipital_inf', du: 'Unknown',
    h1: 'L_V1_ROI', h2: 'L_MST_ROI', hu: 'Unknown', dr: 'G_and_S_frontomargin', hr: 'R_V1_ROI' };
  const regions = Object.entries(ids).map(([key, id]) => {
    const [atlas, hemisphere] = id.split(':');
    return { id, atlas, hemisphere, source_name: names[key],
      kind: ['du', 'hu'].includes(key) ? 'non-region' : 'cortex' };
  });
  regions.push({ id: 'aseg:left:11', atlas: 'aseg', hemisphere: 'left',
    kind: 'structure', source_name: 'Left-Caudate' });
  const manifest = {
    anatomy: { id: 'snail', subject: 'subj_1', display_name: 'SNAIL subj_1',
      reconstruction: 'FreeSurfer 8.2.0', hcp_projected_from: 'fsaverage' },
    atlases, regions, atlas_comparison: { file: 'atlas-comparison.json', sha256: hash('f') },
  };
  const areas = [['d1', 'h1', 6], ['d1', 'h2', 3], ['d1', 'hu', 1],
    ['d2', 'h1', 2], ['d2', 'hu', 3], ['du', 'h1', 1], ['du', 'h2', 1],
    ['du', 'hu', 2], ['dr', 'hr', 4]];
  const data = {
    schema_version: 1, anatomy_id: 'snail', atlases: ['destrieux', 'hcp-mmp'],
    surface: 'pial', method: 'barycentric-vertex-cells', units: 'mm2',
    totals: Object.fromEntries(Object.entries({ d1: 10, d2: 5, du: 4, h1: 9, h2: 4,
      hu: 6, dr: 4, hr: 4 }).map(([key, area]) => [ids[key], area])),
    pairs: areas.map(([d, h, area], index) => ({ region_ids: [ids[d], ids[h]],
      area_mm2: area, mesh_id: `overlap-${index}` })),
    geometry: { file: 'atlas-overlaps.glb', sha256: hash('e') },
    sources: ['left', 'right'].map(hemisphere => ({ hemisphere,
      pial: { file: `${hemisphere}.pial`, sha256: hash('a') },
      annotations: atlases.map((atlas, index) => ({ atlas: atlas.id,
        file: `${hemisphere}.${atlas.id}.annot`, sha256: hash(index ? 'c' : 'b') })) })),
    atlas_assets: atlases.map((atlas, index) => ({ atlas: atlas.id, file: atlas.file,
      citation: atlas.citation, sha256: hash(index ? 'd' : 'a') })),
  };
  return { data, manifest };
}

function csvRecords(csv) {
  const lines = csv.trimEnd().split('\r\n');
  const cells = line => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))/g)]
    .map(([, quoted, plain]) => quoted === undefined ? plain : quoted.replaceAll('""', '"'));
  const headers = cells(lines.shift());
  return lines.map(line => Object.fromEntries(cells(line).map((value, index) => [headers[index], value])));
}

test('comparison fractions use their directional whole-region denominator', () => {
  const { data, manifest } = fixture();
  const catalog = createComparisonCatalog(data, manifest);
  assert.deepEqual(catalog.comparisonFor(ids.d1), {
    sourceRegionId: ids.d1, targetAtlas: 'hcp-mmp', totalAreaMm2: 10,
    rows: [{ regionId: ids.h1, areaMm2: 6, fraction: 0.6, meshId: 'overlap-0' },
      { regionId: ids.h2, areaMm2: 3, fraction: 0.3, meshId: 'overlap-1' }],
    unassignedAreaMm2: 1, unassignedFraction: 0.1,
  });
  const reverse = catalog.comparisonFor(ids.h1);
  assert.equal(reverse.targetAtlas, 'destrieux');
  assert.equal(reverse.totalAreaMm2, 9);
  assert.equal(reverse.rows[0].fraction, 6 / 9);
  assert.equal(reverse.unassignedFraction, 1 / 9);
  assert.notEqual(reverse.rows[0].fraction, 0.6);
});

test('all positive overlaps survive even far below display precision', () => {
  const { data, manifest } = fixture();
  const tinyId = 'hcp-mmp:left:3';
  manifest.regions.push({ id: tinyId, atlas: 'hcp-mmp', hemisphere: 'left',
    source_name: 'L_V6_ROI', kind: 'cortex' });
  data.totals[ids.d1] += 1e-12;
  data.totals[tinyId] = 1e-12;
  data.pairs.push({ region_ids: [ids.d1, tinyId], area_mm2: 1e-12, mesh_id: 'tiny' });
  const catalog = createComparisonCatalog(data, manifest);
  const tiny = catalog.comparisonFor(ids.d1).rows.at(-1);
  assert.equal(tiny.regionId, tinyId);
  assert.equal(tiny.areaMm2, 1e-12);
  assert.equal(tiny.fraction, 1e-12 / data.totals[ids.d1]);
  assert.equal(catalog.comparisonFor(tinyId).rows[0].fraction, 1);
});

test('noncortical and unassigned selections do not offer a comparison; unknown IDs fail', () => {
  const { data, manifest } = fixture();
  const catalog = createComparisonCatalog(data, manifest);
  assert.equal(catalog.comparisonFor('aseg:left:11'), null);
  assert.equal(catalog.comparisonFor(ids.du), null);
  assert.throws(() => catalog.comparisonFor('missing'), /Unknown region/);
});

test('unassigned labels aggregate for display while CSV retains each label separately', () => {
  const { data, manifest } = fixture();
  const additional = 'hcp-mmp:left:-1';
  manifest.regions.push({ id: additional, atlas: 'hcp-mmp', hemisphere: 'left',
    kind: 'non-region', source_name: 'Medial_wall' });
  data.totals[additional] = 0.5;
  data.totals[ids.d1] += 0.5;
  data.pairs.push({ region_ids: [ids.d1, additional], area_mm2: 0.5, mesh_id: 'additional-unassigned' });
  const catalog = createComparisonCatalog(data, manifest);
  const comparison = catalog.comparisonFor(ids.d1);
  assert.equal(comparison.unassignedAreaMm2, 1.5);
  assert.equal(comparison.unassignedFraction, 1.5 / 10.5);
  assert.equal(comparison.rows.length, 2);
  const exported = csvRecords(catalog.exportCsv(ids.d1));
  assert.equal(exported.length, 4);
  const unassigned = exported.filter(row => row.target_kind === 'non-region');
  assert.deepEqual(unassigned.map(row => row.target_region_id), [ids.hu, additional]);
  assert.deepEqual(unassigned.map(row => row.target_source_name), ['Unknown', 'Medial_wall']);
});

test('returned comparison rows cannot change the validated measurements', () => {
  const { data, manifest } = fixture();
  const catalog = createComparisonCatalog(data, manifest);
  catalog.comparisonFor(ids.d1).rows[0].areaMm2 = 0;
  assert.equal(catalog.comparisonFor(ids.d1).rows[0].areaMm2, 6);
});

const malformed = [
  ['schema', data => { data.schema_version = 2; }],
  ['subject', data => { data.anatomy_id = 'aomic'; }],
  ['atlas order', data => { data.atlases.reverse(); }],
  ['surface', data => { data.surface = 'white'; }],
  ['method', data => { data.method = 'vertex-counts'; }],
  ['units', data => { data.units = 'm2'; }],
  ['missing totals', data => { delete data.totals; }],
  ['missing region total', data => { delete data.totals[ids.d1]; }],
  ['unknown total', data => { data.totals.missing = 1; }],
  ['zero total', data => { data.totals[ids.d1] = 0; }],
  ['infinite total', data => { data.totals[ids.d1] = Infinity; }],
  ['string total', data => { data.totals[ids.d1] = '10'; }],
  ['missing pairs', data => { delete data.pairs; }],
  ['unknown pair ID', data => { data.pairs[0].region_ids[0] = 'missing'; }],
  ['swapped pair atlases', data => { data.pairs[0].region_ids.reverse(); }],
  ['mixed hemispheres', data => { data.pairs[0].region_ids[1] = ids.hr; }],
  ['zero overlap', data => { data.pairs[0].area_mm2 = 0; }],
  ['negative overlap', data => { data.pairs[0].area_mm2 = -6; }],
  ['NaN overlap', data => { data.pairs[0].area_mm2 = NaN; }],
  ['string overlap', data => { data.pairs[0].area_mm2 = '6'; }],
  ['duplicate pair', data => { data.pairs.push({ ...data.pairs[0], mesh_id: 'different' }); }],
  ['duplicate mesh ID', data => { data.pairs[1].mesh_id = data.pairs[0].mesh_id; }],
  ['missing mesh ID', data => { delete data.pairs[0].mesh_id; }],
  ['missing unassigned overlap', data => { data.pairs.splice(2, 1); }],
  ['source marginal', data => { data.totals[ids.d1] += 0.001; }],
  ['reverse marginal', data => { data.totals[ids.h1] += 0.001; }],
  ['missing geometry', data => { delete data.geometry; }],
  ['invalid geometry hash', data => { data.geometry.sha256 = 'wrong'; }],
  ['missing pial provenance', data => { delete data.sources[0].pial; }],
  ['invalid source hash', data => { data.sources[0].pial.sha256 = hash('z'); }],
  ['missing annotation', data => { data.sources[0].annotations.pop(); }],
  ['duplicate annotation', data => { data.sources[0].annotations[1] = data.sources[0].annotations[0]; }],
  ['missing hemisphere source', data => { data.sources.pop(); }],
  ['duplicate hemisphere source', data => { data.sources[1] = data.sources[0]; }],
  ['missing atlas asset', data => { data.atlas_assets.pop(); }],
  ['invalid atlas hash', data => { delete data.atlas_assets[0].sha256; }],
  ['missing citation', data => { delete data.atlas_assets[0].citation; }],
  ['mismatched atlas file', data => { data.atlas_assets[0].file = 'other.glb'; }],
  ['mismatched citation', data => { data.atlas_assets[0].citation = 'other citation'; }],
];
for (const [name, change] of malformed) {
  test(`declared comparison rejects ${name}`, () => {
    const { data, manifest } = fixture();
    change(data);
    assert.throws(() => createComparisonCatalog(data, manifest), /Invalid atlas comparison:/);
  });
}

test('comparison creation requires valid declared manifest metadata', () => {
  for (const change of [manifest => { delete manifest.atlas_comparison; },
    manifest => { manifest.atlas_comparison.sha256 = 'wrong'; },
    manifest => { manifest.regions[0].hemisphere = 'right'; },
    manifest => { manifest.regions.push(manifest.regions[0]); }]) {
    const { data, manifest } = fixture();
    change(manifest);
    assert.throws(() => createComparisonCatalog(data, manifest), /Invalid atlas comparison:/);
  }
});

test('table conservation permits only 1e-10 relative finite-precision error', () => {
  const { data, manifest } = fixture();
  data.totals[ids.d1] *= 1 + 5e-11;
  assert.ok(createComparisonCatalog(data, manifest));
  data.totals[ids.d1] = 10 * (1 + 2e-10);
  assert.throws(() => createComparisonCatalog(data, manifest), /marginal|conserv/i);
});

test('CSV retains every target label, full numeric precision and reproducible provenance', () => {
  const { data, manifest } = fixture();
  const precise = 6.123456789012345;
  data.pairs[0].area_mm2 = precise;
  data.totals[ids.d1] = precise + 4;
  data.totals[ids.h1] = precise + 3;
  manifest.anatomy.subject = 'Subject, "one"';
  const catalog = createComparisonCatalog(data, manifest);
  const csv = catalog.exportCsv(ids.d1, 'fr');
  const rows = csvRecords(csv);
  assert.equal(rows.length, 3);
  const first = rows.find(row => row.target_region_id === ids.h1);
  assert.equal(first.area_mm2, String(precise));
  assert.equal(first.total_area_mm2, String(precise + 4));
  assert.equal(first.fraction, String(precise / (precise + 4)));
  assert.equal(first.source_region_id, ids.d1);
  assert.equal(first.source_region_name, labelOf(manifest.regions[0], 'fr').name);
  assert.equal(first.subject, manifest.anatomy.subject);
  assert.equal(first.anatomy_id, 'snail');
  assert.equal(first.method, data.method);
  assert.equal(first.schema_version, '1');
  assert.equal(first.reconstruction, manifest.anatomy.reconstruction);
  assert.deepEqual(JSON.parse(first.sources_json), data.sources);
  assert.deepEqual(JSON.parse(first.atlas_assets_json), data.atlas_assets);
  assert.equal(first.geometry_sha256, data.geometry.sha256);
  assert.equal(first.comparison_sha256, manifest.atlas_comparison.sha256);
  const unassigned = rows.find(row => row.target_region_id === ids.hu);
  assert.equal(unassigned.target_kind, 'non-region');
  assert.equal(unassigned.target_region_name, labelOf(manifest.regions.find(region => region.id === ids.hu), 'fr').name);
  assert.equal(unassigned.target_source_name, 'Unknown');
  assert.equal(unassigned.area_mm2, '1');
  assert.throws(() => catalog.exportCsv('missing'), /Unknown region/);
  assert.throws(() => catalog.exportCsv(ids.d1, 'missing'), /language/i);
});

test('published CDMD data conserves every cortical source in both directions', () => {
  const directory = new URL('../../public/models/cdmd/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
  const data = JSON.parse(readFileSync(new URL(manifest.atlas_comparison.file, directory), 'utf8'));
  const catalog = createComparisonCatalog(data, manifest);
  const cortical = manifest.regions.filter(region => region.kind === 'cortex'
    && data.atlases.includes(region.atlas));
  for (const region of cortical) {
    const comparison = catalog.comparisonFor(region.id);
    const measured = comparison.rows.reduce((area, row) => area + row.areaMm2, comparison.unassignedAreaMm2);
    assert.ok(Math.abs(measured - comparison.totalAreaMm2) <= comparison.totalAreaMm2 * 1e-10, region.id);
    for (const row of comparison.rows) {
      const reverse = catalog.comparisonFor(row.regionId).rows.find(entry => entry.regionId === region.id);
      assert.equal(reverse.areaMm2, row.areaMm2);
      assert.equal(reverse.meshId, row.meshId);
      assert.equal(row.fraction, row.areaMm2 / comparison.totalAreaMm2);
    }
    const rows = csvRecords(catalog.exportCsv(region.id));
    assert.equal(rows.length, data.pairs.filter(pair => pair.region_ids.includes(region.id)).length);
  }
});
