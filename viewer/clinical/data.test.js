import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import { createClinicalCatalog } from './catalog.js';

const published = JSON.parse(await readFile(new URL('../../public/models/anatomies.json', import.meta.url), 'utf8')).default;

test('published clinical content resolves to the actual atlas and cited evidence', async () => {
  const data = parse(await readFile(new URL('../../data/neuropsychology.yaml', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL(`../../public/models/${published}/manifest.json`, import.meta.url)));
  const catalog = createClinicalCatalog(data, manifest);
  assert.deepEqual(catalog.search('', 'en').map(d => d.id).sort(),
    ['abulia', 'acalculia', 'achromatopsia', 'agnosia', 'agraphia', 'akinetopsia', 'alexia', 'alien-hand',
      'amnesia', 'amusia', 'anosognosia',
      'aphasia', 'apraxia', 'ataxia', 'central-pain', 'cerebellar-cognitive', 'coma', 'constructional-apraxia',
      'decision-making', 'dysarthria', 'dysphagia', 'dystonia', 'emotion-recognition', 'executive',
      'hand-paresis', 'hemianopia', 'hemichorea', 'lateropulsion', 'neglect', 'optic-ataxia', 'parkinsonism',
      'simultanagnosia', 'somatoparaphrenia', 'somatosensory', 'speech-apraxia', 'tactile-agnosia',
      'taste-impairment', 'topographical-disorientation', 'visual-extinction', 'word-deafness']);
  for (const deficit of data.deficits) {
    assert.ok(catalog.forDeficit(deficit.id).length > 0, deficit.id);
  }
  assert.equal(catalog.forRegion('destrieux:left:38')[0].deficit, 'aphasia');
  assert.equal(catalog.forRegion('destrieux:right:21')[0].deficit, 'agnosia');
  for (const id of ['aseg:left:17', 'aseg:right:53']) {
    assert.equal(catalog.forRegion(id)[0].deficit, 'amnesia');
  }
  assert.deepEqual(catalog.forRegion('destrieux:left:16'), []);
  // Two meta-analyses carve neglect and aphasia differently from the single
  // studies beside them, so a region can carry more than one association.
  assert.deepEqual(catalog.forRegion('destrieux:right:38').map(a => a.id),
    ['neglect-allocentric', 'akinetopsia-lateral']);
  assert.deepEqual(catalog.forRegion('destrieux:right:26').map(a => a.id).sort(),
    ['extinction-temporoparietal', 'neglect-egocentric', 'neglect-perceptual']);
  assert.ok(data.references.some(r => r.method === 'meta-analysis'), 'pooled lesion evidence is present');
  assert.equal(catalog.search('prosopagnosie', 'fr')[0].id, 'agnosia');
  assert.equal(catalog.search('set shifting', 'en')[0].id, 'executive');
  assert.ok(catalog.forDeficit('apraxia').every(a =>
    a.evidence.some(e => e.role === 'qualifying')), 'contrary evidence accompanies apraxia claims');
  // Dronkers and Hillis each support one speech-apraxia site and qualify the other.
  const speech = catalog.forDeficit('speech-apraxia');
  assert.equal(speech.length, 2);
  assert.ok(speech.every(a => a.evidence.some(e => e.role === 'qualifying')));
  assert.deepEqual(catalog.forRegion('destrieux:left:12').map(a => a.id).sort(),
    ['apraxia-finger', 'dysphagia-insula', 'emotion-prosody', 'speech-apraxia-frontal']);
  // Deep landmarks reach into aseg and the learning-anatomy solids.
  assert.equal(catalog.forRegion('aseg:left:18')[0].deficit, 'emotion-recognition');
  assert.equal(catalog.forRegion('learning:right:dentate')[0].deficit, 'ataxia');
  // Histological nuclei carry claims of their own; a thalamic nucleus can serve two.
  assert.deepEqual(catalog.forRegion('nextbrain:left:458').map(a => a.deficit).sort(),
    ['central-pain', 'lateropulsion']);
  assert.deepEqual(catalog.forDeficit('amnesia').map(a => a.id),
    ['hippocampal-amnesia', 'amnesia-fornix', 'amnesia-diencephalic']);
  assert.ok(catalog.forDeficit('hemichorea')[0].evidence.some(e => e.role === 'qualifying'));
  assert.deepEqual(catalog.forRegion('destrieux:left:38').map(a => a.deficit),
    ['aphasia', 'aphasia', 'aphasia', 'akinetopsia']);
  // The cerebellar cortex now carries motor, speech and cognitive claims side by side.
  assert.deepEqual(catalog.forRegion('aseg:right:47').map(a => a.deficit).sort(),
    ['ataxia', 'cerebellar-cognitive', 'dysarthria']);
  assert.equal(catalog.search('champ visuel', 'fr')[0].id, 'hemianopia');
  assert.equal(catalog.search('reading', 'en')[0].id, 'alexia');
});
