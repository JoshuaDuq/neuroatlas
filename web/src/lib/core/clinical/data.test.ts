import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import { createClinicalCatalog, findingPaint } from './catalog.ts';
import type { ClinicalCatalog } from './catalog.ts';
import { manifests } from './test-support.ts';
import type { ClinicalData } from './types.ts';

const data = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');

test('every published deficit has a colour for each of its findings', () => {
  for (const deficit of data.deficits) {
    findingPaint(
      deficit.id,
      data.associations.filter((association) => association.deficit === deficit.id),
    );
  }
});

describe('published clinical content resolves to the actual atlas and cited evidence', () => {
  for (const [anatomy, manifest] of manifests) {
    test(anatomy, () => checkAnatomy(createClinicalCatalog(data, manifest, {})));
  }
});

function checkAnatomy(catalog: ClinicalCatalog) {
  assert.deepEqual(
    catalog
      .search('', 'en')
      .map((d) => d.id)
      .sort(),
    [
      'abulia',
      'acalculia',
      'achromatopsia',
      'agnosia',
      'agraphia',
      'akinetic-mutism',
      'akinetopsia',
      'alexia',
      'alexithymia',
      'alien-hand',
      'amnesia',
      'amusia',
      'anosognosia',
      'aphantasia',
      'aphasia',
      'apraxia',
      'aprosodia',
      'ataxia',
      'auditory-agnosia',
      'auditory-short-term-memory',
      'autotopagnosia',
      'buccofacial-apraxia',
      'central-pain',
      'cerebellar-cognitive',
      'coma',
      'confabulation',
      'constructional-apraxia',
      'cortical-deafness',
      'decision-making',
      'disinhibition',
      'dysarthria',
      'dysphagia',
      'dystonia',
      'emotion-recognition',
      'emotional-empathy',
      'executive',
      'finger-agnosia',
      'foreign-accent',
      'hand-paresis',
      'hemianopia',
      'hemichorea',
      'hemiparesis',
      'lateropulsion',
      'left-right-disorientation',
      'locked-in',
      'motor-neglect',
      'neglect',
      'oculomotor-apraxia',
      'olfactory-recognition',
      'optic-ataxia',
      'pain-asymbolia',
      'palinopsia',
      'parkinsonism',
      'phonagnosia',
      'prospective-memory',
      'simultanagnosia',
      'somatoparaphrenia',
      'somatosensory',
      'sound-localization',
      'spasticity',
      'speech-apraxia',
      'stuttering',
      'tactile-agnosia',
      'tactile-extinction',
      'taste-impairment',
      'temporal-disorientation',
      'theory-of-mind',
      'topographical-disorientation',
      'visual-extinction',
      'word-deafness',
    ],
  );
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
  assert.deepEqual(
    catalog.forRegion('destrieux:right:38').map((a) => a.id),
    ['neglect-allocentric', 'akinetopsia-lateral'],
  );
  assert.deepEqual(
    catalog
      .forRegion('destrieux:right:26')
      .map((a) => a.id)
      .sort(),
    [
      'aprosodia-frontal-parietal',
      'extinction-temporoparietal',
      'neglect-egocentric',
      'neglect-perceptual',
      'sound-localization-right-network',
      'tactile-agnosia-persistence',
    ],
  );
  assert.ok(
    data.references.some((r) => r.method === 'meta-analysis'),
    'pooled lesion evidence is present',
  );
  assert.ok(
    catalog
      .forDeficit('akinetopsia')[0]
      .evidence.some((e) => e.reference === 'otsuka-hirota-2014' && e.role === 'qualifying'),
    'the unilateral motion-blindness case qualifies the bilateral-lesion example',
  );
  assert.equal(catalog.search('prosopagnosie', 'fr')[0].id, 'agnosia');
  assert.equal(catalog.search('set shifting', 'en')[0].id, 'executive');
  assert.ok(
    catalog.forDeficit('apraxia').every((a) => a.evidence.some((e) => e.role === 'qualifying')),
    'contrary evidence accompanies apraxia claims',
  );
  // Motor/premotor cases join the earlier insular and frontal findings, with qualifications.
  const speech = catalog.forDeficit('speech-apraxia');
  assert.equal(speech.length, 3);
  assert.ok(speech.every((a) => a.evidence.some((e) => e.role === 'qualifying')));
  assert.deepEqual(
    catalog
      .forRegion('destrieux:left:12')
      .map((a) => a.id)
      .sort(),
    [
      'agraphia-orthographic-long-term',
      'apraxia-finger',
      'dysphagia-insula',
      'emotion-prosody',
      'emotional-empathy-inferior-frontal',
      'speech-apraxia-frontal',
      'stuttering-cortico-striatal',
    ],
  );
  // Deep landmarks reach into aseg and the learning-anatomy solids.
  assert.equal(catalog.forRegion('aseg:left:18')[0].deficit, 'emotion-recognition');
  assert.equal(catalog.forRegion('learning:right:dentate')[0].deficit, 'ataxia');
  // Histological nuclei carry claims of their own; a thalamic nucleus can serve two.
  assert.deepEqual(
    catalog
      .forRegion('nextbrain:left:458')
      .map((a) => a.deficit)
      .sort(),
    ['central-pain', 'central-pain', 'lateropulsion'],
  );
  assert.deepEqual(
    catalog.forDeficit('amnesia').map((a) => a.id),
    ['hippocampal-amnesia', 'amnesia-fornix', 'amnesia-diencephalic'],
  );
  assert.ok(catalog.forDeficit('hemichorea')[0].evidence.some((e) => e.role === 'qualifying'));
  assert.deepEqual(
    catalog.forRegion('destrieux:left:38').map((a) => a.deficit),
    ['aphasia', 'aphasia', 'aphasia', 'akinetopsia'],
  );
  // Lobule VI carries motor, speech and cognitive claims side by side; the anterior lobe no cognitive one.
  const cited = (region: string) =>
    catalog
      .forRegion(region)
      .map((a) => a.deficit)
      .sort();
  assert.deepEqual(cited('learning:lobule-vi-right'), [
    'ataxia',
    'cerebellar-cognitive',
    'dysarthria',
  ]);
  assert.deepEqual(cited('learning:lobule-v-right'), ['ataxia', 'dysarthria']);
  assert.equal(catalog.search('champ visuel', 'fr')[0].id, 'hemianopia');
  assert.equal(catalog.search('reading', 'en')[0].id, 'alexia');
  // Every deficit sits in one group, and the groups are what the list is read by.
  assert.equal(
    catalog.grouped('', 'en').flatMap((entry) => entry.deficits).length,
    data.deficits.length,
  );
  assert.deepEqual(
    catalog.grouped('', 'en').map((entry) => entry.group.id),
    [
      'attention-executive',
      'memory',
      'language-number',
      'perception',
      'sensorimotor',
      'social-emotional',
    ],
  );
  assert.deepEqual(catalog.mappedRegions('aphasia').slice(0, 2), [
    'destrieux:left:38',
    'destrieux:left:34',
  ]);
}

describe('published clinical content: fixed values', () => {
  const [, manifest] = manifests[0];
  const catalog = createClinicalCatalog(data, manifest, {});

  test('CAT-50 · the published records are the revision of 2026-10-29: 6 groups, 70 deficits, 131 references, 108 associations', () => {
    assert.equal(catalog.revised, '2026-10-29');
    assert.equal(data.groups.length, 6);
    assert.equal(data.deficits.length, 70);
    assert.equal(data.references.length, 131);
    assert.equal(data.associations.length, 108);
  });

  test('reviewed motor-neglect and aprosodia findings preserve their mapping limits', () => {
    assert.equal(catalog.paint('motor-neglect', 'motor-neglect-parietal').paint.colors.size, 0);
    assert.deepEqual(catalog.mappedRegions('motor-neglect'), ['aseg:right:51']);
    assert.deepEqual(
      catalog.forDeficit('aprosodia').map((a) => a.id),
      ['aprosodia-frontal-parietal', 'aprosodia-medial-frontal'],
    );
  });

  test('the callosal alien-hand finding highlights anterior subdivisions and leaves posterior callosum uncoloured', () => {
    assert.deepEqual(catalog.mappedRegions('alien-hand'), ['aseg:midline:254', 'aseg:midline:255']);
    assert.ok(!catalog.paint('alien-hand').paint.colors.has('aseg:midline:251'));
  });

  test('the focal coma finding colours its brainstem landmark without colouring connected cortical nodes', () => {
    assert.deepEqual(
      [...catalog.paint('coma', 'coma-dorsolateral-pons').paint.colors.keys()],
      ['learning:left:pons'],
    );
  });

  test('the amusia connectivity finding stays uncoloured while its direct lesion landmarks remain available', () => {
    assert.equal(catalog.paint('amusia', 'amusia-network').paint.colors.size, 0);
    assert.deepEqual(catalog.mappedRegions('amusia'), ['destrieux:right:33', 'destrieux:right:34']);
  });

  test('CAT-45 · a published search ignores case and accents and ranks the named deficit first', () => {
    const ids = (query: string, lang: 'en' | 'fr') => catalog.search(query, lang).map((d) => d.id);
    assert.deepEqual(ids('amnesia', 'en'), ['amnesia']);
    assert.deepEqual(ids('aphas', 'en'), ['aphasia', 'speech-apraxia']);
    assert.deepEqual(ids('AMNÉSIA', 'en'), ['amnesia']);
    assert.deepEqual(ids('memory', 'en'), [
      'agraphia',
      'amnesia',
      'auditory-short-term-memory',
      'olfactory-recognition',
      'prospective-memory',
      'confabulation',
    ]);
    assert.equal(ids('', 'fr').length, 70);
    assert.deepEqual(ids('unlisted', 'en'), []);
  });

  test('CAT-42 · a misspelt published deficit is offered the closest name', () => {
    assert.equal(catalog.nearest('aphasai', 'en'), 'Aphasia');
    assert.equal(catalog.nearest('amnesie', 'fr'), 'Amnésie');
    assert.equal(catalog.nearest('abc', 'en'), null);
  });

  test('CAT-49 · aphasia has the most findings, six, and its paint colours 7 regions', () => {
    const counts = data.deficits.map((d) => catalog.forDeficit(d.id).length);
    assert.equal(Math.max(...counts), 6);
    assert.equal(catalog.forDeficit('aphasia').length, 6);
    assert.equal(catalog.paint('aphasia').paint.colors.size, 7);
    assert.equal(catalog.paint('aphasia').paint.id, 'deficit:aphasia');
  });
});
