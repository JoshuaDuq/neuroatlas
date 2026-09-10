import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { labelOf } from './labels.js';

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
    await readFile(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));
  const unresolved = [];
  for (const r of manifest.regions) {
    const label = labelOf(r);
    if (!label?.name?.trim() || !label?.group?.trim()) unresolved.push(r.source_name);
  }
  assert.deepEqual(unresolved, [], `${unresolved.length} region(s) without a label`);
  assert.equal(manifest.regions.length, 547);
});
