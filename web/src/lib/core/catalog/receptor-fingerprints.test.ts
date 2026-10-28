import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest, Region } from '../../types/index.ts';
import {
  fingerprintGroups,
  fingerprintsOf,
  receptorText,
  unmeasured,
  validateReceptorFingerprints,
  type Fingerprint,
  type ReceptorFingerprints,
} from './receptor-fingerprints.ts';
import { asRegion, readModel } from './test-support.ts';

const fingerprint = (
  key: string,
  receptors: Fingerprint['receptors'],
  part: Fingerprint['part'] = null,
): Fingerprint => ({
  key,
  measured_in: key,
  part,
  doi: `https://doi.org/10.25493/${key}`,
  documented_by: [],
  receptors,
  donors: [{ id: 'AR01', sex: 'male', age_years: 78 }],
  hemispheres: { left: 1, right: 1 },
});

const catalog = (regions: Record<string, string[]>): ReceptorFingerprints => ({
  id: 'receptor-fingerprints',
  unit: 'fmol/mg',
  sources: {},
  transmitters: [
    {
      id: 'glutamate',
      name: 'Glutamate',
      name_fr: 'Glutamate',
      receptors: [
        { id: 'AMPA', display: ['AMPA'] },
        { id: 'NMDA', display: ['NMDA'] },
      ],
    },
    {
      id: 'gaba',
      name: 'GABA',
      name_fr: 'GABA',
      receptors: [{ id: 'GABAA', display: ['GABA', { sub: 'A' }] }],
    },
  ],
  withheld: [
    { dataset: 'b', receptor: 'NMDA', field: 'sd', published: 900, reason: 'r', reason_fr: 'r' },
  ],
  datasets: [
    fingerprint('a', { AMPA: { mean: 200, sd: 50 }, NMDA: { mean: 1000, sd: 100 } }, 'dorsal'),
    fingerprint('b', { AMPA: { mean: 400, sd: 80 }, NMDA: { mean: 500, sd: null } }, 'ventral'),
  ],
  regions,
});

const regions = new Map<string, Region>([
  ['julich:left:2', asRegion({ atlas: 'julich', hemisphere: 'left' })],
]);

test('a region takes its fingerprints in published order; one without takes none', () => {
  const data = validateReceptorFingerprints(catalog({ 'julich:left:2': ['a', 'b'] }), regions);
  assert.deepEqual(
    fingerprintsOf(data, 'julich:left:2').map((f) => f.key),
    ['a', 'b'],
  );
  assert.deepEqual(fingerprintsOf(data, 'julich:left:3'), []);
  assert.deepEqual(fingerprintsOf(null, 'julich:left:2'), []);
});

test('each bar is the share of the receptor’s highest published mean, and a group with none is left out', () => {
  const data = catalog({});
  const [glutamate, ...rest] = fingerprintGroups(data, data.datasets[1]!);
  assert.equal(rest.length, 0, 'GABA has no measured receptor here');
  assert.deepEqual(
    glutamate!.rows.map((row) => [row.receptor.id, row.share]),
    [
      ['AMPA', 1],
      ['NMDA', 0.5],
    ],
  );
  assert.equal(glutamate!.rows[1]!.withheld?.published, 900);
  assert.equal(glutamate!.rows[0]!.withheld, null);
  assert.deepEqual(unmeasured(data, data.datasets[1]!).map(receptorText), ['GABAA']);
});

test('an assignment to an unknown region or fingerprint, or a density that is not positive, is refused', () => {
  assert.throws(
    () => validateReceptorFingerprints(catalog({ 'julich:left:9': ['a'] }), regions),
    /julich:left:9/,
  );
  assert.throws(
    () => validateReceptorFingerprints(catalog({ 'julich:left:2': ['c'] }), regions),
    /julich:left:2/,
  );
  const negative = catalog({});
  negative.datasets[0]!.receptors.AMPA = { mean: 0, sd: 1 };
  assert.throws(() => validateReceptorFingerprints(negative, regions), /fingerprint: a/);
});

test('the published catalog validates against CDMD, and Area 44 takes its dorsal then ventral part', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const data = validateReceptorFingerprints(
    readModel<ReceptorFingerprints>(`cdmd/${manifest.receptor_fingerprints!.file}`),
    new Map(manifest.regions.map((region) => [region.id, region])),
  );
  const [dorsal, ventral] = fingerprintsOf(data, 'julich:left:2');
  assert.deepEqual([dorsal!.part, ventral!.part], ['dorsal', 'ventral']);
  const nmda = fingerprintGroups(data, ventral!)[0]!.rows.find(
    (row) => row.receptor.id === 'NMDA',
  )!;
  // hOc3v holds the highest published NMDA mean, 1496 fmol/mg.
  assert.equal(nmda.share, 1129 / 1496);
  assert.deepEqual(unmeasured(data, dorsal!).map(receptorText), ['mGluR2/3', 'A1']);
});

test('a withheld value still published, or a region taking two fingerprints of one part, is refused', () => {
  const published = catalog({});
  published.datasets[1]!.receptors.NMDA = { mean: 500, sd: 900 };
  assert.throws(() => validateReceptorFingerprints(published, regions), /withheld value: b NMDA/);
  const samePart = catalog({ 'julich:left:2': ['a', 'b'] });
  samePart.datasets[1]!.part = 'dorsal';
  assert.throws(() => validateReceptorFingerprints(samePart, regions), /assignment: julich:left:2/);
});
