import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createCatalog } from './catalog.js';

const cortex = (id, hemisphere, source_name, atlas = 'destrieux') =>
  ({ id, atlas, hemisphere, kind: 'cortex', source_name });

const manifest = {
  regions: [
    cortex('d:l:1', 'left', 'S_central'),
    cortex('d:r:1', 'right', 'S_central'),
    cortex('d:l:2', 'left', 'G_postcentral'),
    cortex('d:l:3', 'left', 'G_and_S_subcentral'),
    cortex('d:l:4', 'left', 'G_temp_sup-Lateral'),
    cortex('d:l:5', 'left', 'G_Ins_lg_and_S_cent_ins'),
    { id: 'd:l:0', atlas: 'destrieux', hemisphere: 'left', kind: 'non-region', source_name: 'Unknown' },
    cortex('h:l:1', 'left', 'L_V1_ROI', 'hcp-mmp'),
    { id: 'a:l:1', atlas: 'aseg', hemisphere: 'left', kind: 'structure', source_name: 'Left-Putamen' },
  ],
};

const settings = (over = {}) => ({
  atlas: 'destrieux', detail: 'aseg', hemisphere: 'both', cortexVisible: true,
  cortexOpacity: 1, isolatedRegion: null, ...over,
});

const catalog = createCatalog(manifest);
const names = found => found.rows.map(row => row.label.name);

test('an empty query returns nothing rather than everything', () => {
  assert.deepEqual(catalog.search('', settings()), { rows: [], total: 0 });
  assert.deepEqual(catalog.search('   ', settings()), { rows: [], total: 0 });
});

test('results rank by prefix, then word boundary, then bare substring', () => {
  assert.deepEqual(names(catalog.search('central', settings())), [
    'Central sulcus',                                 // prefix
    'Central sulcus',                                 // prefix, other hemisphere
    'Long insular gyrus and central insular sulcus',  // word boundary
    'Postcentral gyrus',                              // substring only
    'Subcentral gyrus and sulci',                     // substring only
  ]);
});

test('an exact code match outranks everything else', () => {
  const found = catalog.search('V1', settings({ atlas: 'hcp-mmp' }));
  assert.equal(found.rows[0].label.code, 'V1');
});

test('ties break alphabetically, then left hemisphere before right', () => {
  const found = catalog.search('Central sulcus', settings());
  assert.deepEqual(found.rows.map(row => row.region.hemisphere), ['left', 'right']);
});

test('aliases are searchable', () => {
  assert.deepEqual(names(catalog.search('STG', settings())),
    ['Lateral aspect of the superior temporal gyrus']);
});

test('hidden regions are returned with the reason, never silently dropped', () => {
  const found = catalog.search('putamen', settings({ hemisphere: 'right' }));
  assert.equal(found.rows.length, 1);
  assert.equal(found.rows[0].visible, false);
  assert.equal(found.rows[0].reason, 'hemisphere');
});

test('unlabelled cortex is never offered as a result', () => {
  assert.deepEqual(catalog.search('unlabelled', settings()).rows, []);
});

test('groups cover the active atlas, then the shared structures', () => {
  const groups = catalog.groups(settings());
  assert.deepEqual(groups.map(group => group.name),
    ['Central', 'Insula', 'Parietal', 'Temporal', 'Basal ganglia']);
  assert.deepEqual(groups.map(group => group.rows.length), [3, 1, 1, 1, 1]);
  assert.deepEqual(groups.map(group => group.kind),
    ['cortex', 'cortex', 'cortex', 'cortex', 'structure']);
});

test('group keys stay distinct when a lobe and a system share a name', () => {
  // Destrieux has a Limbic lobe and aseg has a Limbic system. Keyed by name
  // alone, expanding one in the tree would expand both.
  const shared = createCatalog({ regions: [
    cortex('d:l:9', 'left', 'G_oc-temp_med-Parahip'),
    { id: 'a:l:9', atlas: 'aseg', hemisphere: 'left', kind: 'structure',
      source_name: 'Left-Hippocampus' },
  ] });
  const groups = shared.groups(settings());
  assert.deepEqual(groups.map(group => group.name), ['Limbic', 'Limbic']);
  assert.deepEqual(groups.map(group => group.key), ['cortex:Limbic', 'structure:Limbic']);
  assert.equal(new Set(groups.map(group => group.key)).size, 2);
});

test('switching atlas switches which cortical groups exist', () => {
  assert.deepEqual(catalog.groups(settings({ atlas: 'hcp-mmp' })).map(g => g.name),
    ['V–Z', 'Basal ganglia']);
});

test('visible region count excludes unlabelled medial surfaces', async () => {
  const real = JSON.parse(
    await readFile(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));
  const full = createCatalog(real);
  // Cortex + 35 native structures + the 58-part reference cord; medial walls
  // are non-regions.
  assert.equal(full.visibleCount(settings()), 241);
  assert.equal(full.visibleCount(settings({ atlas: 'hcp-mmp' })), 453);
  assert.equal(full.visibleCount(settings({ cortexVisible: false })), 93);
});

test('a capped result set reports the true total, never a silent cut', async () => {
  // "s" matches hundreds of regions. Returning 50 without saying so is the
  // silent absence this navigator exists to avoid.
  const real = JSON.parse(
    await readFile(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));
  const full = createCatalog(real);
  const found = full.search('s', settings(), 50);
  assert.equal(found.rows.length, 50);
  assert.ok(found.total > 50, `expected more than 50 matches, got ${found.total}`);
});

test('cut-only regions are grouped by the cut atlas, not the surface atlas', () => {
  const manifest = {
    regions: [
      { id: 'destrieux:left:1', kind: 'cortex', atlas: 'destrieux', hemisphere: 'left',
        source_name: 'G_cuneus' },
      { id: 'nextbrain:left:48', kind: 'tissue-region', atlas: 'nextbrain',
        hemisphere: 'left', source_label_id: 48, source_name: 'head_of_caudate' },
    ],
  };
  const catalog = createCatalog(manifest);
  const settings = {
    atlas: 'destrieux', cutAtlas: 'nextbrain', cutActive: true, detail: 'aseg',
    hemisphere: 'both', cortexVisible: true, cortexOpacity: 1, isolatedRegion: null,
  };
  const kinds = catalog.groups(settings).map(group => group.kind);
  assert.ok(kinds.includes('tissue'), 'a cut-only section is offered');

  // Switching the cut atlas away must drop the section entirely, while the
  // surface atlas choice leaves it alone.
  const other = catalog.groups({ ...settings, cutAtlas: 'destrieux' });
  assert.equal(other.some(group => group.kind === 'tissue'), false);
  const otherSurface = catalog.groups({ ...settings, atlas: 'hcp-mmp' });
  assert.equal(otherSurface.some(group => group.kind === 'tissue'), true);
});

test('white matter is offered under every cut atlas that carries it', () => {
  const catalog = createCatalog({ regions: [
    { id: 'wmparc:left:3024', kind: 'tissue-region', atlas: 'wmparc', hemisphere: 'left',
      source_name: 'precentral', cut_atlases: ['destrieux', 'hcp-mmp'] },
  ] });
  const rows = cutAtlas => catalog
    .groups(settings({ cutAtlas, cutActive: true }))
    .flatMap(group => group.rows.map(row => row.label.name));
  assert.deepEqual(rows('destrieux'), ['White matter of the precentral gyrus']);
  assert.deepEqual(rows('hcp-mmp'), ['White matter of the precentral gyrus']);
  assert.deepEqual(rows('nextbrain'), []);
});

const cordRegion = (id, hemisphere, name, family, order, aliases = { en: [], fr: [] }) => ({
  id: `zanatomy:${hemisphere}:${id}`, atlas: 'zanatomy', kind: 'structure', hemisphere,
  supplemental: true, source_name: name, display_names: { en: name, fr: name },
  system_names: { en: 'Spinal cord', fr: 'Moelle épinière' },
  family: family.toLowerCase(), family_names: { en: family, fr: family }, family_order: order, aliases,
});

test('spinal cord rows sit under their family, in the order the model publishes', () => {
  const cord = createCatalog({ regions: [
    cordRegion('cauda-equina', 'midline', 'Cauda equina', 'Roots and ganglia', 9),
    cordRegion('gracile-fasciculus', 'right', 'Gracile fasciculus', 'Posterior funiculus', 1),
    cordRegion('anterior-horn', 'left', 'Anterior horn of spinal cord', 'Anterior horn', 7),
    cordRegion('cuneate-fasciculus', 'left', 'Cuneate fasciculus', 'Posterior funiculus', 1),
    cordRegion('gracile-fasciculus', 'left', 'Gracile fasciculus', 'Posterior funiculus', 1),
  ] });
  const [group] = cord.groups(settings({ detail: 'learning' }));
  assert.equal(group.name, 'Spinal cord');
  assert.deepEqual(group.rows.map(row => [row.label.subgroup, row.label.name, row.region.hemisphere]), [
    ['Posterior funiculus', 'Cuneate fasciculus', 'left'],
    ['Posterior funiculus', 'Gracile fasciculus', 'left'],
    ['Posterior funiculus', 'Gracile fasciculus', 'right'],
    ['Anterior horn', 'Anterior horn of spinal cord', 'left'],
    ['Roots and ganglia', 'Cauda equina', 'midline'],
  ]);
});

test('spinal cord structures answer to the clinical aliases of each language', () => {
  const tract = cordRegion('posterolateral-tract', 'left', 'Posterolateral tract', 'White matter', 0,
    { en: ["Lissauer's tract"], fr: ['Faisceau de Lissauer'] });
  const cord = createCatalog({ regions: [tract] });
  assert.equal(cord.search('lissauer', settings()).rows[0]?.region.id, tract.id);
  assert.equal(cord.search('faisceau de lissauer', settings({ lang: 'fr' })).rows[0]?.region.id, tract.id);
});
