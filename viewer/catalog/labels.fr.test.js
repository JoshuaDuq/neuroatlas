import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { labelOf } from './labels.js';
import { createCatalog } from './catalog.js';
import { DESTRIEUX_LABELS } from './destrieux-labels.js';
import { DESTRIEUX_LABELS_FR } from './destrieux-labels.fr.js';
import { STRUCTURE_LABELS } from './structure-groups.js';
import { STRUCTURE_LABELS_FR } from './structure-groups.fr.js';

const region = over => ({ kind: 'cortex', hemisphere: 'left', ...over });

test('Destrieux source names expand to their French anatomical names', () => {
  const cases = {
    'G_front_inf-Opercular': 'Partie operculaire du gyrus frontal inférieur',
    S_calcarine: 'Sillon calcarin',
    Pole_temporal: 'Pôle temporal',
    'G_temp_sup-G_T_transv': 'Gyrus temporal transverse (Heschl)',
    'G_oc-temp_lat-fusifor': 'Gyrus occipito-temporal latéral (fusiforme)',
    G_cuneus: 'Cunéus',
    G_precentral: 'Gyrus précentral',
    G_postcentral: 'Gyrus postcentral',
  };
  for (const [source_name, name] of Object.entries(cases)) {
    assert.equal(labelOf(region({ atlas: 'destrieux', source_name }), 'fr').name, name);
  }
});

test('Destrieux regions carry a French lobe as their navigation group', () => {
  const lobe = source_name =>
    labelOf(region({ atlas: 'destrieux', source_name }), 'fr').group;
  assert.equal(lobe('G_front_sup'), 'Frontal');
  assert.equal(lobe('G_precuneus'), 'Pariétal');
  assert.equal(lobe('S_calcarine'), 'Occipital');
  assert.equal(lobe('G_insular_short'), 'Insula');
  assert.equal(lobe('G_and_S_cingul-Ant'), 'Cingulaire');
  assert.equal(lobe('Lat_Fis-post'), 'Scissure latérale');
});

test('French aliases and common abbreviations are searchable', () => {
  const gfi = labelOf(region({ atlas: 'destrieux', source_name: 'G_front_inf-Opercular' }), 'fr');
  assert.ok(gfi.aliases.includes('GFI'));
  assert.ok(gfi.aliases.includes('Broca'));

  const fusiforme = labelOf(region({ atlas: 'destrieux', source_name: 'G_oc-temp_lat-fusifor' }), 'fr');
  assert.ok(fusiforme.aliases.includes('fusiforme'));

  const sylvius = labelOf(region({ atlas: 'destrieux', source_name: 'Lat_Fis-post' }), 'fr');
  assert.ok(sylvius.aliases.includes('Sylvius'));
});

test('subcortical structures get French names and anatomical systems', () => {
  const put = labelOf(region({ atlas: 'aseg', kind: 'structure',
    source_name: 'Left-Putamen' }), 'fr');
  assert.equal(put.name, 'Putamen');
  assert.equal(put.group, 'Ganglions de la base');

  const caudate = labelOf(region({ atlas: 'aseg', kind: 'structure',
    source_name: 'Left-Caudate' }), 'fr');
  assert.equal(caudate.name, 'Noyau caudé');
  assert.equal(caudate.group, 'Ganglions de la base');

  const vent = labelOf(region({ atlas: 'aseg', kind: 'structure',
    source_name: 'Left-Lateral-Ventricle' }), 'fr');
  assert.equal(vent.name, 'Ventricule latéral');
  assert.equal(vent.group, 'Ventricules et LCS');

  const cc = labelOf(region({ atlas: 'aseg', kind: 'structure', hemisphere: 'midline',
    source_name: 'CC_Anterior' }), 'fr');
  assert.equal(cc.name, 'Corps calleux, antérieur');
  assert.equal(cc.group, 'Corps calleux');

  const stem = labelOf(region({ atlas: 'aseg', kind: 'structure', hemisphere: 'midline',
    source_name: 'Brain-Stem' }), 'fr');
  assert.equal(stem.name, 'Tronc cérébral');
  assert.equal(stem.group, 'Tronc cérébral');
});

test('unlabelled cortex is named in French plainly rather than left blank', () => {
  const wall = labelOf(region({ atlas: 'destrieux', kind: 'non-region',
    source_name: 'Unknown' }), 'fr');
  assert.equal(wall.name, 'Non étiqueté');
  assert.equal(wall.group, 'Non étiqueté');
});

test('every region in the published manifest resolves to a French name and group', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));
  const unresolved = [];
  for (const r of manifest.regions) {
    const label = labelOf(r, 'fr');
    if (!label?.name?.trim() || !label?.group?.trim()) unresolved.push(r.source_name);
  }
  assert.deepEqual(unresolved, [], `${unresolved.length} region(s) without a French label`);
  // Not a fixed total: the published catalogue changes with the subject and with
  // whether the optional warp ran, so a pinned number would only ever report
  // that. What must hold is that nothing was truncated — every count the
  // manifest publishes is met by the regions that actually arrived.
  for (const atlas of manifest.atlases) {
    const published = manifest.regions.filter(r => r.atlas === atlas.id && r.kind === 'cortex');
    assert.equal(published.length, atlas.region_count, atlas.id);
  }
  for (const level of manifest.detail_levels) {
    const published = manifest.regions.filter(r => r.atlas === level.id && r.kind === 'structure');
    assert.equal(published.length, level.region_count, level.id);
  }
});

test('catalog searches with and without accents in French', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));
  const catalog = createCatalog(manifest, 'fr');
  const settings = {
    atlas: 'destrieux', cutAtlas: 'destrieux', cutActive: false, detail: 'aseg',
    hemisphere: 'both', cortexVisible: true,
    cortexOpacity: 1, isolatedRegion: null, lang: 'fr',
  };

  // NextBrain publishes a cuneus parcel of its own, so this asserts that both
  // spellings reach the Destrieux region rather than which one ranks first.
  const destrieuxCuneus = rows => rows.find(row => row.label.name === 'Cunéus');

  // User typing with accents
  const withAccents = catalog.search('cunéus', settings);
  assert.ok(destrieuxCuneus(withAccents.rows), 'accented query finds Cunéus');

  // User typing without accents
  const withoutAccents = catalog.search('cuneus', settings);
  assert.ok(destrieuxCuneus(withoutAccents.rows), 'unaccented query finds Cunéus');

  // User searching by alias
  const byAlias = catalog.search('Broca', settings);
  assert.ok(byAlias.rows.length >= 2);
  assert.ok(byAlias.rows.some(r => r.label.name.includes('operculaire')));
});

test('exact 1:1 key parity between English and French Destrieux tables', () => {
  const enKeys = Object.keys(DESTRIEUX_LABELS).sort();
  const frKeys = Object.keys(DESTRIEUX_LABELS_FR).sort();
  assert.equal(enKeys.length, 74);
  assert.deepEqual(enKeys, frKeys);
  for (const key of enKeys) {
    const en = DESTRIEUX_LABELS[key];
    const fr = DESTRIEUX_LABELS_FR[key];
    assert.ok(fr.name && fr.name.length > 0, `Missing French name for ${key}`);
    assert.ok(fr.lobe && fr.lobe.length > 0, `Missing French lobe for ${key}`);
  }
});

test('exact 1:1 key parity between English and French subcortical structure tables', () => {
  const enKeys = Object.keys(STRUCTURE_LABELS).sort();
  const frKeys = Object.keys(STRUCTURE_LABELS_FR).sort();
  assert.equal(enKeys.length, 35);
  assert.deepEqual(enKeys, frKeys);
  for (const key of enKeys) {
    const en = STRUCTURE_LABELS[key];
    const fr = STRUCTURE_LABELS_FR[key];
    assert.ok(fr.name && fr.name.length > 0, `Missing French name for ${key}`);
    assert.ok(fr.system && fr.system.length > 0, `Missing French system for ${key}`);
  }
});

test('NextBrain source names with French entries expand to their verified French names', () => {
  const cases = {
    head_of_caudate: { name: 'Tête du noyau caudé', group: 'Ganglions de la base' },
    optic_chiasm: { name: 'Chiasma optique', group: 'Voies visuelles' },
    pineal_body: { name: 'Corps pinéal', group: 'Diencéphale' },
    substantia_nigra__compact_part: { name: 'Substance noire, partie compacte', group: 'Tronc cérébral' },
    rostral_subiculum: { name: 'Subiculum rostral', group: 'Hippocampe' },
    cuneus: { name: 'Cunéus', group: 'Occipital' },
  };
  for (const [source_name, expected] of Object.entries(cases)) {
    const r = { kind: 'tissue-region', atlas: 'nextbrain', hemisphere: 'left', source_name };
    const label = labelOf(r, 'fr');
    assert.equal(label.name, expected.name);
    assert.equal(label.group, expected.group);
  }
});

test('NextBrain regions without a French entry fall back to published English', () => {
  const r = {
    kind: 'tissue-region', atlas: 'nextbrain', hemisphere: 'right',
    source_name: 'periaqueductal_gray_substance',
  };
  const label = labelOf(r, 'fr');
  assert.equal(label.name, 'periaqueductal gray substance');
  assert.equal(label.group, 'P–R');
});


