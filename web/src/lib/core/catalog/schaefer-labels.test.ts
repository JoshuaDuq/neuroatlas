import assert from 'node:assert/strict';
import { test } from 'vitest';
import { schaeferLabel } from './schaefer-labels.ts';
import { readModel } from './test-support.ts';
import type { Manifest } from '../../types/index.ts';

const parcel = (seven: string, seventeen: string) => ({
  source_name: seven,
  source_17_network_name: seventeen,
});

test('a Schaefer parcel is named by its 17-network name and grouped by its Yeo network', () => {
  assert.deepEqual(
    schaeferLabel(parcel('7Networks_LH_Default_PFC_1', '17Networks_LH_DefaultA_PFCd_1'), 'en'),
    {
      name: 'Default mode A, dorsal prefrontal cortex 1',
      code: null,
      group: 'Default mode',
      aliases: ['7Networks_LH_Default_PFC_1', '17Networks_LH_DefaultA_PFCd_1'],
    },
  );
  const visual = parcel('7Networks_RH_Vis_3', '17Networks_RH_VisCent_ExStr_3');
  assert.equal(schaeferLabel(visual, 'en')!.name, 'Visual central, extrastriate cortex 3');
  assert.equal(schaeferLabel(visual, 'fr')!.name, 'Visuel central, cortex extrastrié 3');
  assert.equal(schaeferLabel(visual, 'fr')!.group, 'Visuel');
  // A 17-network name without a location keeps the subnetwork and index alone.
  const unplaced = parcel('7Networks_LH_SomMot_12', '17Networks_LH_SomMotA_12');
  assert.equal(schaeferLabel(unplaced, 'en')!.name, 'Somatomotor A 12');
  assert.equal(
    schaeferLabel(parcel('7Networks_LH_Vis_1', '17Networks_LH_VisCent_Nowhere_1'), 'en'),
    null,
  );
  assert.equal(schaeferLabel(parcel('7Networks_LH_Vis_1', '17Networks_LH_Invented_1'), 'en'), null);
  assert.equal(schaeferLabel({ source_name: '7Networks_LH_Vis_1' }, 'en'), null);
});

test('every published Schaefer parcel has a distinct name in both languages', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const schaefer = manifest.regions.filter((region) => region.atlas === 'schaefer');
  const parcels = schaefer.filter((region) => region.kind === 'cortex');
  assert.equal(parcels.length, 400);
  for (const lang of ['en', 'fr'] as const) {
    const names = parcels.map((region) => {
      const label = schaeferLabel(region, lang);
      assert.ok(label, region.id);
      return `${region.hemisphere} ${label.name}`;
    });
    assert.equal(new Set(names).size, 400);
  }
  assert.deepEqual(
    schaefer.filter((region) => region.kind === 'non-region').map((region) => region.source_name),
    ['Background+FreeSurfer_Defined_Medial_Wall', 'Background+FreeSurfer_Defined_Medial_Wall'],
  );
});
