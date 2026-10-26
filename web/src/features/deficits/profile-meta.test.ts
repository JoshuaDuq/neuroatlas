import assert from 'node:assert/strict';
import { test } from 'vitest';
import manifest from '../../../../public/models/cdmd/manifest.json';
import { loadClinicalCatalog } from '../../lib/core/clinical/load.ts';
import type { DisplaySettings, Manifest, Region } from '../../lib/types/index.ts';
import { stageCounts } from './profile-meta.ts';

const regions = new Map(
  (manifest as unknown as Manifest).regions.map((region) => [region.id, region]),
);
const regionOf = (id: string): Region => regions.get(id)!;
const settings: DisplaySettings = {
  atlas: 'destrieux',
  detail: 'aseg',
  internalSystem: null,
  internalConstituents: new Set(),
  cutAtlas: null,
  cutActive: false,
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  internalVisible: true,
  spinalCordVisible: true,
  surfaceColor: 'tissue',
  functionalLevel: 'named',
  paint: null,
  isolatedRegion: null,
  hiddenRegions: new Set(),
  dissectionCanUndo: false,
};
const clinical = loadClinicalCatalog(manifest as unknown as Manifest);

test('counts what is drawn now of the regions a deficit maps, and says whether they are painted', () => {
  const ids = clinical.mappedRegions('neglect');
  assert.deepEqual(stageCounts(ids, regionOf, settings, false), {
    shown: ids.length - 1,
    total: ids.length,
    coloured: false,
  });
  assert.equal(stageCounts(ids, regionOf, settings, true).coloured, true);
});

test('a hidden hemisphere, an isolated region or a removed region is not counted as shown', () => {
  const ids = clinical.mappedRegions('aphasia');
  assert.equal(stageCounts(ids, regionOf, { ...settings, hemisphere: 'right' }, false).shown, 0);
  assert.equal(
    stageCounts(ids, regionOf, { ...settings, isolatedRegion: ids[0] }, false).shown,
    1,
  );
  assert.equal(
    stageCounts(ids, regionOf, { ...settings, hiddenRegions: new Set([ids[0]]) }, false).shown,
    ids.length - 1,
  );
});

test('a region the manifest does not know fails loudly', () => {
  assert.throws(() => stageCounts(['nowhere:1'], regionOf, settings, false));
});
