import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import { createClinicalCatalog } from './catalog.js';

test('published clinical content resolves to the actual atlas and cited evidence', async () => {
  const data = parse(await readFile(new URL('../../data/neuropsychology.yaml', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../../public/models/manifest.json', import.meta.url)));
  const catalog = createClinicalCatalog(data, manifest);
  assert.deepEqual(catalog.search('', 'en').map(d => d.id).sort(),
    ['agnosia', 'amnesia', 'aphasia', 'apraxia', 'executive', 'neglect']);
  for (const deficit of data.deficits) {
    assert.ok(catalog.forDeficit(deficit.id).length > 0, deficit.id);
  }
  assert.equal(catalog.forRegion('destrieux:left:38')[0].deficit, 'aphasia');
  assert.equal(catalog.forRegion('destrieux:right:21')[0].deficit, 'agnosia');
  for (const id of ['aseg:left:17', 'aseg:right:53']) {
    assert.equal(catalog.forRegion(id)[0].deficit, 'amnesia');
  }
  assert.deepEqual(catalog.forRegion('destrieux:right:38'), []);
  assert.equal(catalog.search('prosopagnosie', 'fr')[0].id, 'agnosia');
  assert.equal(catalog.search('set shifting', 'en')[0].id, 'executive');
  assert.ok(catalog.forDeficit('apraxia').every(a =>
    a.evidence.some(e => e.role === 'qualifying')), 'contrary evidence accompanies apraxia claims');
});
