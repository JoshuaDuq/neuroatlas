import test from 'node:test';
import assert from 'node:assert/strict';
import { domainsOf, shownDomain, validateNeuropsychDomains } from './neuropsych-domains.js';

const regions = new Map([['hcp-mmp:left:1', { atlas: 'hcp-mmp' }], ['destrieux:left:1', { atlas: 'destrieux' }]]);
const partition = () => ({
  id: 'neuropsych-domains', atlas: 'hcp-mmp', threshold_z: 3,
  domains: [
    { id: 'language', term: 'language', name: 'Language', name_fr: 'Langage', color: [1, 2, 3] },
    { id: 'memory', term: 'episodic memory', name: 'Memory', name_fr: 'Mémoire', color: [4, 5, 6] },
  ],
  lesion_checks: { language: [], memory: [] },
  regions: { 'hcp-mmp:left:1': [{ domain: 'memory', z: 7.5 }, { domain: 'language', z: 3.2 }] },
});

test('an area lists its domains strongest first and is drawn as the strongest unless one is picked', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.deepEqual(domainsOf(published, 'hcp-mmp:left:1').map(record => [record.id, record.z]),
    [['memory', 7.5], ['language', 3.2]]);
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', null).id, 'memory');
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', 'language').id, 'language');
  assert.deepEqual(domainsOf(published, 'hcp-mmp:left:2'), []);
  assert.equal(shownDomain(published, 'hcp-mmp:left:2', null), null);
});

test('a domain assigned below the threshold, off its atlas or unknown is rejected', () => {
  for (const [change, message] of [
    [p => { p.regions['hcp-mmp:left:1'][1].z = 2.9; }, /assignment: hcp-mmp:left:1/],
    [p => { p.regions['destrieux:left:1'] = [{ domain: 'memory', z: 4 }]; }, /assignment: destrieux:left:1/],
    [p => { p.regions['hcp-mmp:left:1'][0].domain = 'praxis'; }, /assignment: hcp-mmp:left:1/],
    [p => { delete p.lesion_checks.memory; }, /domain: memory/],
  ]) {
    const broken = partition();
    change(broken);
    assert.throws(() => validateNeuropsychDomains(broken, regions), message);
  }
});
