import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { labelOf } from './labels.js';

const published = JSON.parse(await readFile(new URL('../../public/models/anatomies.json', import.meta.url), 'utf8')).default;

const region = over => ({ kind: 'cortex', hemisphere: 'left', ...over });

test('Destrieux source names expand to their published anatomical names', () => {
  const cases = {
    'G_front_inf-Opercular': 'Opercular part of the inferior frontal gyrus',
    S_calcarine: 'Calcarine sulcus',
    Pole_temporal: 'Temporal pole',
    'G_temp_sup-G_T_transv': 'Transverse temporal gyrus (Heschl)',
    'G_oc-temp_lat-fusifor': 'Lateral occipitotemporal (fusiform) gyrus',
  };
  for (const [source_name, name] of Object.entries(cases)) {
    assert.equal(labelOf(region({ atlas: 'destrieux', source_name })).name, name);
  }
});

test('Destrieux regions carry a lobe as their navigation group', () => {
  const lobe = source_name =>
    labelOf(region({ atlas: 'destrieux', source_name })).group;
  assert.equal(lobe('G_front_sup'), 'Frontal');
  assert.equal(lobe('G_precuneus'), 'Parietal');
  assert.equal(lobe('S_calcarine'), 'Occipital');
  assert.equal(lobe('G_insular_short'), 'Insula');
  assert.equal(lobe('G_and_S_cingul-Ant'), 'Cingulate');
});

test('common abbreviations are carried as aliases, not guessed at', () => {
  const stg = labelOf(region({ atlas: 'destrieux', source_name: 'G_temp_sup-Lateral' }));
  assert.ok(stg.aliases.includes('STG'));
  const heschl = labelOf(region({ atlas: 'destrieux', source_name: 'G_temp_sup-G_T_transv' }));
  assert.ok(heschl.aliases.includes('Heschl'));
});

test('HCP-MMP names are cleaned mechanically, never invented', () => {
  const v1 = labelOf(region({ atlas: 'hcp-mmp', source_name: 'L_V1_ROI' }));
  assert.equal(v1.code, 'V1');
  assert.equal(v1.name, 'V1');
  const odd = labelOf(region({ atlas: 'hcp-mmp', source_name: 'R_9-46d_ROI' }));
  assert.equal(odd.code, '9-46d');
});

test('HCP-MMP groups are alphabetical buckets, including one for numeric codes', () => {
  const group = source_name => labelOf(region({ atlas: 'hcp-mmp', source_name })).group;
  assert.equal(group('L_V1_ROI'), 'V–Z');
  assert.equal(group('L_A1_ROI'), 'A–C');
  assert.equal(group('L_55b_ROI'), '0–9');
  assert.equal(group('L_p24_ROI'), 'P–R');
});

test('subcortical structures get readable names and an anatomical system', () => {
  const put = labelOf(region({ atlas: 'aseg', kind: 'structure',
    source_name: 'Left-Putamen' }));
  assert.equal(put.name, 'Putamen');
  assert.equal(put.group, 'Basal ganglia');
  const cc = labelOf(region({ atlas: 'aseg', kind: 'structure', hemisphere: 'midline',
    source_name: 'CC_Anterior' }));
  assert.equal(cc.name, 'Corpus callosum, anterior');
  assert.equal(cc.group, 'Corpus callosum');
});

test('unlabelled cortex is named plainly rather than left blank', () => {
  const wall = labelOf(region({ atlas: 'destrieux', kind: 'non-region',
    source_name: 'Unknown' }));
  assert.equal(wall.name, 'Unlabelled');
  assert.equal(wall.group, 'Unlabelled');
});

test('every region in the published manifest resolves to a name and a group', async () => {
  const manifest = JSON.parse(
    await readFile(new URL(`../../public/models/${published}/manifest.json`, import.meta.url), 'utf8'));
  const unresolved = [];
  for (const r of manifest.regions) {
    const label = labelOf(r);
    if (!label?.name?.trim() || !label?.group?.trim()) unresolved.push(r.source_name);
  }
  assert.deepEqual(unresolved, [], `${unresolved.length} region(s) without a label`);
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

test('NextBrain names are read from the published table, never invented', () => {
  const region = {
    kind: 'tissue-region', atlas: 'nextbrain', hemisphere: 'left',
    source_label_id: 48, source_name: 'head_of_caudate', source_published_name: 'Left-head_of_caudate',
  };
  const label = labelOf(region);
  assert.equal(label.name, 'head of caudate');
  assert.equal(label.code, null);
  assert.equal(label.group, 'Basal ganglia');
});

test('a NextBrain name without a French entry keeps its published English', () => {
  const region = {
    kind: 'tissue-region', atlas: 'nextbrain', hemisphere: 'right',
    source_label_id: 10444, source_name: 'medial_habenular_nucleus',
  };
  assert.equal(labelOf(region, 'fr').name, labelOf(region, 'en').name);
});

const whiteMatter = source_name =>
  ({ kind: 'tissue-region', atlas: 'wmparc', hemisphere: 'left', source_name });

test('gyral white matter is named for its Desikan gyrus and grouped by lobe', () => {
  const precentral = labelOf(whiteMatter('precentral'));
  assert.equal(precentral.name, 'White matter of the precentral gyrus');
  assert.equal(precentral.group, 'Central white matter');
  const insula = labelOf(whiteMatter('insula'), 'fr');
  assert.equal(insula.name, 'Substance blanche de l’insula');
  assert.equal(insula.group, 'Substance blanche insulaire');
});

test('every gyral white-matter parcel wmparc publishes has its own French name', () => {
  const desikan = [
    'bankssts', 'caudalanteriorcingulate', 'caudalmiddlefrontal', 'cuneus', 'entorhinal',
    'fusiform', 'inferiorparietal', 'inferiortemporal', 'isthmuscingulate',
    'lateraloccipital', 'lateralorbitofrontal', 'lingual', 'medialorbitofrontal',
    'middletemporal', 'parahippocampal', 'paracentral', 'parsopercularis', 'parsorbitalis',
    'parstriangularis', 'pericalcarine', 'postcentral', 'posteriorcingulate', 'precentral',
    'precuneus', 'rostralanteriorcingulate', 'rostralmiddlefrontal', 'superiorfrontal',
    'superiorparietal', 'superiortemporal', 'supramarginal', 'frontalpole', 'temporalpole',
    'transversetemporal', 'insula',
  ];
  const untranslated = desikan.filter(name => {
    const [en, fr] = ['en', 'fr'].map(lang => labelOf(whiteMatter(name), lang));
    return !en || !fr || fr.name === en.name || fr.group === en.group;
  });
  assert.deepEqual(untranslated, []);
});

test('a Destrieux name spelled either way finds the same label', async () => {
  // FreeSurfer 5 wrote `_and_`, 6 writes `&`. Which spelling a brain carries
  // is a fact about its recon, not about the parcel, so both must resolve.
  const five = { id: 'destrieux:left:1', atlas: 'destrieux', hemisphere: 'left',
    kind: 'cortex', source_name: 'G_and_S_frontomargin' };
  const six = { ...five, source_name: 'G&S_frontomargin' };
  assert.equal(labelOf(six, 'en').name, labelOf(five, 'en').name);
  assert.equal(labelOf(six, 'fr').name, labelOf(five, 'fr').name);

  // The ampersand also appears mid-name, not only after a leading G.
  const mid = { ...five, id: 'destrieux:left:57', source_name: 'S_intrapariet&P_trans' };
  const spelled = { ...mid, source_name: 'S_intrapariet_and_P_trans' };
  assert.equal(labelOf(mid, 'en').name, labelOf(spelled, 'en').name);
});

test('every published Destrieux region resolves a label in both brains', async () => {
  const models = new URL('../../public/models/', import.meta.url);
  const { anatomies } = JSON.parse(
    await readFile(new URL('anatomies.json', models), 'utf8'));
  for (const { id } of anatomies) {
    const manifest = JSON.parse(
      await readFile(new URL(`${id}/manifest.json`, models), 'utf8'));
    for (const region of manifest.regions) {
      for (const lang of ['en', 'fr']) {
        assert.ok(labelOf(region, lang), `${id}: ${region.id} has no ${lang} label`);
      }
    }
  }
});
