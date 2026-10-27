import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import { anatomies } from '../catalog/test-support.ts';
import { TRACT_CATALOGS, tractCatalog } from './catalogs.ts';
import type { TractCatalog } from './catalogs.ts';

const { tract_catalogs: paths } = readRepoYaml<{ tract_catalogs: string[] }>('config/model.yaml');
const catalogs = paths.map((path) => readRepoYaml<TractCatalog>(path));

// The legacy test read catalogs.js as text to compare its imports with config/model.yaml;
// the behavioural equivalent is that the catalogs it serves are exactly the files named there.
test('the viewer serves exactly the tract catalogs config/model.yaml names', () => {
  assert.deepEqual(TRACT_CATALOGS, catalogs);
});

test('each catalog belongs to one published anatomy and carries the same dataset copy', () => {
  const owners = catalogs.map((catalog) => catalog.anatomy);
  assert.equal(new Set(owners).size, owners.length);
  for (const anatomy of owners) {
    assert.ok(
      anatomies.anatomies.some((entry) => entry.id === anatomy),
      anatomy,
    );
  }
  const keys = Object.keys(catalogs[0].text.en).sort();
  for (const catalog of catalogs) {
    for (const lang of ['en', 'fr'] as const) {
      assert.deepEqual(Object.keys(catalog.text[lang]).sort(), keys, `${catalog.id} ${lang}`);
    }
  }
});

test('an anatomy with tracts of its own gets them, any other the CDMD reference', () => {
  assert.equal(tractCatalog('cdmd'), TRACT_CATALOGS[0]);
  assert.equal(tractCatalog('aomic'), TRACT_CATALOGS[0]);
});

test('CAT-61 · the CDMD tract catalog: its subject, maps, 30 bundles with two initial, overlay and copy keys', () => {
  const [cdmd] = TRACT_CATALOGS;
  assert.deepEqual(paths, ['data/diffusion-cdmd.yaml']);
  assert.equal(cdmd.id, 'cdmd-sub-013');
  assert.equal(cdmd.anatomy, 'cdmd');
  assert.equal(cdmd.reference_space, 'cdmd-sub-013/surface-space.json');
  assert.deepEqual(
    cdmd.maps.map((map) => map.id),
    ['t1', 'fa'],
  );
  assert.equal(cdmd.bundles.length, 30);
  assert.deepEqual(
    cdmd.bundles.filter((bundle) => bundle.initial).map((bundle) => bundle.id),
    ['af-left', 'cst-right'],
  );
  assert.equal(cdmd.overlay_cortex_opacity, 0.16);
  assert.equal(cdmd.resample_step_mm, 0.5);
  for (const lang of ['en', 'fr'] as const) {
    assert.deepEqual(Object.keys(cdmd.text[lang]).sort(), [
      'dataset',
      'files',
      'mriCanvas',
      'mriScope',
      'mriTitle',
      'otherAnatomy',
    ]);
  }
});

test('CAT-61 · an unlisted, empty or inherited-property anatomy name gets the CDMD catalog', () => {
  for (const anatomy of ['cdmd', 'aomic', '', 'toString']) {
    assert.equal(tractCatalog(anatomy), TRACT_CATALOGS[0], anatomy);
  }
});
