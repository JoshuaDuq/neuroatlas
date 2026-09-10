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
  atlas: 'destrieux', hemisphere: 'both', cortexVisible: true,
  cortexOpacity: 1, isolatedRegion: null, ...over,
});

const catalog = createCatalog(manifest);
const names = rows => rows.map(row => row.label.name);

test('an empty query returns nothing rather than everything', () => {
  assert.deepEqual(catalog.search('', settings()), []);
  assert.deepEqual(catalog.search('   ', settings()), []);
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
  assert.equal(found[0].label.code, 'V1');
});

test('ties break alphabetically, then left hemisphere before right', () => {
  const found = catalog.search('Central sulcus', settings());
  assert.deepEqual(found.map(row => row.region.hemisphere), ['left', 'right']);
});

test('aliases are searchable', () => {
  assert.deepEqual(names(catalog.search('STG', settings())),
    ['Lateral aspect of the superior temporal gyrus']);
});

test('hidden regions are returned with the reason, never silently dropped', () => {
  const found = catalog.search('putamen', settings({ hemisphere: 'right' }));
  assert.equal(found.length, 1);
  assert.equal(found[0].visible, false);
  assert.equal(found[0].reason, 'hemisphere');
});

test('unlabelled cortex is never offered as a result', () => {
  assert.deepEqual(catalog.search('unlabelled', settings()), []);
});

test('groups cover the active atlas, then the shared structures', () => {
  const groups = catalog.groups(settings());
  assert.deepEqual(groups.map(group => group.name),
    ['Central', 'Insula', 'Parietal', 'Temporal', 'Basal ganglia']);
  assert.deepEqual(groups.map(group => group.rows.length), [3, 1, 1, 1, 1]);
});

test('switching atlas switches which cortical groups exist', () => {
  assert.deepEqual(catalog.groups(settings({ atlas: 'hcp-mmp' })).map(g => g.name),
    ['V–Z', 'Basal ganglia']);
});

test('visible count matches the meshes the model will show', async () => {
  const real = JSON.parse(
    await readFile(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));
  const full = createCatalog(real);
  // assets.test.js asserts the model shows 185 meshes for destrieux, and mesh
  // to region is one to one, so the catalog must agree without walking meshes.
  assert.equal(full.visibleCount(settings()), 185);
  assert.equal(full.visibleCount(settings({ cortexVisible: false })), 35);
});
