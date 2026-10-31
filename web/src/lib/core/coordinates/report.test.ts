import assert from 'node:assert/strict';
import { test } from 'vitest';
import { coordinateCsv, flattened, networkShares, sphereShares } from './report.ts';

const region = (inside: number) => ({ inside, whole: 10_000 });
const regions = new Map([
  ['schaefer:left:1', region(200)],
  ['schaefer:left:2', region(100)],
  ['schaefer:left:3', region(4)],
  ['destrieux:left:1', region(300)],
  ['aseg:left:10', region(50)],
  ['aseg:left:4', region(20)],
]);

test('each region is a share of the sphere, and what no region covers is its own share', () => {
  const { shown, slight, rest } = sphereShares(regions, 'schaefer', 500);
  assert.deepEqual(shown, [
    { id: 'schaefer:left:1', inside: 200, share: 0.4 },
    { id: 'schaefer:left:2', inside: 100, share: 0.2 },
  ]);
  assert.deepEqual(slight, [{ id: 'schaefer:left:3', inside: 4, share: 0.008 }]);
  assert.equal(rest, 0.392);
  const deep = sphereShares(regions, 'aseg', 500, (id) => id === 'aseg:left:10');
  assert.deepEqual(deep.shown, [{ id: 'aseg:left:10', inside: 50, share: 0.1 }]);
  assert.equal(deep.rest, 0.9);
  assert.throws(() => sphereShares(regions, 'aseg', 0), RangeError);
});

test('networks gather their parcels’ shares of the sphere', () => {
  const networks: Record<string, { network: string; fraction: number }[]> = {
    'schaefer:left:1': [{ network: 'Default', fraction: 1 }],
    'schaefer:left:2': [
      { network: 'Default', fraction: 0.5 },
      { network: 'Cont', fraction: 0.5 },
    ],
    'schaefer:left:3': [{ network: 'Vis', fraction: 1 }],
  };
  const { shown, slight, rest } = networkShares(regions, 'schaefer', 500, (id) => networks[id]);
  assert.deepEqual(shown, [
    { id: 'Default', inside: 250, share: 0.5 },
    { id: 'Cont', inside: 50, share: 0.1 },
  ]);
  assert.deepEqual(slight, [{ id: 'Vis', inside: 4, share: 0.008 }]);
  assert.equal(rest, 0.392);
  assert.throws(() => networkShares(regions, 'schaefer', 500, () => undefined), /schaefer:left/);
});

test('the table leads with how the coordinate was placed, then every share', () => {
  assert.deepEqual(flattened('registration', { cortex_dice: 0.8, round_trip_mm: { p95: 0.4 } }), [
    ['registration.cortex_dice', 0.8],
    ['registration.round_trip_mm.p95', 0.4],
  ]);
  const csv = coordinateCsv(
    [
      ['entered_mni_mm', '-42,22,6'],
      ['radius_mm', 5],
    ],
    [{ atlas: 'aseg', id: 'aseg:left:10', name: 'Left Thalamus, proper', share: 0.1 }],
  );
  assert.equal(
    csv,
    'item,atlas,region_id,region,value\r\n' +
      'entered_mni_mm,,,,"-42,22,6"\r\n' +
      'radius_mm,,,,5\r\n' +
      'share_of_sphere,aseg,aseg:left:10,"Left Thalamus, proper",0.1\r\n',
  );
});
